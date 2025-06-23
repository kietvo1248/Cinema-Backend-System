const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Sử dụng thư viện uuid để tạo BookingID

const BookingSchema = new mongoose.Schema({
    // BookingID: Mã định danh duy nhất cho mỗi đặt vé, tự động tạo bằng UUID
    // Đây là BookingID mà người dùng yêu cầu, khác với _id mặc định của MongoDB
    bookingId: {
        type: String,
        default: uuidv4, // Tự động tạo UUID khi tạo mới
        unique: true,    // Đảm bảo tính duy nhất
        required: true
    },
    // MemberID: ID của người dùng đã đặt vé (từ JWT)
    memberId: {
        type: mongoose.Schema.Types.ObjectId, // Link trực tiếp đến ID của người dùng trong User model
        ref: 'User', // Tham chiếu đến collection 'users'
        required: true
    },
    // FullName, IDCard, PhoneNumber: Thông tin của người đặt vé tại thời điểm đặt (snapshot)
    // Có thể lấy từ User model khi tạo booking, nhưng lưu trữ độc lập để lịch sử không đổi nếu profile user thay đổi
    fullName: {
        type: String,
        required: true,
        trim: true // Loại bỏ khoảng trắng ở đầu/cuối
    },
    idCard: {
        type: String,
        required: true,
        trim: true,
        // Có thể thêm regex để validate định dạng CMND/CCCD nếu cần
    },
    phoneNumber: {
        type: String,
        required: true,
        trim: true,
        // Có thể thêm regex để validate định dạng số điện thoại nếu cần
    },
    // Movie: Tên phim được đặt
    movie: {
        type: String,
        required: true,
        trim: true
    },
    // Time: Thời gian chiếu phim (có thể bao gồm ngày và giờ)
    time: {
        type: Date,
        required: true
    },
    // Seat: Mảng chứa các mã ghế đã đặt (ví dụ: ['A1', 'A2', 'B5'])
    seats: { // Đổi tên thành 'seats' để rõ ràng hơn khi là mảng
        type: [String], // Mảng các chuỗi
        required: true,
        validate: {
            validator: function(v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Phải có ít nhất một ghế được chọn.'
        }
    },
    // Price: Tổng giá tiền của đặt vé
    price: {
        type: Number,
        required: true,
        min: 0 // Giá phải là số không âm
    },
    // Status: Trạng thái của đặt vé
    status: {
        type: String,
        enum: ['Pending', 'Agree', 'Disagree'], // Chỉ chấp nhận các giá trị này
        default: 'Pending' // Mặc định khi tạo mới là 'Pending'
    },
    // createdAt và updatedAt: Tự động quản lý thời gian tạo và cập nhật
}, { timestamps: true,
    collection: 'bookings' // Chỉ định tên collection trong MongoDB
 });

// Tạo chỉ mục cho các trường thường xuyên tìm kiếm để tối ưu hiệu suất
BookingSchema.index({ memberId: 1, createdAt: -1 }); // Tìm kiếm theo người dùng và thời gian
BookingSchema.index({ movie: 1, time: 1 });          // Tìm kiếm theo phim và thời gian
BookingSchema.index({ status: 1 });                  // Tìm kiếm theo trạng thái

module.exports = mongoose.model('Booking', BookingSchema);