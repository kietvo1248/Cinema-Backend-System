const express = require('express');
const router = express.Router();
const Movie = require('../../models/Movie');
const bucket = require('../../config/cosmic');
const MovieNews = require('../../models/MovieNews');

/**
 * @swagger
 * /api/home:
 *   get:
 *     tags:
 *       - Home
 *     summary: Lấy dữ liệu tổng hợp cho trang chủ
 *     description: Trả về banner, phim đang chiếu, phim sắp chiếu, phim nổi bật và tin tức
 *     responses:
 *       200:
 *         description: Dữ liệu trang chủ trả về thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 banners:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uri
 *                 nowShowing:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
 *                 comingSoon:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
 *                 hotMovies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movie'
 *                 news:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                       image_url:
 *                         type: string
 *                         format: uri
 *                       author:
 *                         type: string
 *                       date:
 *                         type: string
 *                       short_description:
 *                         type: string
 *                       slug:
 *                         type: string
 */

router.get('/', async (req, res) => {
  try {
    const commonFields = 'name image_url trailer_link genres rating version rating_score actors description start_date end_date';

    const [bannerMovies, nowShowing, comingSoon, hotMovies, newsRes] = await Promise.all([
      Movie.find({ banner_url: { $ne: null }, is_deleted: false }).select('banner_url'),
      Movie.find({ status: 'now_showing', is_deleted: false }).select(commonFields),
      Movie.find({ status: 'coming_soon', is_deleted: false }).select(commonFields),
      Movie.find({ is_hot: true, is_deleted: false }).select(commonFields),
      MovieNews.find({ is_deleted: false }).sort({ createdAt: -1 }).limit(8) //lấy 4 tin tức mới nhất
    ]);

    const banners = bannerMovies
      .map(movie => movie.banner_url)
      .filter(Boolean)
      .slice(0, 5);

      const news = newsRes.map(item => ({
        title: item.title,
        image_url: item.image_url,
        author: item.author || 'Admin',
date: item.date || item.createdAt.toISOString().split('T')[0],
        short_description: item.short_description,
        slug: item.slug
      }));
      
    res.status(200).json({
      banners,
      nowShowing,
      comingSoon,
      hotMovies,
      news
    });
  } catch (err) {
    console.error('❌ Lỗi khi lấy dữ liệu trang chủ:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu trang chủ', details: err.message });
  }
});

module.exports = router;
