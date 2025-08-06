// src/routes/payment/paymentRoutes.js
const express = require('express');
const router = express.Router();
const moment = require('moment');
const crypto = require('crypto');
const querystring = require('qs');

const authMiddleware = require('../../middleware/authMiddleware');
const Booking = require('../../models/Booking');
const Invoice = require('../../models/Invoice');
const VnPayConfig = require('../../config/vnPayConfig');

// Hàm sắp xếp đối tượng theo key (giữ nguyên)
function sortObject(obj) {
    let sorted = {};
    let keys = Object.keys(obj).sort();
    keys.forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
}

// --- HÀM HELPER NGOÀI CÁC TUYẾN ROUTE (Giữ nguyên vì chúng đã hoạt động tốt) ---

/**
 * Hàm tạo hoặc cập nhật Invoice
 * @param {Object} booking - Đối tượng Booking đã được tìm thấy và có thể đã cập nhật
 * @param {number} amountFromVNPAY - Số tiền nhận được từ VNPAY
 * @param {Object} vnpayDetails - Toàn bộ các params nhận được từ VNPAY (sau khi đã xóa hash)
 * @param {string} paymentStatusString - Trạng thái thanh toán 'success' hoặc 'failed'
 * @returns {Promise<Invoice>} - Trả về đối tượng Invoice đã được tạo/cập nhật
 */
async function createOrUpdateInvoice(booking, amountFromVNPAY, vnpayDetails, paymentStatusString) {
    let invoice;
    try {
        invoice = await Invoice.findOne({ bookingId: booking.bookingId });

        if (!invoice) {
            const newInvoiceData = {
                invoiceCode: `INV-${Date.now()}-${booking.bookingId.slice(-4)}`,
                booking: booking._id,
                bookingId: booking.bookingId,
                userId: booking.user._id,
                amount: amountFromVNPAY,
                paymentMethod: 'VNPAY',
                paymentStatus: paymentStatusString,
                vnpayDetails: vnpayDetails,
            };
            invoice = new Invoice(newInvoiceData);
            await invoice.save();
            console.log(`[Invoice Helper] New Invoice created for booking ${booking.bookingId}. Invoice ID: ${invoice._id}. Payment Status: ${invoice.paymentStatus}.`);
        } else {
            invoice.paymentStatus = paymentStatusString;
            invoice.vnpayDetails = vnpayDetails;
            await invoice.save();
            console.log(`[Invoice Helper] Existing Invoice updated for booking ${booking.bookingId}. Invoice ID: ${invoice._id}. Payment Status: ${invoice.paymentStatus}.`);
        }
        return invoice;
    } catch (error) {
        console.error(`[Invoice Helper] Error creating/updating invoice for booking ${booking.bookingId}:`, error);
        throw error;
    }
}

/**
 * Hàm cập nhật trạng thái Booking và xử lý Invoice
 * @param {string} systemBookingId - bookingId của hệ thống
 * @param {Object} vnpayResponseParams - Các tham số nhận được từ VNPAY (đã xóa secureHash)
 * @param {boolean} paymentIsSuccess - True nếu giao dịch VNPAY thành công, False nếu thất bại
 * @param {number} amountFromVNPAY - Số tiền nhận từ VNPAY
 * @returns {Promise<Object>} - Trả về đối tượng { success: boolean, message: string, bookingStatus?: string, invoiceId?: string }
 */
