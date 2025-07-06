const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware'); // Middleware xác thực người dùng
const adminMiddleware = require('../../middleware/adminMiddleware'); // Middleware kiểm tra quyền quản trị viên
const User = require('../../models/User');

// @route   GET /api/admin/Employee
// @desc    Lấy danh sách tất cả khách hàng
// @access  Private (Chỉ dành cho quản trị viên)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        console.log('Hard delete route hit for userId:');
        // Lấy danh sách tất cả người dùng có role là 'user'
        // .select('-password') để không trả về mật khẩu đã mã hóa vì lý do bảo mật.
        const Employee = await User.find({ role: { $in: ["employee", "admin"] } }).select('-password');

        res.status(200).json({
            message: 'Lấy danh sách nhân viên thành công.',
            Employee
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách ở đợ:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách ở đợ.');
    }
});

// // @route   GET /api/admin/customers/:id
// // @desc    Lấy thông tin chi tiết của một khách hàng theo ID
// // @access  Private (Chỉ dành cho quản trị viên)
// router.get('/:id', authMiddleware, adminMiddleware, async (req, res) => {
//     try {
//         // Tìm khách hàng theo ID
//         const customer = await Customer.findById(req.params.id).select('-password');

//         if (!customer) {
//             return res.status(404).json({ message: 'Không tìm thấy khách hàng.' });
//         }

//         res.status(200).json({
//             customer
//         });
//     } catch (error) {
//         console.error('Lỗi khi lấy thông tin khách hàng:', error.message);
//         res.status(500).send('Lỗi máy chủ khi lấy thông tin khách hàng.');
//     }
// });

// @route   POST /api/auth/register
// @desc    Đăng ký người dùng mới
// @access  Public
router.post('/new_employee', authMiddleware, adminMiddleware, async (req, res) => {
    // userId sẽ được tạo tự động bởi Mongoose model.
    // role sẽ được cố định là 'employee' ở đây, không lấy từ req.body.
    const { username, fullname, password, email, gender,date_of_birth , id_card, phone, address, is_actived, is_deleted } = req.body;

    try {
        // Kiểm tra các trường bắt buộc
        if (!username || !fullname || !password || !email) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên người dùng, họ tên, mật khẩu và email.' });
        }

        // Kiểm tra xem người dùng đã tồn tại chưa bằng username hoặc email
        let existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            let conflictField = existingUser.username === username ? 'Tên người dùng' : 'Email';
            return res.status(400).json({ message: `${conflictField} đã tồn tại.` });
        }

        const newEmployee = new User({
            id_card,
            username,
            fullname,
            password,
            email,
            gender,
            date_of_birth,
            phone,
            address,
            role: 'employee',
            is_actived,
            is_deleted
        });

        await newEmployee.save(); // Lưu nhân viên mới vào database

        res.status(201).json({
            message: 'Tạo tài khoản nhân viên thành công!',
        });

    } catch (error) {
        // Xử lý lỗi xác thực của Mongoose (ví dụ: email không hợp lệ, id_card/phone trùng lặp)
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: 'Dữ liệu không hợp lệ.', errors: errors });
        }
        // Xử lý lỗi trùng lặp khi id_card/phone cũng là unique
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const value = error.keyValue[field];
            return res.status(400).json({ message: `Lỗi trùng lặp: '${field}' với giá trị '${value}' đã tồn tại.` });
        }
        console.error('Lỗi khi tạo tài khoản nhân viên:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo tài khoản nhân viên.');
    }
});



