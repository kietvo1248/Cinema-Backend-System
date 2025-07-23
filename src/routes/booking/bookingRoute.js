// src/routes/booking/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid'); // Import uuid để tạo bookingId duy nhất
const authMiddleware = require('../../middleware/authMiddleware'); // Đảm bảo đường dẫn đúng
const Booking = require('../../models/Booking'); // Import Booking Model
const mongoose = require('mongoose'); // Import mongoose để sử dụng trong hàm helper
const Room = require('../../models/Room'); // Import Room Model để cập nhật ghế đã đặt
const cron = require('node-cron');


//Hàm Helper

/*
 * @param {string} bookingId - The unique ID of the booking.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function updateOccupiedSeats(bookingId, statusToExpect = 'PENDING_PAYMENT') {
    try {
        const booking = await Booking.findOne({ bookingId: bookingId });

        if (!booking) {
            console.warn(`Booking ${bookingId} not found. Cannot update room seat.`);
            return { success: false, message: `Booking ${bookingId} not found.` };
        }

        if (booking.status !== statusToExpect) {
            console.warn(`Booking ${bookingId} status is '${booking.status}', not '${statusToExpect}'. Skipping room seat update.`);
            return { success: false, message: `Booking status is not ${statusToExpect}.` };
        }

        const roomId = booking.movieDetails.cinema_room;
        const showtime = booking.movieDetails.time;
        const seatLabels = booking.selectedSeats;

        if (!roomId || !showtime || !seatLabels || seatLabels.length === 0 || !bookingId) {
            console.error(`Missing data for updating room seats for booking ${bookingId}`);
            return { success: false, message: 'Missing essential data for seat update.' };
        }

        const newOccupiedSeats = seatLabels.map(label => ({
            seatLabel: label,
            bookingId: bookingId,
            showtime: showtime
        }));

        const result = await Room.updateOne(
            { roomId: roomId },
            { $addToSet: { occupiedSeats: { $each: newOccupiedSeats } } }
            // $addToSet prevents duplicate entries for the same seatLabel, bookingId, showtime if run multiple times
        );

        if (result.matchedCount === 0) {
            console.error(`Room with roomId ${roomId} not found for updating occupied seats.`);
            return { success: false, message: `Room ${roomId} not found.` };
        }

        if (result.modifiedCount > 0) {
            console.log(`Successfully added occupied seats for booking ${bookingId} to room ${roomId}`);
            return { success: true, message: `Seats for booking ${bookingId} marked as occupied.` };
        } else {
            console.log(`No new seats added to room ${roomId} for booking ${bookingId}. They might already be there.`);
            return { success: true, message: `Seats for booking ${bookingId} were already marked as occupied.` };
        }

    } catch (error) {
        console.error(`Error updating occupied seats for booking ${bookingId}:`, error);
        return { success: false, message: `Server error during seat update: ${error.message}` };
    }
}


// @route   POST /api/bookings/create
// @desc    Tạo một booking mới từ dữ liệu frontend (ít xác thực hơn)
// @access  Private (Cần xác thực người dùng)
router.post('/create', authMiddleware, async (req, res) => {
    try {
        // Lấy thông tin người dùng từ token (vẫn cần để gán booking cho user nào, ngay cả khi không dùng nó để lookup profile)
        const authenticatedUserId = req.user.userId;

        // Destructure dữ liệu từ req.body theo cấu trúc từ frontend
        const {
            movieDetails,
            selectedSeats,
            totalSeatPrice,
            selectedCombos = [], // Mặc định là mảng rỗng nếu không có
            totalComboPrice = 0, // Mặc định là 0 nếu không có
            grandTotal,
            user // Lấy toàn bộ thông tin người dùng từ payload frontend
        } = req.body;

        // --- BỎ QUA TOÀN BỘ XÁC THỰC CHI TIẾT TỪ FRONTEND (Tự xác thực từ phía front-end) ---


        // Kiểm tra cơ bản về sự tồn tại của dữ liệu cần thiết tối thiểu
        // if (!movieDetails || !movieDetails.movieId || !selectedSeats || selectedSeats.length === 0 || totalSeatPrice === undefined || totalSeatPrice < 0 || !grandTotal || !user || !user._id) {
        //     return res.status(400).json({ message: 'Missing essential booking data.' });
        // }

        // Tạo một bookingId duy nhất bằng uuidv4
        const uniqueBookingId = uuidv4();

        // Thiết lập thời gian hết hạn cho việc giữ chỗ (ví dụ: 10 phút)
        const EXPIRATION_TIME_MINUTES = 20;
        const expiresAt = new Date(Date.now() + EXPIRATION_TIME_MINUTES * 60 * 1000);

        const newBooking = new Booking({
            bookingId: uniqueBookingId, // Gán bookingId duy nhất
            movieDetails: {
                movieId: movieDetails.movieId,
                name: movieDetails.name,
                image_url: movieDetails.imageUrl, // Frontend gửi imageUrl, model là image_url
                version: movieDetails.version,
                running_time: movieDetails.runningTime,
                genres: movieDetails.genres,
                time: movieDetails.time, // ISO string
                cinema_room: movieDetails.cinema_room,
            },
            selectedSeats: selectedSeats,
            totalSeatPrice: totalSeatPrice,
            selectedCombos: selectedCombos.map(combo => ({ // Vẫn map để đảm bảo cấu trúc phù hợp với schema
                comboId: combo.comboId,
                name: combo.name,
                quantity: combo.quantity,
                price: combo.price,
                imageUrl: combo.imageUrl
            })),
            totalComboPrice: totalComboPrice, // Sử dụng giá trị từ frontend (ít xác thực hơn)
            grandTotal: grandTotal, // Sử dụng giá trị từ frontend (ít xác thực hơn)
            // SỬ DỤNG TRỰC TIẾP ĐỐI TƯỢNG USER TỪ PAYLOAD
            user: {
                _id: user._id || authenticatedUserId, // Ưu tiên _id từ payload, nếu không có thì dùng từ token
                name: user.name,
                email: user.email,
                phone: user.phone,
                username: user.username,
                gender: user.gender,
                address: user.address,
                id_card: user.id_card,
            },
            status: 'PENDING_PAYMENT', // Đặt trạng thái ban đầu cho booking
            expiresAt: expiresAt // Gán thời gian hết hạn
        });

        const booking = await newBooking.save();

        // Cập nhật ghế đã chiếm dụng trong Room model
        const updateResult = await updateOccupiedSeats(booking.bookingId, 'PENDING_PAYMENT');
        if (!updateResult.success) {
            console.error(`Failed to update occupied seats for booking ${booking.bookingId}: ${updateResult.message}`);
            // Tùy chọn: Xử lý lỗi ở đây, ví dụ: hủy booking nếu không thể cập nhật ghế
        }
        res.status(201).json({ message: `Booking created successfully! It will expire in ${EXPIRATION_TIME_MINUTES} minutes.`, booking });
    } catch (error) {
        console.error('Error creating booking:', error);
        // Xử lý lỗi trùng lặp bookingId nếu có (rất hiếm với uuidv4)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.bookingId) {
            return res.status(409).json({ message: 'A booking with this ID already exists. Please try again.' });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

async function removeOccupiedSeats(bookingId) {
    try {
        const booking = await Booking.findOne({ bookingId: bookingId });

        if (!booking) {
            console.warn(`Booking ${bookingId} not found. Cannot remove occupied seats.`);
            return { success: false, message: `Booking ${bookingId} not found.` };
        }

        const roomId = booking.movieDetails.cinema_room;
        const showtime = booking.movieDetails.time;
        const seatLabels = booking.selectedSeats;

        const result = await Room.updateOne(
            { roomId: roomId },
            { $pull: { occupiedSeats: { bookingId: bookingId } } }
        );

        if (result.matchedCount === 0) {
            console.error(`Room with roomId ${roomId} not found for removing occupied seats.`);
            return { success: false, message: `Room ${roomId} not found.` };
        }
        console.log(`Successfully removed occupied seats for booking ${bookingId} from room ${roomId}`);
        return { success: true, message: `Occupied seats for booking ${bookingId} removed.` };

    } catch (error) {
        console.error(`Error removing occupied seats for booking ${bookingId}:`, error);
        return { success: false, message: `Server error during seat removal: ${error.message}` };
    }
}

// hàm helper này tự chạy, khỏi gọi
// Cron job để hủy các booking chưa thanh toán sau x phút
cron.schedule('*/20 * * * *', async () => {
    try {
        const expired = new Date(Date.now() - 20 * 60 * 1000);
        const result = await Booking.updateMany(
            { status: 'PENDING_PAYMENT', createdAt: { $lte: expired } },
            { status: 'CANCELLED' },
        );
        // remove occupied seats
        await Promise.all(
            (await Booking.find({ status: 'CANCELLED', createdAt: { $lte: expired } })).map(booking => removeOccupiedSeats(booking.bookingId))
        );
        console.log(`Cron job: Updated ${result.modifiedCount} bookings to CANCELLED.`);
    } catch (error) {
        console.error('Cron job error:', error);
    }
});


module.exports = router;