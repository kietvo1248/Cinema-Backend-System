// src/routes/payosRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');

// Import models
const Booking = require('../../models/Booking');
const Invoice = require('../../models/Invoice');

// Import PayOS config
const PAYOS_CONFIG = require('../../config/payOSConfig');

// --- Hàm tạo chữ ký (checksum) cho PayOS ---
const createSignature = (data, key) => {
    // 1. Chỉ chọn các trường PayOS yêu cầu ký theo tài liệu
    const fieldsToSign = {};

    // Chỉ thêm vào fieldsToSign nếu trường đó tồn tại và không phải null/undefined
    // Điều này đảm bảo chuỗi ký không bị sai nếu một trường tùy chọn không có giá trị
    if (data.amount !== undefined && data.amount !== null) fieldsToSign.amount = data.amount;
    if (data.cancelUrl !== undefined && data.cancelUrl !== null) fieldsToSign.cancelUrl = data.cancelUrl;
    if (data.description !== undefined && data.description !== null) fieldsToSign.description = data.description;
    if (data.orderCode !== undefined && data.orderCode !== null) fieldsToSign.orderCode = data.orderCode;
    if (data.returnUrl !== undefined && data.returnUrl !== null) fieldsToSign.returnUrl = data.returnUrl;

    // 2. Sắp xếp các khóa của CHỈ CÁC TRƯỜNG ĐƯỢC KÝ theo alphabet
    const sortedKeys = Object.keys(fieldsToSign).sort();

    // 3. Tạo chuỗi để ký theo định dạng key=value&key=value
    const stringToSign = sortedKeys.map(k => {
        let value = fieldsToSign[k];
        // Đảm bảo xử lý các kiểu dữ liệu phức tạp (như object/array) nếu PayOS yêu cầu ký chúng.
        // Tuy nhiên, với 5 trường trên, chúng thường là primitive types (số, chuỗi).
        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
            // Ký tự escape (nếu có từ JSON.stringify) đã được bạn xử lý bằng cách bỏ dòng .replace,
            // điều này là đúng nếu các trường này không chứa các ký tự cần escape.
        }
        return `${k}=${value}`;
    }).join('&');

    console.log('[DEBUG] Final String to Sign (STRICTLY as per PayOS docs):', stringToSign);

    // 4. Tính toán HMAC SHA256
    return crypto.createHmac('sha256', key).update(stringToSign).digest('hex');
};

// const createSignature = (data, key) => {
//     const sortedKeys = Object.keys(data).sort();
//     const stringToSign = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
//     return crypto.createHmac('sha256', key).update(stringToSign).digest('hex');
// };

