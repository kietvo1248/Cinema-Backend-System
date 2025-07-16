const express = require('express');
const router = express.Router();
const Booking = require('../../models/Booking');
const User = require('../../models/User'); // Cần User model để lấy thông tin FullName, IDCard, PhoneNumber
const authMiddleware = require('../../middleware/authMiddleware');
const adminMiddleware = require('../../middleware/adminMiddleware');
const employeeMiddleware = require('../../middleware/employeeMiddleware');
const teamMiddleware = require('../../middleware/teamMiddleware');




// @route   GET /api/bookings
// @desc    Tìm kiếm/Lấy danh sách đặt vé
// @access  Private (Người dùng xem đặt vé của mình, Admin xem tất cả hoặc tìm kiếm)
router.get('/', authMiddleware, teamMiddleware, async (req, res) => {
    try {
        let query = {};

        // Apply filters based on query parameters
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.movie) {
            // Search by movie name within movieDetails
            query['movieDetails.name'] = new RegExp(req.query.movie, 'i');
        }
        if (req.query.startDate && req.query.endDate) {
            // Filter by booking time within movieDetails
            query['movieDetails.time'] = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }
        // Add more filters as needed, e.g., by cinema room, user email, etc.
        if (req.query.cinemaRoom) {
            query['movieDetails.cinema_room'] = new RegExp(req.query.cinemaRoom, 'i');
        }
        if (req.query.userEmail) {
            query['user.email'] = new RegExp(req.query.userEmail, 'i');
        }
        if (req.query.userName) {
            query['user.name'] = new RegExp(req.query.userName, 'i');
        }
        if (req.query.phoneNumber) {
            query['user.phone'] = new RegExp(req.query.phoneNumber, 'i');
        }


        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const bookings = await Booking.find(query)
                                        .skip(skip)
                                        .limit(limit)
                                        .sort({ createdAt: -1 }); // Sort by creation time descending

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


router.get('/search', authMiddleware, employeeMiddleware, async (req, res) => {
    try {
        const { fullname, phone } = req.query; // Get fullname and phone from query parameters

        if (!fullname && !phone) {
            return res.status(400).json({ message: 'Vui lòng cung cấp tên đầy đủ hoặc số điện thoại để tìm kiếm.' });
        }

        let query = {};

        // Build the query based on provided parameters
        if (fullname) {
            query['user.name'] = new RegExp(fullname, 'i'); // Case-insensitive search for user's name
        }
        if (phone) {
            query['user.phone'] = phone; // Exact match for phone number
        }

        const bookings = await Booking.find(query);

        if (bookings.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy đặt vé nào với thông tin đã cung cấp.' });
        }

        res.status(200).json({
            message: 'Tìm kiếm đặt vé thành công.',
            bookings: bookings // No need to filter by user role here
        });

    } catch (error) {
        console.error('Lỗi khi tìm kiếm đặt vé:', error.message);
        res.status(500).send('Lỗi máy chủ khi tìm kiếm đặt vé.');
    }
});

// // @route   PUT /api/bookings/:id
// // @desc    Cập nhật thông tin đặt vé (chỉ Admin)
// // @access  Private (Chỉ Admin)
// router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
//     const { movie, time, seats, price, fullName, idCard, phoneNumber } = req.body; // Status sẽ được cập nhật qua tuyến riêng

//     try {
//         const booking = await Booking.findOne({ bookingId: req.params.id });

//         if (!booking) {
//             return res.status(404).json({ message: 'Không tìm thấy đặt vé để cập nhật.' });
//         }

//         // Cập nhật các trường (không cho phép cập nhật memberId, bookingId)
//         if (movie !== undefined) booking.movie = movie;
//         if (time !== undefined) booking.time = time;
//         if (seats !== undefined) booking.seats = seats;
//         if (price !== undefined) booking.price = price;
//         if (fullName !== undefined) booking.fullName = fullName;
//         if (idCard !== undefined) booking.idCard = idCard;
//         if (phoneNumber !== undefined) booking.phoneNumber = phoneNumber;
//         // Không cập nhật status ở đây, có tuyến riêng cho status

//         await booking.save();

//         res.status(200).json({
//             message: 'Cập nhật thông tin đặt vé thành công.',
//             booking
//         });

//     } catch (error) {
//         if (error.name === 'ValidationError') {
//             const errors = {};
//             for (let field in error.errors) {
//                 errors[field] = error.errors[field].message;
//             }
//             return res.status(400).json({ message: 'Dữ liệu cập nhật đặt vé không hợp lệ.', errors: errors });
//         }
//         console.error('Lỗi khi cập nhật đặt vé:', error.message);
//         res.status(500).send('Lỗi máy chủ khi cập nhật đặt vé.');
//     }
// });

// // @route   PATCH /api/bookings/:id/status
// // @desc    Phê duyệt/Thay đổi trạng thái đặt vé (chỉ Admin)
// // @access  Private (Chỉ Admin)
// router.patch('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
//     const { status } = req.body;

//     // Kiểm tra trạng thái hợp lệ
//     if (!status || !['Pending', 'Agree', 'Disagree'].includes(status)) {
//         return res.status(400).json({ message: 'Trạng thái không hợp lệ. Phải là Pending, Agree hoặc Disagree.' });
//     }

//     try {
//         const booking = await Booking.findOne({ bookingId: req.params.id });

//         if (!booking) {
//             return res.status(404).json({ message: 'Không tìm thấy đặt vé để cập nhật trạng thái.' });
//         }

//         booking.status = status;
//         await booking.save();

//         res.status(200).json({
//             message: `Trạng thái đặt vé đã được cập nhật thành "${status}".`,
//             booking
//         });

//     } catch (error) {
//         console.error('Lỗi khi cập nhật trạng thái đặt vé:', error.message);
//         res.status(500).send('Lỗi máy chủ khi cập nhật trạng thái đặt vé.');
//     }
// });


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