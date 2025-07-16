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
    paymentMethod: {
        type: String,
        default: 'VNPAY'
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
    qrCodeDataUrl: String, // Nếu bạn muốn lưu QR Code
}, { timestamps: true,
    collection: 'invoices' });
const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;