async function updateBookingAndInvoiceStatus(systemBookingId, vnpayResponseParams, paymentIsSuccess, amountFromVNPAY) {
    try {
        const booking = await Booking.findOne({ bookingId: systemBookingId });

        if (!booking) {
            console.error(`[Booking/Invoice Helper] Booking not found for ID: ${systemBookingId}`);
            return { success: false, message: 'Booking not found.' };
        }

        if (booking.grandTotal !== amountFromVNPAY) {
            console.error(`[Booking/Invoice Helper] Amount mismatch for booking ${systemBookingId}. Expected ${booking.grandTotal}, got ${amountFromVNPAY}.`);
            // Mặc dù số tiền sai, nhưng nếu trạng thái vẫn PENDING, ta có thể đánh dấu thất bại hoặc cần xem xét
            // Ở đây, ta sẽ trả về lỗi để hệ thống xử lý, không cập nhật gì.
            return { success: false, message: 'Amount mismatch.' };
        }

        if (booking.status === 'PENDING_PAYMENT') {
            if (paymentIsSuccess) {
                booking.status = 'PAID';
                console.log(`[Booking Helper] Booking ${systemBookingId} status will be updated to PAID.`);
            } else {
                booking.status = 'FAILED';
                console.log(`[Booking Helper] Booking ${systemBookingId} status will be updated to FAILED.`);
            }
            await booking.save();
            console.log(`[Booking Helper] Booking ${systemBookingId} status successfully updated to ${booking.status}.`);

            const invoice = await createOrUpdateInvoice(
                booking,
                amountFromVNPAY,
                vnpayResponseParams,
                paymentIsSuccess ? 'success' : 'failed'
            );
            return { success: true, message: 'Booking and Invoice updated.', bookingStatus: booking.status, invoiceId: invoice._id };

        } else {
            console.warn(`[Booking Helper] Booking ${systemBookingId} already in status ${booking.status}. No update needed.`);
            return { success: true, message: 'Booking already processed.', bookingStatus: booking.status };
        }

    } catch (error) {
        console.error(`[Booking/Invoice Helper] Error processing transaction for booking ${systemBookingId}:`, error);
        if (error.name === 'ValidationError') {
            console.error('Mongoose Validation Error details:', error.message);
            for (let field in error.errors) {
                console.error(`Field ${field}: ${error.errors[field].message}`);
            }
        }
        return { success: false, message: 'Server error during update.' };
    }
}

// --- END HÀM HELPER ---


/**
 * @route POST /api/payment/create_payment_url
 * @desc Tạo URL thanh toán VNPAY cho một Booking
 * @access Private
 */
router.post('/create_payment_url', authMiddleware, async (req, res) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return res.status(400).json({ message: 'Booking ID is required.' });
        }

        const booking = await Booking.findOne({ bookingId: bookingId });

        if (!booking) {
            console.error(`Booking with ID ${bookingId} not found.`);
            return res.status(404).json({ message: 'Booking not found.' });
        }

        if (booking.status !== 'PENDING_PAYMENT') {
            console.error(`Booking ${bookingId} is not in PENDING_PAYMENT status. Current status: ${booking.status}`);
            return res.status(400).json({ message: 'Booking is not in PENDING_PAYMENT status or has been processed.' });
        }

        const amount = booking.grandTotal;
        const vnp_TxnRef = booking.bookingId;
        const orderDescription = `Thanh toan ve xem phim cho booking ${vnp_TxnRef}`;

        const { vnp_TmnCode, vnp_HashSecret, vnp_Url, vnp_ReturnUrlFrontend, vnp_IpnUrl } = VnPayConfig;

        if (!vnp_TmnCode || !vnp_HashSecret || !vnp_Url || !vnp_ReturnUrlFrontend || !vnp_IpnUrl) {
            console.error("VNPAY configuration is incomplete. Check VnPayConfig.js and .env file.");
            return res.status(500).json({ message: 'VNPAY configuration error. Please contact support.' });
        }

        let ipAddr = req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;

        if (ipAddr === '::1') {
            ipAddr = '127.0.0.1';
        }
        if (ipAddr && ipAddr.includes('::ffff:')) {
            ipAddr = ipAddr.split('::ffff:')[1];
        }

        const createDate = moment().format('YYYYMMDDHHmmss');
        const expireDate = moment().add(15, 'minutes').format('YYYYMMDDHHmmss');

        let vnp_Params = {};
        vnp_Params['vnp_Version'] = '2.1.0';
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = vnp_TmnCode;
        vnp_Params['vnp_Locale'] = 'vn';
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = vnp_TxnRef;
        vnp_Params['vnp_OrderInfo'] = orderDescription;
        vnp_Params['vnp_OrderType'] = 'billpayment';
        vnp_Params['vnp_Amount'] = amount * 100;
        vnp_Params['vnp_ReturnUrl'] = vnp_ReturnUrlFrontend;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = createDate;
        vnp_Params['vnp_ExpireDate'] = expireDate;

        vnp_Params = sortObject(vnp_Params);

        let hashData = '';
        let count = 0;
        for (let key in vnp_Params) {
            if (vnp_Params.hasOwnProperty(key)) {
                let value = vnp_Params[key];
                hashData += (count === 0 ? '' : '&') + key + '=' + encodeURIComponent(value).replace(/%20/g, '+');
                count++;
            }
        }

        const hmac = crypto.createHmac('sha512', vnp_HashSecret);
        const secureHash = hmac.update(hashData).digest('hex');

        vnp_Params['vnp_SecureHash'] = secureHash;

        const vnpUrlWithParams = vnp_Url + '?' + querystring.stringify(vnp_Params, { encode: true });

        console.log('--- VNPAY CREATE PAYMENT URL DEBUG ---');
        console.log('Final VNPAY URL:', vnpUrlWithParams);

        res.status(200).json({ paymentUrl: vnpUrlWithParams });

    } catch (error) {
        console.error('Error creating VNPAY payment URL:', error);
        res.status(500).json({ message: 'Server error: Failed to create payment URL.', error: error.message });
    }
});

