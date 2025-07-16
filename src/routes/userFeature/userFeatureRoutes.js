const express = require('express');
const router = express.Router();
const Movie = require('../../models/Movie'); 
const User = require('../../models/User');     
const Booking = require('../../models/Booking'); // Import Booking model
const authMiddleware = require('../../middleware/authMiddleware'); // Middleware xác thực người dùng
const Room = require('../../models/Room');

// @route   GET /api/customer/movies
// @desc    Lấy danh sách các bộ phim và lịch chiếu có sẵn
// @access  Private (Người dùng đã đăng nhập)
// Query Params: search (tên phim), date (yyyy-mm-dd)
router.get('/search', async (req, res) => {
    const { search, date } = req.query; // 'date' here should ideally be a YYYY-MM-DD string
    let query = { is_deleted: false }; // Always exclude deleted movies

    try {
        if (search) {
            
            query.name = new RegExp(search, 'i');
        }

        if (date) {
            const searchDate = new Date(date);
            // Set time to 00:00:00.000 for accurate date comparison
            searchDate.setUTCHours(0, 0, 0, 0);

            // Movies must be showing on the requested date
            query.start_date = { $lte: searchDate };
            query.end_date = { $gte: searchDate };
        }

        // Fetch movies from the database based on the constructed query
        let movies = await Movie.find(query).select(
            'name production_company director actors running_time version cinema_room showtimes trailer_link type description start_date end_date image_url'
        );

        // Filter out movies that have no showtimes.
        // This is applied after the database query.
        movies = movies.filter(movie => movie.showtimes && movie.showtimes.length > 0);

        res.status(200).json({
            message: 'Lấy danh sách phim và lịch chiếu thành công.',
            movies
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách phim:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách phim.');
    }
});

router.get('/my-bookings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!userId) {
      return res.status(400).json({ message: 'User ID not found in token.' });
    }

    const bookings = await Booking.find({ 'user._id': userId }).sort({ createdAt: -1 });

    if (!bookings || bookings.length === 0) {
      return res.status(200).json([]);
    }

    // FORMAT VÉ CÓ roomName (tìm theo roomId)
    const formattedTickets = await Promise.all(bookings.map(async (booking) => {
      let roomName = booking.movieDetails.cinema_room;

      try {
        const room = await Room.findOne({ roomId: booking.movieDetails.cinema_room });
        if (room) {
          roomName = room.roomName;
        }
      } catch (err) {
        console.warn('Không tìm thấy roomName từ roomId:', err.message);
      }

      return {
        id: booking.bookingId || booking._id.toString(),
        movie: booking.movieDetails.name,
        date: new Date(booking.movieDetails.time).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }).replace(/ /g, ' '),
        time: new Date(booking.movieDetails.time).toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true
        }),
        status: booking.status === 'PAID' ? 'CONFIRMED' : booking.status,
        seats: booking.selectedSeats.join(', '),
        screen: booking.movieDetails.cinema_room, // Vẫn giữ để so sánh
        roomName: roomName, // ← frontend sẽ hiển thị giá trị này
        bookingDate: new Date(booking.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric'
        }).replace(/ /g, ' '),
        ticketPrice: `$${booking.grandTotal.toFixed(2)}`,
        imdb: 'N/A',
        duration: `${booking.movieDetails.running_time}m`,
        rawShowDate: booking.movieDetails.time
      };
    }));

    res.status(200).json(formattedTickets);

  } catch (error) {
    console.error('Error fetching booked tickets:', error);
    res.status(500).json({ message: 'Server error while fetching booked tickets.' });
  }
});

module.exports = router;