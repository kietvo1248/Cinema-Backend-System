const express = require('express');
const router = express.Router();
const User = require('../../models/User'); // Import User model
const jwt = require('jsonwebtoken'); // Import jsonwebtoken để tạo và xác minh token
const authMiddleware = require('../../middleware/authMiddleware'); // Import middleware xác thực JWT


// @route   GET /api/auth/users
// @desc    Hiển thị toàn bộ thông tin người dùng từ database (yêu cầu JWT hợp lệ)
// @access  Private

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        // req.user.id được gán từ authMiddleware sau khi xác minh JWT
        // Tìm người dùng theo ID và loại bỏ trường mật khẩu
        const user = await User.findById(req.user.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }

        // Trả về thông tin của người dùng đã đăng nhập
        res.status(200).json({
            message: 'Thông tin tài khoản đã đăng nhập:',
            user: user
        });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy dữ liệu người dùng.');
    }
});

// @route   PUT /api/auth/update-profile
// @desc    Cập nhật thông tin profile của người dùng đã đăng nhập
// @access  Private
router.put('/update-profile', authMiddleware, async (req, res) => {
    const { fullname, email, gender, id_card, phone, address, date_of_birth } = req.body;

    try {
        // check người dùng bằng jwt
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }

        // Cập nhật các trường nếu chúng được cung cấp trong request body
        if (fullname !== undefined) user.fullname = fullname;
        if (email !== undefined) user.email = email;
        if (gender !== undefined) user.gender = gender;
        if (id_card !== undefined) user.id_card = id_card;
        if (phone !== undefined) user.phone = phone;
        if (address !== undefined) user.address = address;
        if (date_of_birth !== undefined) user.date_of_birth = date_of_birth;

 
        await user.save();

        // Trả về thông tin người dùng đã cập nhật (không bao gồm mật khẩu)
        const updatedUser = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            message: 'Thông tin tài khoản đã được cập nhật thành công!',
            user: updatedUser
        });

    } catch (error) {
        // fix bug lỏd xác thực của Mongoose (ví dụ: email không hợp lệ, id_card/phone trùng lặp)
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: 'Lỗi xác thực khi cập nhật thông tin', errors: errors });
        }
        // Xử lý lỗi trùng lặp từ MongoDB (ví dụ: email/id_card/phone đã tồn tại)
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            return res.status(400).json({ message: `Lỗi trùng lặp: '${field}' với giá trị '${value}' đã tồn tại.` });
        }

        console.error('Lỗi khi cập nhật thông tin người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật thông tin.');
    }
});


module.exports = router;