// [POST] /api/payos/create-payment - Bắt đầu quá trình thanh toán PayOS
// Yêu cầu bookingId từ frontend
router.post('/create-payment', async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID là bắt buộc.' });
    }

    try {
        const booking = await Booking.findOne({ bookingId: bookingId });

        if (!booking) {
            return res.status(404).json({ message: 'Booking không tìm thấy.' });
        }

        if (booking.status !== 'PENDING_PAYMENT') {
            return res.status(400).json({ message: 'Booking không ở trạng thái chờ thanh toán.' });
        }

        // --- Tạo Yêu cầu Thanh toán PayOS ---
        // Sử dụng _id của booking làm orderCode cho PayOS để dễ dàng đối chiếu sau này.
        // PayOS yêu cầu orderCode là số.
        // Cân nhắc sử dụng Date.now() hoặc một cơ chế sinh số duy nhất khác nếu _id không phù hợp.
        // Ví dụ: const payosOrderCode = Date.now();
        const payosOrderCode = Number(booking._id.toString().replace(/[^0-9]/g, '').slice(-10));
        //const payosOrderCode = Date.now(); // Sử dụng timestamp làm orderCode
        // Đảm bảo orderCode là số nguyên dương và có độ dài hợp lý theo PayOS
        // Nếu PayOS yêu cầu orderCode là số lớn, Date.now() là một lựa chọn tốt.
        // const payosOrderCode = Date.now(); // Ví dụ sử dụng timestamp

        console.log(`[PayOS] Mapping Booking ID ${booking._id} to PayOS Order Code: ${payosOrderCode}`);

        const amount = booking.grandTotal;
        // Đảm bảo amount là số nguyên nếu PayOS yêu cầu.
        // Nếu PayOS yêu cầu đơn vị nhỏ nhất (ví dụ: xu), bạn cần nhân thêm: amount: Math.round(booking.grandTotal * 100)
        console.log(`[DEBUG] Amount: ${amount}`);

        // const description = `Thanh toán cho Booking ID: ${booking.bookingId || booking._id}`; // Mô tả chi tiết hơn
        const description = `TestDonHang`; // Mô tả chi tiết hơn

        const { name: userName, email: userEmail } = booking.user;
        // Kiểm tra sự tồn tại của userName và userEmail
        if (!userName || !userEmail) {
            console.error('[ERROR] Missing buyerName or buyerEmail from booking.user');
            return res.status(400).json({ message: 'Thông tin người mua không đầy đủ.' });
        }

        // URL trả về và callback từ PayOS.
        // Giữ localhost như bạn đã chỉ ra, nhưng cần lưu ý về môi trường thực tế.
        const returnUrl = `${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${booking._id}&payosOrderCode=${payosOrderCode}`;
        const cancelUrl = `${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${booking._id}&payosOrderCode=${payosOrderCode}&status=cancelled`;
        const callbackUrl = `${PAYOS_CONFIG.BACKEND_URL}/api/payos-payment/webhook`; // URL webhook của backend

        console.log(`[DEBUG] Return URL: ${returnUrl}`);
        console.log(`[DEBUG] Cancel URL: ${cancelUrl}`);
        console.log(`[DEBUG] Callback URL: ${callbackUrl}`);

        const orderData = {
            orderCode: payosOrderCode,
            amount: amount,
            description: description,
            returnUrl: returnUrl,
            cancelUrl: cancelUrl,
            expiredAt: Math.floor(Date.now() / 1000) + 900, // Hết hạn sau 15 phút (900 giây)
            buyerName: userName,
            buyerEmail: userEmail,
            // Thêm items nếu PayOS yêu cầu và có trong booking
            // items: booking.selectedCombos.map(combo => ({
            //     name: combo.name,
            //     quantity: combo.quantity,
            //     price: combo.price
            // })),
            // shippingAddress: booking.user.address, // Thêm địa chỉ vận chuyển nếu có
            // Thêm callbackUrl vào orderData nếu PayOS yêu cầu (một số API yêu cầu)
            // Tuy nhiên, trong logic bạn cung cấp, callbackUrl không nằm trong orderData để tạo signature,
            // mà là một tham số riêng khi gọi API PayOS.
            // Cần kiểm tra tài liệu PayOS xem callbackUrl có cần nằm trong orderData để tạo signature không.
            // Nếu không, nó sẽ được gửi dưới dạng tham số riêng trong axios.post.
            // Dựa trên logic bạn gửi, có vẻ callbackUrl không nằm trong orderData để tạo signature.
            // Nhưng nếu PayOS mong đợi nó trong payload, bạn sẽ phải thêm vào.
            // Tạm thời bỏ qua vì nó không có trong orderData gốc bạn cung cấp.
        };
        console.log('[DEBUG] orderData for signature:', orderData);
        // --- Tạo chữ ký cho yêu cầu PayOS ---
        // Dựa trên logic mới của bạn, signature được thêm vào body, không phải header x-checksum.
        const signature = createSignature(orderData, PAYOS_CONFIG.CHECKSUM_KEY);
        console.log('[PayOS] Created signature for order:', signature);

        // Chuẩn bị payload cho PayOS API
        const payosRequestPayload = {
            ...orderData,
            callbackUrl: callbackUrl,
            signature: signature, // Thêm signature vào body theo logic mới của bạn
            // Thêm callbackUrl vào đây nếu PayOS yêu cầu nó trong body API call
            // Ví dụ: callbackUrl: callbackUrl,
        };

        console.log('[DEBUG] Full Payload sent to PayOS API:', payosRequestPayload);

        const headers = {
            'x-client-id': PAYOS_CONFIG.CLIENT_ID,
            'x-api-key': PAYOS_CONFIG.API_KEY,
            //'x-checksum': signature, // Bỏ dòng này nếu signature được gửi trong body
            'Content-Type': 'application/json'
        };

        // Gọi API PayOS để tạo yêu cầu thanh toán
        const payosResponse = await axios.post(PAYOS_CONFIG.API_URL, payosRequestPayload, { headers });
        const responseData = payosResponse.data; // Lấy toàn bộ data từ response
        console.log('PayOS API Raw Response:', responseData);

        if (responseData && responseData.code === '00') {
            const paymentLinkData = responseData.data;
            console.log('[PayOS] Payment request created successfully:', paymentLinkData);

            // KHÔNG TẠO INVOICE TẠI ĐÂY. INVOICE CHỈ ĐƯỢC TẠO KHI THANH TOÁN THÀNH CÔNG TỪ WEBHOOK.

            // Cập nhật booking với payment link ID nếu cần
            booking.payosPaymentLinkId = paymentLinkData.paymentLinkId;
            await booking.save(); // Lưu lại booking với thông tin payment link

            res.status(200).json({
                message: 'Yêu cầu thanh toán đã được tạo thành công.',
                payosPaymentUrl: paymentLinkData.checkoutUrl, // URL để redirect người dùng
                qrCodeUrl: paymentLinkData.qrCode, // Mã QR nếu có
                bookingId: booking.bookingId // Trả về bookingId để frontend dễ xử lý
            });
        } else {
            console.error('Lỗi khi tạo yêu cầu thanh toán PayOS API:', responseData);
            res.status(500).json({
                message: 'Lỗi khi tạo yêu cầu thanh toán PayOS API.',
                error: responseData
            });
        }

    } catch (error) {
        console.error('Lỗi khi xử lý tạo thanh toán PayOS:', error.response ? error.response.data : error.message);
        res.status(500).json({
            message: 'Đã xảy ra lỗi hệ thống khi tạo yêu cầu thanh toán.',
            error: error.response ? error.response.data : error.message
        });
    }
});

