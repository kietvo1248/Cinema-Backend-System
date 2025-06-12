const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username là bắt buộc.'],
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
        required: true,
        trim: true,
        minlength: [3, 'Ít nhất phải 3 kí tự'], // Độ dài tối thiểu cho fullname
        maxlength: [50, 'Tối đa 50 kí tự'] // Độ dài tối đa cho fullname
    },
    password: {
        type: String,
        required: true,
        minlength: [5, 'Ít nhất 5 kí tự'] // Độ dài tối thiểu cho mật khẩu

    },
    role: { // Thêm trường role
        type: String,
        enum: ['user', 'admin'], // Ví dụ: chỉ cho phép các giá trị 'user' hoặc 'admin'
        default: 'user' // Mặc định là 'user' nếu không được cung cấp
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
        required: true,
        unique: true, // Đảm bảo id_card là duy nhất
        trim: true
    },
    phone: { // Thêm trường phone
        type: String,
        required: true,
        unique: true, // Đảm bảo phone là duy nhất
        trim: true
    },
    address: { // Thêm trường address
        type: String,
        required: true,
        trim: true
    },
    is_actived: { // Trường is_actived để đánh dấu người dùng đã kích hoạt hay chưa
        type: Boolean,
        default: true // Mặc định là true, có thể dùng để đánh dấu người dùng đã kích hoạt hay chưa
    },
    is_deleted: { // Thêm trường is_deleted
        type: Boolean,
        default: false
    }
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    collection: 'users' // chỉnh sửa collection trong MongoDB ở đây
});

    userSchema.pre('save', async function(next) {
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


