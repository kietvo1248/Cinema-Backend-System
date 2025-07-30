// import library
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Import jsonwebtoken để tạo và xác minh token
const authMiddleware = require('../../middleware/authMiddleware'); // Import middleware xác thực JWT
const adminMiddleware = require('../../middleware/adminMiddleware'); // Middleware kiểm tra quyền quản trị viên
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const { OAuth2Client } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid'); // Thư viện để tạo ID ngẫu nhiên

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

// Khởi tạo Google OAuth client
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID; // Client ID của bạn từ GCP
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// @route   POST /api/auth/register
// @desc    Đăng ký người dùng mới
// @access  Public
router.post('/register', async (req, res) => {
    // Lấy username, fullname, password, role, email, gender, id_card, phone, address, is_actived, is_deleted từ req.body
    const { userId, username, fullname, password, role, email, gender, date_of_birth, id_card, phone, address, is_actived, is_deleted } = req.body;

    try {
        // Kiểm tra xem người dùng đã tồn tại chưa bằng username
        let existingUser = await User.findOne({ username });
        if (existingUser) { // Sửa lỗi: kiểm tra biến 'existingUser'
            return res.status(400).json({ message: 'Tên người dùng đã tồn tại.' });
        }

        // Tạo người dùng mới với các trường được truyền vào
        // Mật khẩu sẽ được mã hóa tự động thông qua middleware 'pre-save' trong User model
        const newUser = new User({ userId, username, fullname, password, role: 'customer', email, gender, date_of_birth, id_card, phone, address, is_deleted, is_actived });

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
        const payload = {
            // Đảm bảo lấy ID từ user._id hoặc user.id (cả hai đều hoạt động)
            user: {
                userId: user._id, // <--- Đổi từ 'id: user.userId' thành 'userId: user._id'
                username: user.username,
                fullname: user.fullname, // <-- THÊM fullname vào đây
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
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
    const { fullname, email, gender, phone, date_of_birth } = req.body;

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }

        if (fullname !== undefined) user.fullname = fullname;
        if (email !== undefined) user.email = email;
        if (gender !== undefined) user.gender = gender;
        if (phone !== undefined) user.phone = phone;
        if (date_of_birth !== undefined) user.date_of_birth = date_of_birth;

        await user.save();

        const updatedUser = await User.findById(req.user.userId).select('-password');
        res.status(200).json({
            message: 'Thông tin tài khoản đã được cập nhật thành công!',
            user: updatedUser
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật thông tin người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật thông tin.');
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
    if (!newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: 'Làm ơn cung cấp mật khẩu mới và xác nhận mật khẩu mới.' });
    }
    if (newPassword.length < 5) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 5 ký tự.' });
    }
    // Kiểm tra newPassword và confirmNewPassword có khớp không
    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: 'Mật khẩu mới và xác nhận mật khẩu mới không khớp.' });
    }

    try {
        // Tìm người dùng bằng ID từ JWT (req.user.userId)
        // Dựa trên payload bạn cung cấp ở hàm login, userId được lưu trong req.user.userId
        const user = await User.findById(req.user.userId); // Sử dụng findById để tìm theo ID
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }

        // So sánh mật khẩu hiện tại với mật khẩu đã lưu trong DB
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng.' });
        }

        // Mã hóa mật khẩu mới trước khi lưu
        // Đảm bảo bạn đã import bcrypt ở đầu file nếu chưa có
        // const bcrypt = require('bcryptjs'); // Ví dụ import
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Lưu mật khẩu mới vào database
        user.password = newPassword;
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
        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = resetExpires;

        await user.save();

        let emailContent = form;
        emailContent = emailContent.replace('{{RESET_CODE}}', resetCode);

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
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


    } catch (error) {
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
                // id: user.userId
                userId: user._id, // Sử dụng _id để lấy ID người dùng
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
    const { newPassword, confirmPassword } = req.body;
    const resetToken = req.header('Authorization');

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
        const user = await User.findById(decoded.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tìm thấy.' });
        }
        user.password = newPassword;
        user.markModified('password');

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

// @route   PATCH /api/user-management/:userId/status
// @desc    Sửa trạng thái is_actived của người dùng (true/false)
// @access  Private (Chỉ Admin)
router.patch('/:userId/status', authMiddleware, adminMiddleware, async (req, res) => {
    const { status } = req.body; // status sẽ là chuỗi 'true' hoặc 'false'

    // Chuyển đổi giá trị status từ chuỗi sang boolean
    let newIsActivedStatus;
    if (status === 'true') {
        newIsActivedStatus = true;
    } else if (status === 'false') {
        newIsActivedStatus = false;
    } else {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    try {
        // Tìm người dùng bằng userId (đã được thêm vào User model)
        const user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để cập nhật trạng thái.' });
        }

        // Cập nhật trạng thái is_actived
        user.is_actived = newIsActivedStatus;
        await user.save();

        res.status(200).json({
            message: `Trạng thái hoạt động của người dùng đã được cập nhật thành "${newIsActivedStatus}".`,
            user: user // Trả về thông tin người dùng đã cập nhật
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái hoạt động của người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật trạng thái người dùng.');
    }
});


// Sử dụng Google Identity Services (GIS - Recommended):

// Là bộ thư viện mới nhất của Google, đơn giản hóa việc triển khai.

// Hỗ trợ cả One Tap Sign-in và tùy chỉnh nút đăng nhập.

// Frontend nhận ID token (JWT) trực tiếp từ Google sau khi người dùng đăng nhập.

// Frontend gửi ID token này đến backend.

// Backend xác minh ID token (rất quan trọng) và tạo session/JWT cho người dùng.

router.post('/google', async (req, res) => {
    const { idToken } = req.body; // ID token nhận từ frontend

    if (!idToken) {
        return res.status(400).json({ message: 'ID token is missing.' });
    }

    try {
        // 1. Xác minh ID token với Google
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const googleId = payload.sub; // ID duy nhất của người dùng Google
        const email = payload.email;
        const name = payload.name; // Tên đầy đủ
        const picture = payload.picture; // URL ảnh đại diện

        // Kiểm tra xem email đã được xác minh bởi Google chưa
        if (!payload.email_verified) {
            return res.status(401).json({ message: 'Google email not verified.' });
        }

        // 2. Tìm hoặc tạo người dùng trong cơ sở dữ liệu của bạn
        let user = await User.findOne({ googleId: googleId });

        if (!user) {
            // Trường hợp: Người dùng chưa tồn tại với googleId này
            // Kiểm tra xem email đã được đăng ký bằng phương pháp khác chưa (vd: đăng ký thường)
            let existingUserByEmail = await User.findOne({ email });

            if (existingUserByEmail) {
                // Email đã tồn tại nhưng chưa liên kết với Google ID này.
                return res.status(409).json({
                    message: 'Email này đã được đăng ký bằng một tài khoản khác. Vui lòng đăng nhập bằng mật khẩu hoặc liên kết tài khoản.',
                    linkAccount: true
                });
            }
            const temp_pass= uuidv4(); // Tạo mật khẩu tạm thời ngẫu nhiên
            // Nếu không có email và googleId nào tồn tại, tạo người dùng mới
            // KHÔNG CẦN GÁN userId Ở ĐÂY, middleware pre('save') sẽ lo!
            user = new User({
                googleId: googleId,
                username: null, // Sẽ là null vì không có từ Google
                password: temp_pass, // Sẽ là null vì không có mật khẩu
                email: email,
                fullname: name || email,
                gender: 'male', // Giá trị mặc định hoặc null
                date_of_birth: null,
                id_card: null,
                phone: null,
                address: null,
                role: 'customer', // Mặc định là customer
                is_actived: true,
                is_deleted: false,
                // profilePicture: picture, // Bỏ comment nếu muốn lưu ảnh đại diện
            });

            await user.save(); // Lưu người dùng mới vào database. userId sẽ được tạo tại đây.
            console.log(`[Google Auth] New user created: ${user.email} (userId: ${user.userId})`);

        } else {
            // Trường hợp: Người dùng đã tồn tại với googleId này
            // Cập nhật thông tin profile (tên, ảnh) nếu có thay đổi
            user.fullname = name || user.fullname;
            user.email = email;
            // user.profilePicture = picture || user.profilePicture; // Bỏ comment nếu muốn cập nhật ảnh
            await user.save();
            console.log(`[Google Auth] Existing user logged in: ${user.email} (userId: ${user.userId})`);
        }

        // 3. Tạo JWT cho người dùng trong hệ thống của bạn
        // Đảm bảo payload của JWT khớp với cấu trúc bạn mong đợi ở frontend (decoded.user.role)
        const googlePayload = {
            user: {
                googleId: user.googleId,
                userId: user._id, // Dùng userId đã được gán bởi middleware
                username: user.username,
                fullname: user.fullname,
                role: user.role
            }
        };

        // // Debugging JWT_SECRET và payload
        // console.log('DEBUG: googlePayload:', googlePayload);
        // console.log('DEBUG: Type of googlePayload:', typeof googlePayload);
        // console.log('DEBUG: process.env.JWT_SECRET:', JWT_SECRET); // Dùng JWT_SECRET biến cục bộ đã check type ở trên
        // console.log('DEBUG: Type of process.env.JWT_SECRET:', typeof JWT_SECRET);

        // if (typeof JWT_SECRET !== 'string' || !JWT_SECRET) {
        //     console.error('JWT_SECRET is not a valid string or is undefined!');
        //     return res.status(500).json({ message: 'Server configuration error: JWT secret is invalid.' });
        // }

        const token = jwt.sign(googlePayload, process.env.JWT_SECRET, { // Sử dụng biến cục bộ JWT_SECRET
            expiresIn: '1h'
        });

        // 4. Gửi JWT và thông tin người dùng về frontend
        res.status(200).json({
            message: 'Đăng nhập Google thành công',
            token,
            // Thêm thông tin user trực tiếp vào response để tiện cho frontend
            user: {
                fullname: user.fullname,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture // Bỏ comment nếu có lưu
            }
        });

    } catch (error) {
        console.error('Google ID token verification or processing failed:', error); // Log toàn bộ lỗi
        res.status(401).json({ message: 'Xác thực Google thất bại. Vui lòng thử lại.' });
    }
});



module.exports = router;
