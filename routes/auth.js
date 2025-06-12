const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import User model
const jwt = require('jsonwebtoken'); // Import jsonwebtoken để tạo và xác minh token
const authMiddleware = require('../middleware/authMiddleware'); // Import middleware xác thực JWT

// @route   POST /api/auth/register
// @desc    Đăng ký người dùng mới
// @access  Public
router.post('/register', async (req, res) => {
    // Lấy username, fullname, password, role từ req.body
    const { username, fullname, password, role, email, gender, id_card, phone, address, is_actived, is_deleted } = req.body;

    try {
        // Kiểm tra xem người dùng đã tồn tại chưa bằng username
        let existingUser = await User.findOne({ username });
        if (existingUser) { // Sửa lỗi: kiểm tra biến 'existingUser'
            return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' });
        }

        // Tạo người dùng mới với các trường được truyền vào
        // Mật khẩu sẽ được mã hóa tự động thông qua middleware 'pre-save' trong User model
        const newUser = new User({ username, fullname, password, role, email, gender, id_card, phone, address, is_deleted, is_actived });

        await newUser.save(); // Lưu người dùng mới vào database

        res.status(201).json({ message: 'Đăng ký người dùng thành công!' });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Lỗi máy chủ.');
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Tìm người dùng theo username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng.' });
        }
        // So sánh mật khẩu được cung cấp với mật khẩu đã mã hóa trong database
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Tên người dùng hoặc mật khẩu không đúng.' });
        }
        if (!user.is_actived) {
            return res.status(403).json({ message: 'Tài khoản chưa kích hoạt hoặc đã bị khóa.' });
        }
        // Tạo JWT token với thông tin người dùng
        const token = jwt.sign({ user: { id: user._id, username: user.username, role: user.role } }, process.env.JWT_SECRET, {
            expiresIn: '1h' // Token sẽ hết hạn sau 1 giờ
        });
        // Trả về token và thông tin người dùng
        res.status(200).json({
            token
            // user: {
            //     id: user._id,
            //     username: user.username,
            //     fullname: user.fullname,
            //     role: user.role
            // }
        });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Lỗi máy chủ.');
    }
});


    module.exports = router;
