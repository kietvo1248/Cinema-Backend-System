// import library
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Import jsonwebtoken để tạo và xác minh token
const authMiddleware = require('../../middleware/authMiddleware'); // Import middleware xác thực JWT
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 
const dotenv = require('dotenv'); 
// import model
const User = require('../../models/User'); // Import User model
const form = require('../authentication/view/forgotPasswordForm');

dotenv.config(); 

// Cấu hình Nodemailer transporter(không được sờ)
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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
            return res.status(404).json({ message: 'Người dùng méo tìm thấy.' });
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

// @route   POST /api/auth/forgot-password
// @desc    Gửi email đặt lại mật khẩu
// @access  Public
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Tìm người dùng theo email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }
        // tạo mã
        const resetCode = Math.floor(10000 + Math.random() * 90000).toString(); // random 5 số
        const resetExpires = Date.now() + 10 * 60 * 1000; // Đặt thời gian hết hạn cho mã

        // 4. Lưu mã và thời gian hết hạn vào người dùng
        User.resetPasswordCode = resetCode;
        User.resetPasswordExpires = resetExpires;
        await User.save();

        let emailContent = form;
        emailContent = emailContent.replace('{{resetCode}}', resetCode);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: User.email,
            subject: 'Mã đặt lại mật khẩu của bạn',
            html: emailContent
        };
        // Gửi email với mã đặt lại mật khẩu
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Lỗi khi gửi email:', error);
                return res.status(500).json({ message: 'Lỗi máy chủ khi gửi email.' });
            }
            res.status(200).json({ message: 'Mã đặt lại mật khẩu đã được gửi đến email của bạn.' });
        });


    }catch (error) {
        console.error('Lỗi khi yêu cầu đặt lại mật khẩu:', error.message);
        res.status(500).send('Lỗi máy chủ.');
    }


});
// @route   POST /api/auth/verify-reset-code
// @desc    Xác minh mã đặt lại mật khẩu và cung cấp token tạm thời
// @access  Public
router.post('/verify-reset-code', async (req, res) => {
    const { email, resetCode } = req.body;
    try {
        const user = await User.findOne({
            email,
            resetPasswordCode: resetCode,
            resetPasswordExpires: { $gt: Date.now() } //nếu mã chua hết hạn == true , nếu mã đã hết hạn == false (mày cút)
        });

        if (!user) {
            return res.status(400).json({ message: 'Mã xác minh không hợp lệ hoặc đã hết hạn.' }); //hết hạn r
        }

        // Mã hợp lệ, tạo một jwt tạm thời cho phép người dùng đặt lại mật khẩu
        // Token này chỉ dùng để xác thực cho bước reset-password
        const resetTokenPayload = {
            user: {
                id: user.id
            }
        };

        const resetToken = jwt.sign(
            resetTokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '10m' } // hết hạn trong 10min
        );

        res.status(200).json({ message: 'Mã xác minh thành công.', resetToken });

    } catch (error) {
        console.error('Lỗi khi xác minh mã đặt lại mật khẩu:', error.message);
        res.status(500).send('Lỗi máy chủ.');
    }
});

// @route   POST /api/auth/reset-password
// @desc    Đặt lại mật khẩu mới cho người dùng
router.post('/reset-password', async (req, res) => {
    const { newPassword, confirmPassword} = req.body;
    const { resetToken } = req.headers;

    if (!resetToken) {
        return res.status(401).json({ message: 'Không có token đặt lại mật khẩu. Vui lòng thực hiện lại quy trình quên mật khẩu.' });
    }

    // bước dưới tương tự như reset password
    if (!newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu mới và xác nhận mật khẩu mới.' });
    }
    if (newPassword.length < 5) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 5 ký tự.' });
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Mật khẩu mới và xác nhận mật khẩu mới không khớp.' });
    }

    try {
        // Xác minh resetToken (tương tự authMiddleware nhưng không cần gán req.user)
        const actualResetToken = resetToken.startsWith('Bearer ') ? resetToken.slice(7, resetToken.length) : resetToken;
        const decoded = jwt.verify(actualResetToken, process.env.JWT_SECRET);
        
        // Tìm người dùng bằng ID từ payload của resetToken
        const user = await User.findById(decoded.user.id);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }
        user.password = newPassword;
        // không xài nữa thì vứt
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Mật khẩu đã được đặt lại thành công!' });

        } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.' });
        }
        console.error('Lỗi khi đặt lại mật khẩu:', error.message);
        res.status(500).send('Lỗi máy chủ.');
    }
});



module.exports = router;