// @route   DELETE /api/user-management/users/:userId/delete
// @desc    Xóa mềm người dùng (chuyển is_deleted = true)
// @access  Private (Chỉ Admin)
router.delete('/:userId/delete', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xóa.' });
        }

        if (user.is_deleted) {
            return res.status(400).json({ message: 'Người dùng này đã bị xóa mềm trước đó.' });
        }

        // Kiểm tra nếu admin cố gắng xóa chính tài khoản của mình
        if (req.user.id === user._id.toString()) {
            return res.status(400).json({ message: 'Bạn không thể tự hủy.' });
        }

        // Cập nhật trạng thái is_deleted thành true
        user.is_deleted = true;
        // Optionally, also deactivate the user when they are soft-deleted
        user.is_actived = false;
        await user.save();

        res.status(200).json({
            message: `Người dùng "${user.username}" đã được xóa mềm thành công.`,
            user: user // Trả về thông tin người dùng đã cập nhật
        });

    } catch (error) {
        console.error('Lỗi khi xóa mềm người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi xóa mềm người dùng.');
    }
});

router.patch('/:userId/role', authMiddleware, adminMiddleware, async (req, res) => {
    const { newRole } = req.body;

    // Kiểm tra tính hợp lệ của vai trò mới
    const allowedRoles = ['admin','employee'];
    if (!allowedRoles.includes(newRole)) {
        return res.status(400).json({ message: 'Vai trò không hợp lệ.' });
    }

    try {
        // Tìm người dùng bằng userId
        const user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để cập nhật vai trò.' });
        }

        // Cập nhật vai trò
        user.role = newRole;
        await user.save();

        res.status(200).json({
            message: `Vai trò của người dùng "${user.username}" đã được cập nhật thành "${newRole}".`,
            user: user // Trả về thông tin người dùng đã cập nhật (không bao gồm mật khẩu)
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật vai trò người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật vai trò người dùng.');
    }
});


// @route   DELETE /api/admin/employees/:userId/hard_delete
// @desc    Xóa VĨNH VIỄN người dùng theo userId
// @access  Private (Chỉ Admin)
// FIX: Đổi tên tuyến đường từ '/:userId/delete1' thành '/:userId/hard_delete' để khớp với frontend
router.delete('/:userId/hard_delete', authMiddleware, adminMiddleware, async (req, res) => {
    console.log('Backend: Hard delete route hit for userId:', req.params.userId);
    try {
        // Kiểm tra nếu admin cố gắng xóa chính tài khoản của mình
        // req.user.id là _id của người dùng đang đăng nhập (từ JWT)
        // user._id.toString() là _id của người dùng được tìm thấy trong DB
        // req.params.userId là userId tùy chỉnh (ví dụ: USER000000017)
        // Logic đúng phải so sánh _id (từ token) với _id của người dùng đang bị xóa
        const userToDelete = await User.findOne({ userId: req.params.userId });

        if (!userToDelete) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xóa.' });
        }

        if (req.user.id === userToDelete._id.toString()) {
            return res.status(400).json({ message: 'Bạn không thể tự hủy.' });
        }

        // Xóa VĨNH VIỄN người dùng khỏi database
        await User.findOneAndDelete({ userId: req.params.userId });

        res.status(200).json({
            message: `Người dùng "${userToDelete.username}" đã được xóa VĨNH VIỄN khỏi hệ thống.`,
        });

    } catch (error) {
        console.error('Lỗi khi xóa VĨNH VIỄN người dùng:', error.message);
        res.status(500).send('Lỗi máy chủ khi xóa người dùng.');
    }
});




router.patch('/:userId/role', authMiddleware, adminMiddleware, async (req, res) => {
    const { role } = req.body; // status sẽ là chuỗi 'true' hoặc 'false'

    // Chuyển đổi giá trị status từ chuỗi sang boolean
    let newroleStatus;
    if (role === 'admin') {
        newroleStatus = 'admin';
    } else if (role === 'employee') {
        newroleStatus = 'employee';
    } else {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    try {
        // Tìm người dùng bằng userId (đã được thêm vào User model)
        const user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để cập nhật trạng thái.' });
        }

        user.role = newroleStatus;
        await user.save();

        res.status(200).json({
            message: `Trạng thái hoạt động của nhân viên`,
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật quyền', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật quyền');
    }
});

module.exports = router;