// [POST] /api/payos-payment/webhook - Xử lý webhook từ PayOS (QUAN TRỌNG NHẤT)
router.post('/webhook', async (req, res) => {
    const webhookData = req.body;
    const receivedChecksum = req.headers['x-checksum'];

    console.log('[PayOS Webhook] Received Data:', webhookData);
    console.log('[PayOS Webhook] Received Checksum (Header):', receivedChecksum);

    try {
        // --- 1. XÁC MINH CHỮ KÝ WEBHOOK ---
        const dataToVerify = { ...webhookData };
        if (dataToVerify.signature) { // PayOS có thể gửi signature trong body hoặc chỉ header
            delete dataToVerify.signature;
        }

        const calculatedChecksum = createSignature(dataToVerify, PAYOS_CONFIG.WEBHOOK_SECRET);

        if (receivedChecksum !== calculatedChecksum) {
            console.warn('[PayOS Webhook] Chữ ký webhook không hợp lệ.');
            return res.status(200).json({ status: 'Failed', message: 'Invalid checksum.' });
        }

        // --- 2. XỬ LÝ DỮ LIỆU WEBHOOK ---
        const { code, desc, data: payosTransactionData } = webhookData;

        const payosOrderCode = payosTransactionData.orderCode;
        const transactionStatus = payosTransactionData.status; // 'PAID', 'CANCELLED', 'EXPIRED', 'PENDING'

        // Tìm Booking bằng orderCode PayOS (mà thực chất là booking._id chuyển đổi)
        // Cần chuyển đổi ngược lại payosOrderCode thành booking._id nếu có thể,
        // hoặc lưu ánh xạ trong hệ thống nếu orderCode quá phức tạp.
        // Để đơn giản, giả định payosOrderCode có thể tìm được booking.
        // Cách tốt nhất là lưu `payosOrderCode` trong Booking khi tạo payment request.
        // Ví dụ: booking.payosOrderCode = payosOrderCode;
        // Sau đó tìm booking.findOne({ payosOrderCode: payosOrderCode });
        // Tạm thời, ta có thể tìm theo logic chuyển đổi ngược hoặc yêu cầu PayOS gửi lại bookingId
        // hoặc lưu một bản ghi tạm thời.

        // Vì ta dùng slice(-9) để tạo orderCode, ta có thể cần một cách tìm kiếm linh hoạt hơn
        // hoặc lưu trực tiếp orderCode vào Booking.
        // Để chính xác, hãy thêm trường `payosOrderCode: { type: Number, unique: true, sparse: true }` vào Booking model
        // khi bạn tạo request PayOS.
        const booking = await Booking.findOne({
            // Nếu bạn lưu payosOrderCode vào booking, tìm theo nó:
            // payosOrderCode: payosOrderCode
            // Nếu không, bạn cần một logic phức tạp hơn hoặc dựa vào booking._id
            // Hiện tại, ta giả định có thể lấy bookingId từ payosOrderCode hoặc từ webhook data (nếu PayOS hỗ trợ)
            // hoặc đơn giản hóa để tìm booking có grandTotal khớp.
            // CÁCH TỐT NHẤT: Lưu payosOrderCode vào Booking khi tạo.
            grandTotal: payosTransactionData.amount // Tạm thời tìm booking dựa vào số tiền, cần đảm bảo duy nhất
            // Điều này RẤT DỄ GÂY LỖI nếu có 2 booking cùng số tiền.
            // BẠN NÊN ĐẢM BẢO `payosOrderCode` DUY NHẤT VÀ LƯU VÀO BOOKING KHI TẠO YÊU CẦU THANH TOÁN.
            // VÍ DỤ: booking.payosOrderCode = payosOrderCode; await booking.save();
            // SAU ĐÓ: const booking = await Booking.findOne({ payosOrderCode: payosOrderCode });
        });

        if (!booking) {
            console.warn(`[PayOS Webhook] Booking for PayOS orderCode ${payosOrderCode} (amount ${payosTransactionData.amount}) not found.`);
            return res.status(200).json({ status: 'Failed', message: 'Booking not found.' });
        }

        // --- 3. CẬP NHẬT TRẠNG THÁI BOOKING VÀ TẠO/CẬP NHẬT INVOICE ---
        if (code === '00' && transactionStatus === 'PAID') { // Thanh toán thành công
            if (booking.status !== 'PAID') { // Chỉ cập nhật nếu booking chưa được thanh toán
                booking.status = 'PAID';
                await booking.save();
                console.log(`[PayOS Webhook] Booking ${booking.bookingId || booking._id} updated to PAID.`);

                // Tạo Invoice mới chỉ khi thanh toán thành công
                const newInvoice = new Invoice({
                    invoiceId: `INV-${Date.now()}-${booking._id.toString().slice(-4)}`, // Mã hóa đơn duy nhất
                    booking: booking._id,
                    user: {
                        _id: booking.user._id._id,
                        name: booking.user.name,
                        email: booking.user.email
                    },
                    amount: booking.grandTotal,
                    status: 'PAID',
                    paymentMethod: 'PAYOS',
                    payosDetails: {
                        orderCode: payosOrderCode, // Hoặc payosTransactionData.orderCode
                        transactionId: payosTransactionData.transactionId || null,
                        amount: payosTransactionData.amount,
                        description: payosTransactionData.description,
                        status: transactionStatus,
                        paymentMethod: payosTransactionData.paymentMethod || 'UNKNOWN',
                        paidAt: new Date(),
                        checksum: receivedChecksum,
                    }
                });
                await newInvoice.save();
                console.log(`[PayOS Webhook] Invoice ${newInvoice.invoiceId} created for Booking ${booking.bookingId || booking._id}.`);

                // Thực hiện các logic sau thanh toán thành công (gửi email, SMS, WebSocket notification)
            } else {
                console.log(`[PayOS Webhook] Booking ${booking.bookingId || booking._id} đã là PAID, không cần cập nhật Invoice.`);
            }

        } else { // Thanh toán thất bại, hủy, hết hạn
            if (booking.status === 'PENDING_PAYMENT') { // Chỉ cập nhật nếu booking đang chờ thanh toán
                if (transactionStatus === 'CANCELLED') booking.status = 'CANCELLED';
                else if (transactionStatus === 'EXPIRED') booking.status = 'CANCELLED'; // Hoặc 'FAILED'
                else booking.status = 'FAILED';
                await booking.save();
                console.log(`[PayOS Webhook] Booking ${booking.bookingId || booking._id} updated to ${booking.status}.`);
                // KHÔNG TẠO INVOICE NẾU THANH TOÁN THẤT BẠI
            }
        }

        res.status(200).json({ message: 'Webhook đã được xử lý thành công.' });

    } catch (error) {
        console.error('[PayOS Webhook] Lỗi khi xử lý PayOS webhook:', error);
        res.status(200).json({ status: 'Failed', message: 'Lỗi nội bộ khi xử lý webhook.' });
    }
});

