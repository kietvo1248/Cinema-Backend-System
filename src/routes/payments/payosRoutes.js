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
// ==== HELPER ====
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




const processPaymentConfirmation = async (payosOrderCode, payosTransactionData) => {
    console.log(`[Helper] processPaymentConfirmation được gọi cho orderCode: ${payosOrderCode}`);
    try {
        let booking = await Booking.findOne({ payosOrderCode: payosOrderCode }).populate('user');

        if (!booking) {
            console.error(`[Helper] processPaymentConfirmation: Không tìm thấy Booking với PayOS orderCode ${payosOrderCode}.`);
            return { success: false, message: 'Booking không tìm thấy.' };
        }

        // Chỉ cập nhật nếu trạng thái booking chưa phải là 'PAID'
        if (booking.status !== 'PAID') {
            booking.status = 'PAID';
            //booking.payosTransaction = payosTransactionData; // Lưu đầy đủ dữ liệu giao dịch PayOS
            await booking.save();
            console.log(`[Helper] processPaymentConfirmation: Booking ${booking.bookingId || booking._id} đã được cập nhật thành PAID.`);

            // Kiểm tra và tạo Invoice mới chỉ khi chưa có
            const existingInvoice = await Invoice.findOne({ booking: booking._id });
            if (existingInvoice) {
                console.log(`[Helper] processPaymentConfirmation: Invoice đã tồn tại (${existingInvoice.invoiceId}) cho Booking ${booking.bookingId || booking._id}.`);
            } else {
                console.log(`[Helper] processPaymentConfirmation: Đang tạo Invoice mới cho Booking ${booking.bookingId || booking._id}...`);
                const newInvoice = new Invoice({
                    invoiceCode: `INV-${Date.now()}-${booking._id.toString().slice(-4)}`,
                    booking: booking._id,
                    bookingId: booking.bookingId,
                    userId: booking.user._id,
                    amount: booking.grandTotal,
                    paymentStatus: 'PAID',
                    paymentMethod: 'PAYOS',
                    payosDetails: {
                        orderCode: payosTransactionData.orderCode,
                        transactionId: payosTransactionData.transactionId || null,
                        amount: payosTransactionData.amount,
                        description: payosTransactionData.description,
                        status: payosTransactionData.status,
                        paidAt: new Date(),
                    }
                });
                await newInvoice.save();
                console.log(`[Helper] processPaymentConfirmation: Invoice ${newInvoice.invoiceCode} đã được tạo cho Booking ${booking.bookingId || booking._id}.`);
                // TODO: Gửi email xác nhận, thông báo...
            }
            return { success: true, message: 'Thanh toán thành công, booking đã được xác nhận và invoice đã tạo.' };
        } else {
            console.log(`[Helper] processPaymentConfirmation: Booking ${booking.bookingId || booking._id} đã là PAID. Bỏ qua xử lý.`);
            return { success: true, message: 'Thanh toán đã được xác nhận.' };
        }

    } catch (error) {
        console.error(`[Helper] processPaymentConfirmation: Lỗi xử lý xác nhận thanh toán cho ${payosOrderCode}:`, error.message);
        return { success: false, message: `Lỗi xử lý thanh toán: ${error.message}` };
    }
};

// --- Hàm xử lý khi thanh toán thất bại/hủy/hết hạn (idempotent) ---
// Hàm này sẽ cập nhật trạng thái booking thành CANCELLED/FAILED/EXPIRED
const processPaymentFailure = async (payosOrderCode, reason = 'CANCELLED') => {
    console.log(`[Helper] processPaymentFailure được gọi cho orderCode: ${payosOrderCode}`);
    try {
        let booking = await Booking.findOne({ payosOrderCode: payosOrderCode });

        if (!booking) {
            console.warn(`[Helper] processPaymentFailure: Không tìm thấy Booking với PayOS orderCode ${payosOrderCode} để xử lý thất bại.`);
            return { success: false, message: 'Booking không tìm thấy.' };
        }

        // Chỉ cập nhật nếu trạng thái booking chưa phải là 'PAID'
        if (booking.status !== 'PAID') {
            booking.status = reason.toUpperCase(); // Cập nhật trạng thái (CANCELLED, FAILED, EXPIRED)
            await booking.save();
            console.log(`[Helper] processPaymentFailure: Booking ${booking.bookingId || booking._id} đã được cập nhật thành ${reason.toUpperCase()}.`);
            return { success: true, message: `Thanh toán ${reason.toLowerCase()}, trạng thái booking đã cập nhật.` };
        } else {
            console.log(`[Helper] processPaymentFailure: Booking ${booking.bookingId || booking._id} đã là PAID. Bỏ qua xử lý thất bại.`);
            return { success: true, message: 'Thanh toán đã được xác nhận thành công.' };
        }

    } catch (error) {
        console.error(`[Helper] processPaymentFailure: Lỗi xử lý thất bại thanh toán cho ${payosOrderCode}:`, error.message);
        return { success: false, message: `Lỗi xử lý thất bại thanh toán: ${error.message}` };
    }
};