/**
 * @route GET /api/payment/vnpay_return
 * @desc Xử lý VNPAY Return URL (sau khi người dùng thanh toán trên VNPAY)
 * @access Public
 */
router.get('/vnpay_return', async (req, res) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    let systemBookingId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];
    let transactionStatus = vnp_Params['vnp_TransactionStatus'];
    let amountFromVNPAY = vnp_Params['vnp_Amount'] / 100;

    let redirectUrl = `?vnp_ResponseCode=${rspCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${systemBookingId}`;
    //let redirectUrl = `${VnPayConfig.vnp_ReturnUrlFrontend}?vnp_ResponseCode=${rspCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${systemBookingId}`;

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType']; // Xóa cả vnp_SecureHashType nếu có

    vnp_Params = sortObject(vnp_Params);

    const { vnp_HashSecret } = VnPayConfig;

    let hashData = '';
    let count = 0;
    for (let key in vnp_Params) {
        if (vnp_Params.hasOwnProperty(key)) {
            let value = vnp_Params[key];
            hashData += (count === 0 ? '' : '&') + key + '=' + encodeURIComponent(value).replace(/%20/g, '+');
            count++;
        }
    }

    const hmac = crypto.createHmac('sha512', vnp_HashSecret);
    const signed = hmac.update(hashData).digest('hex');

    console.log('--- VNPAY RETURN URL DEBUG ---');
    console.log('Received Query Params (raw):', req.query);
    console.log('vnp_TxnRef (Booking ID):', systemBookingId);
    console.log('Received secureHash:', secureHash);
    console.log('Calculated secureHash:', signed);
    console.log('Hash Secret Used:', vnp_HashSecret);
    console.log('Raw Data String for Hashing (Return):', hashData);
    console.log('Comparison: Received === Calculated?', secureHash === signed); // Rất quan trọng!

    try {
        if (secureHash === signed) {
            // Chữ ký hợp lệ, tiến hành xử lý kết quả giao dịch
            const paymentIsSuccess = (rspCode === '00' && transactionStatus === '00');

            const updateResult = await updateBookingAndInvoiceStatus(
                systemBookingId,
                vnp_Params, // Gửi vnp_Params đã được xử lý (không bao gồm hash)
                paymentIsSuccess,
                amountFromVNPAY
            );
            if (updateResult.success) {
                redirectUrl = `?vnp_ResponseCode=${rspCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${systemBookingId || ''}`;
                //let redirectUrl = `${VnPayConfig.vnp_ReturnUrlFrontend}?vnp_ResponseCode=${rspCode}&vnp_TransactionStatus=${transactionStatus}&vnp_TxnRef=${systemBookingId}`;
                console.log(`[VNPAY Return] Successfully processed booking ${systemBookingId}. Redirecting to: ${redirectUrl}`);
            }
            if (!updateResult.success) {
                console.error(`[VNPAY Return] Failed to update booking/invoice for ${systemBookingId}: ${updateResult.message}`);
                redirectUrl = `${VnPayConfig.vnp_ReturnUrlFrontend}?vnp_ResponseCode=99&vnp_TransactionStatus=99&vnp_TxnRef=${systemBookingId || ''}`;
            }
            // else: Hàm updateBookingAndInvoiceStatus đã log chi tiết thành công/thất bại
            return res.status(200).json({
                message: updateResult.message || 'Payment processing complete.',
                code: rspCode, // Trả về responseCode từ VNPAY hoặc code nội bộ
                transactionStatus: transactionStatus, // Trả về transactionStatus từ VNPAY
                bookingId: systemBookingId,
                redirectUrl: redirectUrl // <-- Gửi URL này về cho frontend
            });

        } else {
            console.error('[VNPAY Return] Invalid Secure Hash. Signature mismatch. Cannot process transaction.');
            redirectUrl = `${VnPayConfig.vnp_ReturnUrlFrontend}?vnp_ResponseCode=97&vnp_TransactionStatus=97&vnp_TxnRef=${systemBookingId || ''}`;
        }

        res.redirect(redirectUrl);

    } catch (error) {
        console.error('[VNPAY Return] Error handling VNPAY return route:', error);
        res.redirect(`${VnPayConfig.vnp_ReturnUrlFrontend}?vnp_ResponseCode=99&vnp_TransactionStatus=99&vnp_TxnRef=${systemBookingId || ''}`);
    }
});


