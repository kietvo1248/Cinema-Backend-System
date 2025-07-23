const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counter = require('./Counter'); // Import mô hình Counter để sử dụng bộ đếm số tuần tự

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,     
    },
    username: {
        type: String,
        // required: [true, 'Username là bắt buộc.'],
        trim: true, // Loại bỏ khoảng trắng ở đầu và cuối
        minlength: [3, 'Ít nhất phải 3 kí tự'], // Độ dài tối thiểu cho username
        maxlength: [20, 'Tối đa 20 kí tự'], // Độ dài tối đa cho username
        validate: {
        validator: v => !/\s/.test(v),
        message: 'Username không được chứa khoảng trắng.'
    }
    },
    fullname: { // Thêm trường fullname
        type: String,
        // required: true,
        trim: true,
        minlength: [3, 'Ít nhất phải 3 kí tự'], // Độ dài tối thiểu cho fullname
        maxlength: [50, 'Tối đa 50 kí tự'] // Độ dài tối đa cho fullname
    },
    password: {
        type: String,
        // required: true,
        minlength: [5, 'Ít nhất 5 kí tự'] // Độ dài tối thiểu cho mật khẩu

    },
    role: { // Thêm trường role
        type: String,
        enum: ['customer','employee', 'admin'], // Ví dụ: chỉ cho phép các giá trị 'user' hoặc 'admin'
        // default: 'user' // Mặc định là 'user' nếu không được cung cấp
    },
    email: { // Thêm trường email
        type: String,
        required: true,
        unique: [true, 'email đã tồn tại'], // Đảm bảo email là duy nhất
        trim: true,
        // lowercase: true, // Chuyển đổi email thành chữ thường
        validate: {
            validator: function(v) {
                return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v); // Kiểm tra định dạng email
            },
            message: props => `${props.value} không phải là một địa chỉ email hợp lệ!`
        }
    },
    date_of_birth: {
    type: Date,
    required: false // Đặt true nếu bạn muốn bắt buộc nhập ngày sinh
    },

    // datetime: {
    //     type: Date,
    //     default: Date.now // Tự động lưu thời gian tạo document
    // },
    gender: { //
        type: String,
        enum: ['male', 'female'],
        default: 'male'
    },
    id_card: { // Thêm trường id_card
        type: String,
        
        
        trim: true
    },
    phone: { // Thêm trường phone
        type: String,
        // required: true,
        unique: true, // Đảm bảo phone là duy nhất
        trim: true
    },
    address: { // Thêm trường address
        type: String,
        // required: true,
        trim: true
    },
    googleId: { // Thêm trường googleId để lưu trữ ID từ Google OAuth
        type: String,
        unique: true // Đảm bảo googleId là duy nhất
    },
    is_actived: { // Trường is_actived để đánh dấu người dùng đã kích hoạt hay chưa
        type: Boolean,
        default: true // Mặc định là true, có thể dùng để đánh dấu người dùng đã kích hoạt hay chưa
    },
    is_deleted: { // Thêm trường is_deleted
        type: Boolean,
        default: false
    },
    resetPasswordCode: String, //lưu mã đặt lại mật khẩu
    resetPasswordExpires: Date  // hạn sử dụng của mã
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    collection: 'users' // chỉnh sửa collection trong MongoDB ở đây
});

    userSchema.pre('save', async function(next) {
        if (this.isNew) {
        try {
            
            const counter = await Counter.findOneAndUpdate(
                { _id: 'userId' }, 
                { $inc: { seq: 1 } }, // Tăng giá trị seq lên 1
                { new: true, upsert: true } // Trả về document sau khi cập nhật, tạo mới nếu không tồn tại
            );

            // Định dạng userId: "USER" + số tuần tự (đảm bảo có 9 chữ số, thêm số 0 vào đầu nếu cần)
            this.userId = 'USER' + String(counter.seq).padStart(9, '0');
        } catch (error) {
            return next(error); // Chuyển lỗi nếu không thể tạo userId
        }
    }
    // Chỉ mã hóa mật khẩu nếu nó đã được sửa đổi (hoặc là mật khẩu mới)
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Tạo salt (một chuỗi ngẫu nhiên được thêm vào mật khẩu trước khi mã hóa)
        const salt = await bcrypt.genSalt(10); // 10 là số vòng mã hóa, càng cao càng an toàn nhưng chậm hơn
        // Mã hóa mật khẩu bằng salt
        this.password = await bcrypt.hash(this.password, salt);
        next(); // Chuyển sang middleware tiếp theo hoặc lưu document
    } catch (error) {
        next(error);
    }
});

// Phương thức để so sánh mật khẩu được cung cấp với mật khẩu đã mã hóa trong database
userSchema.methods.comparePassword = async function(candidatePassword) {
    // So sánh mật khẩu được nhập với mật khẩu đã mã hóa
    // Trả về true nếu khớp, false nếu không khớp
    return await bcrypt.compare(candidatePassword, this.password);
};

// Tạo và xuất (export) User Model
const User = mongoose.model('User', userSchema);

module.exports = User;