// ==== ROUTES ====
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

        const description = `BookingFilm:${booking.bookingId}`; // Mô tả chi tiết hơn
        //const description = `TestDonHang`; // Mô tả chi tiết hơn

        const { name: userName, email: userEmail } = booking.user;
        // Kiểm tra sự tồn tại của userName và userEmail
        if (!userName || !userEmail) {
            console.error('[ERROR] Missing buyerName or buyerEmail from booking.user');
            return res.status(400).json({ message: 'Thông tin người mua không đầy đủ.' });
        }

        // URL trả về và callback từ PayOS.
        // Giữ localhost như bạn đã chỉ ra, nhưng cần lưu ý về môi trường thực tế.
        const returnUrl = `${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${booking.bookingId}&payosOrderCode=${payosOrderCode}`;
        const cancelUrl = `${PAYOS_CONFIG.FRONTEND_URL}/payment-status?bookingId=${booking.bookingId}&payosOrderCode=${payosOrderCode}&status=cancelled`;
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
            // callbackUrl: callbackUrl
            // Thêm items nếu PayOS yêu cầu và có trong booking
            // items: booking.selectedCombos.map(combo => ({
            //     name: combo.name,
            //     quantity: combo.quantity,
            //     price: combo.price
            // })),
            // shippingAddress: booking.user.address, // Thêm địa chỉ vận chuyển nếu có
        };
        console.log('[DEBUG] orderData for signature:', orderData);
        // --- Tạo chữ ký cho yêu cầu PayOS ---
        // Dựa trên logic mới của bạn, signature được thêm vào body, không phải header x-checksum.
        const signature = createSignature(orderData, PAYOS_CONFIG.CHECKSUM_KEY);
        console.log('[PayOS] Created signature for order:', signature);

        // Chuẩn bị payload cho PayOS API
        const payosRequestPayload = {
            ...orderData,
            // callbackUrl: callbackUrl,
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
            booking.payosOrderCode = payosOrderCode; // Lưu orderCode của PayOS vào booking
            await booking.save(); // Lưu lại booking đã cập nhật vào database
            console.log(`[PayOS] Booking ${booking._id} updated with PayOS orderCode ${payosOrderCode}.`); // Lưu lại booking với thông tin payment link

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

/**
 * [GET] /api/payos/payment-link/:orderCode
 * Lấy thông tin chi tiết của một link thanh toán đã tạo.
 * PayOS API: GET /v2/payment-requests/{orderCode} (hoặc tương tự)
 */
router.get('/payment-link/:orderCode', async (req, res) => {
    console.log('[Route] GET /api/payos/payment-link/:orderCode được gọi.');
    const { orderCode } = req.params;

    if (!orderCode) {
        console.log('[Route] payment-link: Order Code là bắt buộc.');
        return res.status(400).json({ message: 'Order Code là bắt buộc.' });
    }

    try {
        const headers = {
            'x-client-id': PAYOS_CONFIG.CLIENT_ID,
            'x-api-key': PAYOS_CONFIG.API_KEY,
            'Content-Type': 'application/json'
        };

        // Giả định PayOS có endpoint GET /v2/payment-requests/{orderCode}
        const url = `${PAYOS_CONFIG.API_URL}/${orderCode}`;
        console.log(`[PayOS] Đang lấy thông tin link thanh toán cho Order Code: ${orderCode}`);
        console.log(`[DEBUG] Request URL: ${url}`);

        const payosResponse = await axios.get(url, { headers });
        const responseData = payosResponse.data;

        if (responseData && responseData.code === '00') {
            console.log(`[PayOS] Đã lấy thông tin link thanh toán thành công cho Order Code: ${orderCode}.`);
            //res.status(200).json(responseData.data);
            const payosTransactionData = responseData.data;
            const payosStatus = payosTransactionData.status;

            // Dựa vào trạng thái từ PayOS để cập nhật database
            let updateResult;
            if (payosStatus === 'PAID') {
                updateResult = await processPaymentConfirmation(orderCode, payosTransactionData);
            } else if (['CANCELLED', 'EXPIRED', 'FAILED'].includes(payosStatus)) { // handle lung tung xà beng
                updateResult = await processPaymentFailure(orderCode, payosStatus);
            } else {
                console.log(`[Route] Status '${payosStatus}' không yêu cầu cập nhật database.`);
                updateResult = { success: true, message: 'Không cần cập nhật.' };
            }
            
            if (!updateResult.success) {
                 console.error(`[Route] Lỗi khi cập nhật database: ${updateResult.message}`);
                 // Vẫn trả về thành công cho frontend để hiển thị trạng thái hiện tại
            }

            res.status(200).json(payosTransactionData);
        } else {
            console.error('Lỗi khi lấy thông tin link thanh toán từ PayOS:', responseData);
            res.status(404).json({ message: 'Không tìm thấy link thanh toán hoặc có lỗi xảy ra.', error: responseData });
        }

    } catch (error) {
        console.error(`Lỗi khi xử lý lấy thông tin link thanh toán ${orderCode}:`, error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            message: 'Lỗi hệ thống khi lấy thông tin link thanh toán.',
            error: error.response ? error.response.data : error.message
        });
    }
});

