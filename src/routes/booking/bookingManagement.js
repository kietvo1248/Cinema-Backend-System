const express = require('express');
const router = express.Router();
const Booking = require('../../models/Booking');
const User = require('../../models/User'); // Cần User model để lấy thông tin FullName, IDCard, PhoneNumber
const authMiddleware = require('../../middleware/authMiddleware');
const adminMiddleware = require('../../middleware/adminMiddleware');


// @route   POST /api/bookings
// @desc    Tạo một đặt vé mới
// @access  Private (Chỉ người dùng đã đăng nhập)
router.post('/create', authMiddleware, async (req, res) => {
    // Lấy thông tin từ request body
    const { movie, time, seats, price } = req.body;

    try {
        // Lấy thông tin người dùng từ JWT (được gán bởi authMiddleware)
        const user = await User.findById(req.user.id).select('username fullname id_card phone');

        if (!user) {
            return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
        }

        // Tạo đối tượng đặt vé mới
        const newBooking = new Booking({
            memberId: req.user.id, // ID của người dùng đặt vé
            fullName: user.fullname,
            idCard: user.id_card,
            phoneNumber: user.phone,
            movie,
            time,
            seats,
            price,
            status: 'Pending' // Mặc định trạng thái là Pending
        });

        // Lưu đặt vé vào database
        await newBooking.save();

        res.status(201).json({
            message: 'Đặt vé thành công và đang chờ phê duyệt!',
            booking: newBooking
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: 'Dữ liệu đặt vé không hợp lệ.', errors: errors });
        }
        console.error('Lỗi khi tạo đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo đặt vé.');
    }
});

// @route   GET /api/bookings
// @desc    Tìm kiếm/Lấy danh sách đặt vé
// @access  Private (Người dùng xem đặt vé của mình, Admin xem tất cả hoặc tìm kiếm)
router.get('/', authMiddleware, async (req, res) => {
    try {
        let query = {};

        // Nếu là admin, admin có thể tìm kiếm theo memberId, movie, status
        if (req.user.role === 'admin') {
            if (req.query.memberId) {
                query.memberId = req.query.memberId;
            }
            if (req.query.status) {
                query.status = req.query.status;
            }
            if (req.query.movie) {
                query.movie = new RegExp(req.query.movie, 'i'); // Tìm kiếm không phân biệt chữ hoa/thường
            }
            // Thêm các bộ lọc khác nếu cần (ví dụ: thời gian chiếu)
            if (req.query.startDate && req.query.endDate) {
                query.time = {
                    $gte: new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                };
            }
        } else {
            // Nếu không phải admin, chỉ có thể xem các đặt vé của chính mình
            query.memberId = req.user.id;
            // Người dùng có thể lọc theo trạng thái của mình
            if (req.query.status) {
                query.status = req.query.status;
            }
            if (req.query.movie) {
                query.movie = new RegExp(req.query.movie, 'i');
            }
             if (req.query.startDate && req.query.endDate) {
                query.time = {
                    $gte: new Date(req.query.startDate),
                    $lte: new Date(req.query.endDate)
                };
            }
        }

        // Phân trang
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
                                      .skip(skip)
                                      .limit(limit)
                                      .sort({ createdAt: -1 }); // Sắp xếp theo thời gian tạo giảm dần

        const totalBookings = await Booking.countDocuments(query);

        res.status(200).json({
            message: 'Tìm kiếm đặt vé thành công.',
            total: totalBookings,
            page,
            limit,
            bookings
        });

    } catch (error) {
        console.error('Lỗi khi tìm kiếm đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi tìm kiếm đặt vé.');
    }
});

// @route   GET /api/bookings/:id
// @desc    Lấy thông tin chi tiết một đặt vé theo BookingID
// @access  Private (Người dùng chỉ có thể xem đặt vé của mình, Admin xem bất kỳ)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.id });

        if (!booking) {
            return res.status(404).json({ message: 'Không tìm thấy đặt vé.' });
        }

        // Kiểm tra quyền: Chỉ admin hoặc chủ sở hữu đặt vé mới có thể xem
        if (booking.memberId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Không có quyền truy cập đặt vé này.' });
        }

        res.status(200).json({
            message: 'Lấy thông tin đặt vé thành công.',
            booking
        });

    } catch (error) {
        console.error('Lỗi khi lấy thông tin đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy thông tin đặt vé.');
    }
});

// @route   PUT /api/bookings/:id
// @desc    Cập nhật thông tin đặt vé (chỉ Admin)
// @access  Private (Chỉ Admin)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { movie, time, seats, price, fullName, idCard, phoneNumber } = req.body; // Status sẽ được cập nhật qua tuyến riêng

    try {
        const booking = await Booking.findOne({ bookingId: req.params.id });

        if (!booking) {
            return res.status(404).json({ message: 'Không tìm thấy đặt vé để cập nhật.' });
        }

        // Cập nhật các trường (không cho phép cập nhật memberId, bookingId)
        if (movie !== undefined) booking.movie = movie;
        if (time !== undefined) booking.time = time;
        if (seats !== undefined) booking.seats = seats;
        if (price !== undefined) booking.price = price;
        if (fullName !== undefined) booking.fullName = fullName;
        if (idCard !== undefined) booking.idCard = idCard;
        if (phoneNumber !== undefined) booking.phoneNumber = phoneNumber;
        // Không cập nhật status ở đây, có tuyến riêng cho status

        await booking.save();

        res.status(200).json({
            message: 'Cập nhật thông tin đặt vé thành công.',
            booking
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ message: 'Dữ liệu cập nhật đặt vé không hợp lệ.', errors: errors });
        }
        console.error('Lỗi khi cập nhật đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật đặt vé.');
    }
});

// @route   PATCH /api/bookings/:id/status
// @desc    Phê duyệt/Thay đổi trạng thái đặt vé (chỉ Admin)
// @access  Private (Chỉ Admin)
router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    const { status } = req.body;

    // Kiểm tra trạng thái hợp lệ
    if (!status || !['Pending', 'Agree', 'Disagree'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ. Phải là Pending, Agree hoặc Disagree.' });
    }

    try {
        const booking = await Booking.findOne({ bookingId: req.params.id });

        if (!booking) {
            return res.status(404).json({ message: 'Không tìm thấy đặt vé để cập nhật trạng thái.' });
        }

        booking.status = status;
        await booking.save();

        res.status(200).json({
            message: `Trạng thái đặt vé đã được cập nhật thành "${status}".`,
            booking
        });

    } catch (error) {
        console.error('Lỗi khi cập nhật trạng thái đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật trạng thái đặt vé.');
    }
});


// @route   DELETE /api/bookings/:id
// @desc    Xóa một đặt vé (chỉ Admin)
// @access  Private (Chỉ Admin)
// router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
//     try {
//         const booking = await Booking.findOneAndDelete({ bookingId: req.params.id });

//         if (!booking) {
//             return res.status(404).json({ message: 'Không tìm thấy đặt vé để xóa.' });
//         }

//         res.status(200).json({ message: 'Đặt vé đã được xóa thành công.' });

//     } catch (error) {
//         console.error('Lỗi khi xóa đặt vé:', error.message);
//         res.status(500).send('Lỗi máy chủ khi xóa đặt vé.');
//     }
// });


module.exports = router;