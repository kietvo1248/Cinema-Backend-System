const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true // Mỗi booking chỉ có một invoice
    },
    bookingId: { // Lưu bookingId từ UUID để dễ truy vấn
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    transactionDate: {
        type: Date,
        default: Date.now
    },
    paymentMethod: { // Phương thức thanh toán được sử dụng
        type: String,
        enum: ['NONE', 'VNPAY', 'PAYOS', 'CASH'],
        default: 'NONE'
    },
    paymentStatus: {
        type: String, // 'success', 'failed', 'pending', 'cancelled'
        required: true
    },
    vnpayDetails: { // Lưu trữ chi tiết phản hồi từ VNPAY
        vnp_Amount: Number,
        vnp_BankCode: String,
        vnp_CardType: String,
        vnp_OrderInfo: String,
        vnp_PayDate: String, // VNPAY trả về chuỗi YYYYMMDDHHmmss
        vnp_ResponseCode: String,
        vnp_TmnCode: String,
        vnp_TransactionNo: String,
        vnp_TransactionStatus: String,
        vnp_TxnRef: String,
        vnp_SecureHash: String,
        // Có thể thêm các trường khác nếu cần
    },
    payosDetails: { // Lưu trữ chi tiết phản hồi từ PayOS
        orderCode: { type: Number },
        transactionId: { type: Number }, // ID giao dịch từ PayOS (nếu có)
        amount: { type: Number },
        description: { type: String },
        status: { type: String }, // 'PAID', 'CANCELLED', 'FAILED', etc.
        paymentMethod: { type: String }, // 'VIETQR', 'ZALO_PAY', etc.
        paidAt: { type: Date }, // Thời gian thanh toán thành công
        checksum: { type: String }, // Chữ ký nhận được từ PayOS (tùy chọn)
        _id: false // Không tạo _id cho subdocument này
    },
    qrCodeDataUrl: String, // Nếu bạn muốn lưu QR Code
}, { timestamps: true,
    collection: 'invoices' });
const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;