/**
 * @route GET /api/payment/vnpay_ipn
 * @desc Xử lý VNPAY IPN (Gọi từ VNPAY server-to-server để xác nhận giao dịch)
 * @access Public
 */
router.get('/vnpay_ipn', async (req, res) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    let systemBookingId = vnp_Params['vnp_TxnRef'];
    let rspCode = vnp_Params['vnp_ResponseCode'];
    let transactionStatus = vnp_Params['vnp_TransactionStatus'];
    let amountFromVNPAY = vnp_Params['vnp_Amount'] / 100;

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType']; // Xóa cả vnp_SecureHashType nếu có

    vnp_Params = sortObject(vnp_Params);

    const { vnp_HashSecret } = VnPayConfig;

    let hashData = '';
    let count = 0;
    for (let key in vnp_Params) {
        if (vnp_Params.hasOwnProperty(key)) {
            let value = vnp_Params[key];
            hashData += (count === 0 ? '' : '&') + key + '=' + encodeURIComponent(value).replace(/%20/g, '+');
            count++;
        }
    }

    const hmac = crypto.createHmac('sha512', vnp_HashSecret);
    const signed = hmac.update(hashData).digest('hex');

    let responseCode = '99'; // Mặc định lỗi không xác định
    let message = 'Unknown error';

    console.log('--- VNPAY IPN DEBUG ---');
    console.log('Received Query Params (raw):', req.query);
    console.log('vnp_TxnRef (Booking ID):', systemBookingId);
    console.log('Received secureHash:', secureHash);
    console.log('Calculated secureHash:', signed);
    console.log('Hash Secret Used:', vnp_HashSecret);
    console.log('Raw Data String for Hashing (IPN):', hashData);
    console.log('Comparison: Received === Calculated?', secureHash === signed); // Rất quan trọng!

    try {
        if (secureHash === signed) {
            const paymentIsSuccess = (rspCode === '00' && transactionStatus === '00');

            // const updateResult = await updateBookingAndInvoiceStatus(
            //     systemBookingId,
            //     vnp_Params, // Gửi vnp_Params đã được xử lý (không bao gồm hash)
            //     paymentIsSuccess,
            //     amountFromVNPAY
            // );

            // if (updateResult.success) {
            //     if (updateResult.message === 'Booking already processed.') {
            //         responseCode = '02'; // Order already confirmed
            //         message = 'Order already confirmed';
            //     } else {
            //         responseCode = '00'; // Success
            //         message = 'Confirm Success';
            //     }
            // } else {
            //     if (updateResult.message === 'Booking not found.') {
            //         responseCode = '01'; // Order not found
            //         message = 'Order not found';
            //     } else if (updateResult.message === 'Amount mismatch.') {
            //         responseCode = '04'; // Invalid amount
            //         message = 'Invalid amount';
            //     } else {
            //         responseCode = '99'; // Unknown error or other server errors
            //         message = 'Unknown error';
            //     }
            // }
        } else {
            responseCode = '97'; // Invalid signature
            message = 'Invalid signature';
            console.error('[VNPAY IPN] Invalid Secure Hash. Signature mismatch. Cannot process transaction.');
        }

        res.status(200).json({ RspCode: responseCode, Message: message });

    } catch (error) {
        console.error('[VNPAY IPN] Error handling VNPAY IPN route:', error);
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
});



module.exports = router;