/**
 * [POST] /api/payos/payment-link/:orderCode/cancel
 * Hủy một link thanh toán chưa được hoàn thành.
 * PayOS API: POST /v2/payment-requests/{orderCode}/cancel (hoặc tương tự)
 */
router.post('/payment-link/:orderCode/cancel', async (req, res) => {
    console.log('[Route] POST /api/payos/payment-link/:orderCode/cancel được gọi.');
    const { orderCode } = req.params;

    if (!orderCode) {
        console.log('[Route] cancel-payment-link: Order Code là bắt buộc.');
        return res.status(400).json({ message: 'Order Code là bắt buộc.' });
    }

    try {
        const headers = {
            'x-client-id': PAYOS_CONFIG.CLIENT_ID,
            'x-api-key': PAYOS_CONFIG.API_KEY,
            'Content-Type': 'application/json'
        };

        const body = {}; // Gửi body rỗng nếu API không yêu cầu dữ liệu cụ thể để hủy
        const url = `${PAYOS_CONFIG.API_URL}/${orderCode}/cancel`; // Giả định endpoint
        console.log(`[PayOS] Đang hủy link thanh toán với Order Code: ${orderCode}`);

        const payosResponse = await axios.post(url, body, { headers });

        if (payosResponse.data && payosResponse.data.code === '00') {
            console.log(`[PayOS] Hủy link thanh toán thành công cho Order Code: ${orderCode}.`);
            // Cập nhật trạng thái booking trong DB của bạn thành CANCELLED
            // Sử dụng hàm helper để đảm bảo tính idempotent
            const result = await processPaymentFailure(orderCode, 'CANCELLED');
            if (!result.success) {
                console.warn(`[Route] cancel-payment-link: Cảnh báo: Lỗi cập nhật trạng thái booking sau khi hủy PayOS: ${result.message}`);
            }

            res.status(200).json(payosResponse.data.data);
        } else {
            console.error('Hủy link thanh toán thất bại từ PayOS API:', payosResponse.data);
            res.status(400).json({ message: 'Hủy link thanh toán thất bại.', error: payosResponse.data });
        }
    } catch (error) {
        console.error(`Lỗi khi xử lý hủy link thanh toán ${orderCode}:`, error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            message: 'Lỗi hệ thống khi hủy link thanh toán.',
            error: error.response ? error.response.data : error.message
        });
    }
});


/**
 * [POST] /api/payos/webhook
 * Xử lý webhook từ PayOS. Đây là tuyến quan trọng nhất để xác nhận thanh toán.
 * Payload của webhook bao gồm: { code, desc, data, signature }
 */
