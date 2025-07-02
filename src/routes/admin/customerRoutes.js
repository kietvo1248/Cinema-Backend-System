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




module.exports = router;