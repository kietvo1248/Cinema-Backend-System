const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import User model
const jwt = require('jsonwebtoken'); // Import jsonwebtoken để tạo và xác minh token
const authMiddleware = require('../middleware/authMiddleware'); // Import middleware xác thực JWT
const bcrypt = require('bcryptjs');

// @route   POST /api/auth/register
// @desc    Đăng ký người dùng mới
// @access  Public
router.post('/register', async (req, res) => {
    // Lấy username, fullname, password, role, email, gender, id_card, phone, address, is_actived, is_deleted từ req.body
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
        //Tạo JWT token với thông tin người dùng
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

        // // Nếu thông tin đăng nhập hợp lệ, tạo JWT
        //  const payload = {
        //     user: {
        //         id: user.id, // ID của người dùng
        //         username: user.username, // Username của người dùng
        //         fullname: user.fullname, // THÊM: fullname vào payload
        //         role: user.role // THÊM: role vào payload
        //     }
        // };

        // jwt.sign(
        //     payload,
        //     process.env.JWT_SECRET,
        //     { expiresIn: '1h' }, // Token sẽ hết hạn sau 1 giờ
        //     (err, token) => {
        //         if (err) throw err;
        //         res.json({ token }); // Trả về token cho client
        //     }
        // );

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Lỗi máy chủ.');
    }
});

// @route   GET /api/auth/users
// @desc    Hiển thị toàn bộ thông tin người dùng từ database (yêu cầu JWT hợp lệ)
// @access  Private

router.get('/profile', authMiddleware, async (req, res) => {
    try {
        // req.user.id được gán từ authMiddleware sau khi xác minh JWT
        // Tìm người dùng theo ID và loại bỏ trường mật khẩu
        const user = await User.findById(req.user.id).select('-password');
        
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


// @route   PUT /api/auth/change-password
// @desc    Đổi mật khẩu cho người dùng đã đăng nhập
// @access  Private
router.put('/change-password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    // Kiểm tra đầu vào
    if (!currentPassword) { 
        return res.status(400).json({ message: 'Làm ơn cung cấp mật khẩu hiện tại' });
    }
    if (!newPassword) {
        return res.status(400).json({ message: 'Làm ơn cung cấp mật khẩu mới và xác nhận mật khẩu mới.' });
    }
    if (!confirmNewPassword) {
        return res.status(400).json({ message: 'Làm ơn nhập lại mật khẩu giùm tao' });
    }
    if (newPassword.length < 5) {
        return res.status(400).json({ message: 'nhập ít nhất 5 ký tự.' });
    }
    // THAY ĐỔI Ở ĐÂY: Kiểm tra newPassword và confirmNewPassword có khớp không
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: 'Mật khẩu mới và xác nhận mật khẩu mới éo khớp.' });
    }

    try {
        // Tìm người dùng bằng ID từ JWT (req.user.id)
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng đéo tìm thấy.' });
        }

        // So sánh mật khẩu hiện tại với mật khẩu đã lưu trong DB
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
        }

        // const salt = await bcrypt.genSalt(10);
        // user.password = await bcrypt.hash(newPassword, salt);

        user.password = newPassword; // fix bug lỏd
        // Lưu mật khẩu mới vào database
        await user.save();

        res.status(200).json({ message: 'Mật khẩu đã được thay đổi thành công!' });

    } catch (error) {
        console.error('Lỗi khi đổi mật khẩu:', error.message);
        res.status(500).send('Lỗi máy chủ khi đổi mật khẩu.');
    }
});


// @route   PUT /api/auth/update-profile
// @desc    Cập nhật thông tin profile của người dùng đã đăng nhập
// @access  Private
router.put('/update-profile', authMiddleware, async (req, res) => {
    const { fullname, email, gender, id_card, phone, address } = req.body;

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

 
        await user.save();

        // Trả về thông tin người dùng đã cập nhật (không bao gồm mật khẩu)
        const updatedUser = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            message: 'Thông tin tài khoản đã được cập nhật thành công!',
            user: updatedUser
        });

    } catch (error) {
        // Xử lý lỗi xác thực của Mongoose (ví dụ: email không hợp lệ, id_card/phone trùng lặp)
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