router.post('/webhook', async (req, res) => {
    console.log('[Route] POST /api/payos/webhook được gọi.');
    const webhookPayload = req.body;
    // PayOS có thể gửi checksum trong header 'x-checksum' hoặc trong body.
    // Dựa vào code trước đó của bạn, bạn đã kiểm tra header.
    // Tuy nhiên, tài liệu PayOS thường chỉ ra 'signature' trong body.
    // Nếu PayOS gửi cả hai, bạn nên ưu tiên 'signature' trong body nếu nó là một phần của payload được ký.
    const receivedChecksumFromHeader = req.headers['x-checksum'];

    console.log('[PayOS Webhook] Dữ liệu nhận được:', JSON.stringify(webhookPayload, null, 2));
    console.log('[PayOS Webhook] Checksum từ Header (nếu có):', receivedChecksumFromHeader);

    const { code, data, signature } = webhookPayload;

    if (!data || !signature) {
        console.warn('[PayOS Webhook] Thiếu trường "data" hoặc "signature" trong payload webhook.');
        // Trả về 200 để PayOS không gửi lại webhook, nhưng có thể log lỗi để debug
        return res.status(200).json({ message: 'Invalid payload: missing data or signature' });
    }

    try {
        // 1. XÁC MINH CHỮ KÝ WEBHOOK
        // Sử dụng hàm createSignature với dữ liệu 'data' và WEBHOOK_SECRET để xác minh
        const calculatedSignature = createSignature(data, PAYOS_CONFIG.WEBHOOK_SECRET);

        if (signature !== calculatedSignature) {
            console.warn('[PayOS Webhook] Chữ ký webhook không hợp lệ! Chữ ký nhận được:', signature, 'Chữ ký tính toán:', calculatedSignature);
            return res.status(200).json({ message: 'Invalid signature' });
        }
        console.log('[PayOS Webhook] Chữ ký hợp lệ.');

        // 2. XỬ LÝ DỮ LIỆU WEBHOOK
        const { orderCode, status } = data; // Lấy orderCode và status từ trường 'data' trong webhook payload

        // Tìm Booking bằng `payosOrderCode` đã lưu trước đó
        const booking = await Booking.findOne({ payosOrderCode: orderCode });

        if (!booking) {
            console.warn(`[PayOS Webhook] Không tìm thấy Booking cho orderCode ${orderCode}.`);
            return res.status(200).json({ message: 'Booking not found' });
        }
        console.log(`[PayOS Webhook] Đã tìm thấy Booking: ${booking.bookingId} với trạng thái hiện tại: ${booking.status}.`);

        // 3. CẬP NHẬT TRẠNG THÁI BOOKING VÀ TẠO INVOICE (Idempotency Check)
        // Chỉ xử lý nếu booking đang ở trạng thái chờ thanh toán hoặc chưa PAID
        if (booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING') { // Thêm 'PENDING' nếu là trạng thái khởi tạo
            if (code === '00' && status === 'PAID') {
                console.log(`[PayOS Webhook] Giao dịch thành công cho booking ${orderCode}. Kích hoạt xử lý xác nhận.`);
                await processPaymentConfirmation(orderCode, data); // Truyền toàn bộ data từ webhook
            } else {
                // Các trạng thái khác: CANCELLED, EXPIRED, FAILED
                console.log(`[PayOS Webhook] Giao dịch không thành công cho booking ${orderCode}. Trạng thái PayOS: ${status}, Mã lỗi: ${code}.`);
                await processPaymentFailure(orderCode, status); // Truyền trạng thái từ PayOS
            }
        } else {
            console.log(`[PayOS Webhook] Booking ${booking.bookingId} đã được xử lý trước đó hoặc không ở trạng thái chờ. Trạng thái hiện tại: ${booking.status}. Bỏ qua.`);
        }

        // Phản hồi thành công cho PayOS để họ không gửi lại webhook
        res.status(200).json({ message: 'Webhook processed successfully' });

    } catch (error) {
        console.error('[PayOS Webhook] Lỗi khi xử lý webhook:', error);
        // Luôn trả về 200 để PayOS không gửi lại webhook, tránh vòng lặp lỗi
        res.status(200).json({ message: 'Internal server error' });
    }
});


/**
 * [POST] /api/payos/confirm-webhook
 * API dùng để đăng ký hoặc cập nhật webhook URL với PayOS.
 * Bạn chỉ cần gọi API này một lần khi thiết lập hoặc khi thay đổi URL.
 * PayOS API: POST /v2/webhooks
 */
