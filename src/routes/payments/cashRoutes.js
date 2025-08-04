const express = require('express');
const router = express.Router();
const Booking = require('../../models/Booking');
const Invoice = require('../../models/Invoice');
const authMiddleware = require('../../middleware/authMiddleware');
const employeeMiddleware = require('../../middleware/employeeMiddleware');

// [POST] /api/booking/cash-payment
// Endpoint để xử lý thanh toán bằng tiền mặt
// Yêu cầu xác thực và chỉ cho phép nhân viên/admin
router.post('/pay', authMiddleware, employeeMiddleware, async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId) {
        return res.status(400).json({ message: 'Booking ID là bắt buộc.' });
    }

    try {
        // 1. Tìm booking
        const booking = await Booking.findOne({bookingId}).populate('user._id');
        if (!booking) {
            return res.status(404).json({ message: 'Booking không tìm thấy.' });
        }

        // 2. Kiểm tra trạng thái booking
        if (booking.status === 'PAID') {
            return res.status(400).json({ message: 'Booking này đã được thanh toán.' });
        }
        // if (booking.status !== 'PENDING_PAYMENT') {
        //     return res.status(400).json({ message: 'Không thể thanh toán tiền mặt cho booking ở trạng thái này.' });
        // }

        // 3. Cập nhật trạng thái booking thành PAID
        booking.status = 'PAID';
        await booking.save();

        // 4. Tạo hóa đơn mới
        const newInvoice = new Invoice({
            // Sử dụng bookingId UUID để tạo mã hóa đơn
            invoiceCode: `INV-${Date.now()}-${booking.bookingId.slice(-4)}`,
            booking: booking._id, // Lưu ObjectId của booking
            bookingId: booking.bookingId, // Lưu bookingId (UUID)
            userId: booking.user._id, // Lấy userId từ booking
            amount: booking.grandTotal,
            paymentMethod: 'CASH',
            paymentStatus: 'success', // Giao dịch tiền mặt thành công luôn
            transactionDate: new Date()
        });
        await newInvoice.save();

        console.log(`[Cash Payment] Booking ${bookingId} updated to PAID and Invoice ${newInvoice.invoiceId} created.`);

        res.status(200).json({
            message: 'Thanh toán tiền mặt thành công.',
            invoice: newInvoice,
            booking: booking
        });

    } catch (error) {
        console.error('Lỗi khi xử lý thanh toán tiền mặt:', error);
        res.status(500).json({ message: 'Đã xảy ra lỗi hệ thống khi xử lý thanh toán.' });
    }
});

module.exports = router;