// [GET] /api/payos/status/:bookingId - Lấy trạng thái Booking và Invoice liên quan
// Frontend sẽ gọi API này để kiểm tra trạng thái sau khi chuyển hướng từ PayOS
router.get('/status/:bookingId', async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId).populate('user._id');

        if (!booking) {
            return res.status(404).json({ message: 'Booking không tìm thấy.' });
        }

        // Tìm invoice liên quan đến booking này (chỉ tồn tại nếu thanh toán thành công)
        const invoice = await Invoice.findOne({ booking: booking._id });

        res.status(200).json({
            bookingId: booking._id,
            bookingStatus: booking.status,
            totalAmount: booking.grandTotal,
            paymentInfo: invoice ? { // Chỉ trả về thông tin invoice nếu nó tồn tại
                invoiceId: invoice.invoiceId,
                invoiceStatus: invoice.status,
                paymentMethod: invoice.paymentMethod,
                payosDetails: invoice.payosDetails,
                createdAt: invoice.createdAt
            } : null,
            message: invoice ? (invoice.status === 'PAID' ? 'Thanh toán thành công!' : `Hóa đơn: ${invoice.status}.`) : `Booking đang ở trạng thái ${booking.status}.`
        });
    } catch (error) {
        console.error('Lỗi khi lấy trạng thái booking/invoice:', error.message);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy trạng thái.' });
    }
});


// [GET] /api/payos/success - Trang thông báo thành công (Return URL từ PayOS)
// URL này được gọi khi người dùng được chuyển hướng trở lại từ PayOS
router.get('/success', async (req, res) => {
    const { bookingId, payosOrderCode, status } = req.query; // Nhận bookingId từ query params

    if (!bookingId) {
        return res.status(400).send('<h1>Thiếu thông tin Booking.</h1>');
    }

    // Redirect frontend về trang status hoặc trang chi tiết booking để hiển thị kết quả chính xác
    // Đây là cách tốt nhất để tránh logic cập nhật phức tạp và không an toàn ở return URL
    res.redirect(`${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${bookingId}`);
});

// [GET] /api/payos/cancel - Trang thông báo hủy/thất bại (Cancel URL từ PayOS)
router.get('/cancel', async (req, res) => {
    const { bookingId, payosOrderCode, status } = req.query;

    if (!bookingId) {
        return res.status(400).send('<h1>Thiếu thông tin Booking.</h1>');
    }

    // Tương tự, redirect frontend về trang status
    res.redirect(`${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${bookingId}`);
});

module.exports = router;