router.post('/confirm-webhook', async (req, res) => {
    console.log('[Route] POST /api/payos/confirm-webhook được gọi.');
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
        console.log('[Route] confirm-webhook: webhookUrl là bắt buộc.');
        return res.status(400).json({ message: 'webhookUrl là bắt buộc.' });
    }

    try {
        const headers = {
            'x-client-id': PAYOS_CONFIG.CLIENT_ID,
            'x-api-key': PAYOS_CONFIG.API_KEY,
            'Content-Type': 'application/json'
        };

        const body = { webhookUrl };
        const url = `${PAYOS_CONFIG.API_URL}/v2/webhooks`; // Endpoint đúng để đăng ký webhook
        console.log(`[PayOS] Đang đăng ký/cập nhật webhook URL: ${webhookUrl} tại ${url}`);

        const payosResponse = await axios.post(url, body, { headers });

        console.log(`[PayOS] Phản hồi từ confirm-webhook API:`, payosResponse.data);
        res.status(payosResponse.status).json(payosResponse.data);

    } catch (error) {
        console.error('Lỗi khi đăng ký/cập nhật webhook:', error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            message: 'Lỗi hệ thống khi đăng ký/cập nhật webhook.',
            error: error.response ? error.response.data : error.message
        });
    }
});


/**
 * [GET] /api/payos/status/:bookingId
 * Frontend sẽ gọi API này để kiểm tra trạng thái cuối cùng của booking sau khi
 * người dùng được điều hướng từ PayOS về website.
 * Endpoint này chỉ truy vấn trạng thái từ DB, không gọi PayOS API.
 */
router.get('/status/:bookingId', async (req, res) => {
    console.log('[Route] GET /api/payos/status/:bookingId được gọi.');
    const { bookingId } = req.params;

    try {
        // Tìm booking bằng bookingId của bạn (không phải _id của MongoDB)
        const booking = await Booking.findOne({ bookingId: bookingId }).populate('user'); // Populate user nếu cần thông tin user

        if (!booking) {
            console.log(`[Route] status: Booking ${bookingId} không tìm thấy.`);
            return res.status(404).json({ message: 'Booking không tìm thấy.' });
        }
        console.log(`[Route] status: Đã tìm thấy Booking ${bookingId}. Trạng thái: ${booking.status}.`);

        // Tìm invoice liên quan đến booking này (chỉ tồn tại nếu thanh toán thành công và webhook đã xử lý)
        const invoice = await Invoice.findOne({ booking: booking._id });

        res.status(200).json({
            bookingId: booking.bookingId,
            bookingStatus: booking.status,
            totalAmount: booking.grandTotal,
            paymentInfo: invoice ? {
                invoiceId: invoice.invoiceId,
                invoiceStatus: invoice.status,
                paymentMethod: invoice.paymentMethod,
                paidAt: invoice.payosDetails?.paidAt || invoice.createdAt,
                transactionId: invoice.payosDetails?.transactionId || null, // Thêm transactionId
                orderCode: invoice.payosDetails?.orderCode || null // Thêm orderCode
            } : null,
            message: invoice ? (invoice.status === 'PAID' ? 'Thanh toán thành công!' : `Hóa đơn: ${invoice.status}.`) : `Booking đang ở trạng thái ${booking.status}.`
        });
    } catch (error) {
        console.error('Lỗi khi lấy trạng thái booking/invoice:', error.message);
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy trạng thái.' });
    }
});

// --- Các tuyến redirect từ PayOS (giữ nguyên theo yêu cầu) ---
// Các tuyến này chỉ đơn giản là chuyển hướng người dùng về frontend
// Frontend sẽ gọi API /status/:bookingId để lấy trạng thái thực tế
router.get('/success', async (req, res) => {
    console.log('[Route] GET /api/payos/success được gọi (redirect từ PayOS).');
    const queryParams = new URLSearchParams(req.query).toString();
    console.log(`[Route] success: Chuyển hướng về frontend với query params: ${queryParams}`);
    res.redirect(`${PAYOS_CONFIG.FRONTEND_URL}/payment-status?${queryParams}`);
});

router.get('/cancel', async (req, res) => {
    console.log('[Route] GET /api/payos/cancel được gọi (redirect từ PayOS).');
    const queryParams = new URLSearchParams(req.query).toString();
    console.log(`[Route] cancel: Chuyển hướng về frontend với query params: ${queryParams}`);
    res.redirect(`${PAYOS_CONFIG.FRONTEND_URL}/payment-status?${queryParams}`);
});

module.exports = router;