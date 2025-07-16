const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: { type: String}, // Đảm bảo trường này có
    movieDetails: {
        movieId: { type: String },
        name: { type: String, required: true },
        image_url: { type: String },
        version: { type: String },
        running_time: { type: Number },
        genres: [{ type: String }],
        time: { type: Date, required: true },
        cinema_room: { type: String, required: true },
    },
    selectedSeats: [{ type: String, required: true }],
    totalSeatPrice: { type: Number, required: true },
    selectedCombos: [
        {
            comboId: { type: mongoose.Schema.Types.ObjectId, ref: 'Combo' },
            name: { type: String },
            quantity: { type: Number },
            price: { type: Number },
            imageUrl: { type: String }
        }
    ],
    totalComboPrice: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },

    user: {
        _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        username: { type: String },
        gender: { type: String },
        address: { type: String },
        id_card: { type: String }
    },
    status: {
        type: String,
        enum: ['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'COMPLETED', 'FAILED'], // Thêm 'FAILED'
        default: 'PENDING_PAYMENT',
    },
    // Thêm trường để lưu thời gian hết hạn của việc giữ chỗ
    expiresAt: {
        type: Date,
    },
    // Thêm trường paymentDetails để lưu thông tin từ VNPAY
    paymentDetails: {
        vnp_Amount: { type: Number },
        vnp_BankCode: { type: String },
        vnp_CardType: { type: String },
        vnp_OrderInfo: { type: String },
        vnp_PayDate: { type: String }, // YYYYMMDDHHmmss
        vnp_ResponseCode: { type: String },
        vnp_TmnCode: { type: String },
        vnp_TransactionNo: { type: String },
        vnp_TransactionStatus: { type: String },
        vnp_TxnRef: { type: String },
        vnp_SecureHash: { type: String },
        message: { type: String }, // Trường để lưu thêm thông tin lỗi nếu có
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    
},{
    collection: 'bookings'
});

// Thêm index để cron job truy vấn hiệu quả các booking hết hạn
bookingSchema.index({ status: 1, expiresAt: 1 });

bookingSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;