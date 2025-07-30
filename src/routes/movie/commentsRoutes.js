const express = require('express');
const router = express.Router();
const Comment = require('../../models/Comment');

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: API quản lý bình luận phim
 */

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Lấy tất cả bình luận theo tên phim
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: movieName
 *         schema:
 *           type: string
 *         required: true
 *         description: Tên phim
 *     responses:
 *       200:
 *         description: Danh sách bình luận
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   movieName:
 *                     type: string
 *                   author:
 *                     type: string
 *                   message:
 *                     type: string
 *                   rating:
 *                     type: number
 *                   createdAt:
 *                     type: string
 *                   updatedAt:
 *                     type: string
 */
router.get('/', async (req, res) => {
  try {
    const { movieName, movieId } = req.query;

    let query = {};
    if (movieName) query.movieName = movieName;
    if (movieId) query.movieId = movieId;
    if (!movieName) {
      return res.status(400).json({ message: 'Thiếu tên phim (movieName)' });
    }

    const comments = await Comment.find(query).sort({ createdAt: -1 }); res.json(comments);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Gửi một bình luận mới
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - movieName
 *               - author
 *               - message
 *             properties:
 *               movieName:
 *                 type: string
 *               author:
 *                 type: string
 *               message:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Điểm đánh giá (1 đến 5 sao)
 *     responses:
 *       201:
 *         description: Tạo bình luận thành công
 */
router.post('/', async (req, res) => {
  try {
    const { movieName, movieId, author, message, rating } = req.body;

    if (!movieName || !movieId || !author || !message) {
      return res.status(400).json({ message: 'Thiếu thông tin cần thiết (movieName, movieId, author, message)' });
    }

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: 'Rating phải nằm trong khoảng từ 1 đến 5' });
    }

    const newComment = new Comment({ movieName, movieId, author, message, rating });
    await newComment.save();

    res.status(201).json(newComment);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});


/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Xóa bình luận theo ID
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của bình luận
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
// DELETE /api/comments/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body; // Gửi từ frontend

    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    if (comment.author !== username) {
      return res.status(403).json({ message: 'You can only delete your own comment' });
    }

    await Comment.findByIdAndDelete(id);
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


/**
 * @swagger
 * /api/comments/average-rating:
 *   get:
 *     summary: Tính điểm đánh giá trung bình của một bộ phim
 *     tags: [Comments]
 *     parameters:
 *       - in: query
 *         name: movieName
 *         schema:
 *           type: string
 *         required: true
 *         description: Tên phim
 *     responses:
 *       200:
 *         description: Điểm đánh giá trung bình
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 averageRating:
 *                   type: number
 *                   description: Điểm trung bình từ 1 đến 5
 */
router.get('/average-rating', async (req, res) => {
  try {
    const { movieName } = req.query;
    if (!movieName) {
      return res.status(400).json({ message: 'Thiếu tên phim (movieName)' });
    }

    const result = await Comment.aggregate([
      { $match: { movieName, rating: { $ne: null } } },
      { $group: { _id: '$movieName', averageRating: { $avg: '$rating' } } }
    ]);

    const avgRating = result.length > 0 ? result[0].averageRating : null;

    res.json({ averageRating: avgRating });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
});

module.exports = router;
