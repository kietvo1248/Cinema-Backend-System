const express = require('express');
const router = express.Router();
const Movie = require('../../models/Movie'); 
const User = require('../../models/User');     
const authMiddleware = require('../../middleware/authMiddleware'); // Middleware xác thực người dùng

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


module.exports = router;