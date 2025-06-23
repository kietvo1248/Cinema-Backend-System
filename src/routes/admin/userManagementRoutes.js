const express = require('express');
const router = express.Router();
const Customer = require('../../models/User'); // Import Customer model
const authMiddleware = require('../../middleware/authMiddleware'); // Middleware xác thực người dùng
const adminMiddleware = require('../../middleware/adminMiddleware'); // Middleware kiểm tra quyền quản trị viên
const User = require('../../models/User');

// @route   GET /api/admin/customers
// @desc    Lấy danh sách tất cả khách hàng
// @access  Private (Chỉ dành cho quản trị viên)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        // Lấy danh sách tất cả người dùng có role là 'user'
        // .select('-password') để không trả về mật khẩu đã mã hóa vì lý do bảo mật.
        const customers = await Customer.find({ role: "customer" }).select('-password');

        res.status(200).json({
            message: 'Lấy danh sách khách hàng thành công.',
            customers
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách khách hàng:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách khách hàng.');
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


module.exports = router;