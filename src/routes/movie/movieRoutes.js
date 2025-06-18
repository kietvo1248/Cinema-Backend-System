const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');
const Movie = require('../../models/Movie');

const upload = multer({ dest: './src/uploads/' });

/**
 * @swagger
 * /api/movies:
 *   post:
 *     tags:
 *       - Movie
 *     summary: Thêm phim mới và upload ảnh poster
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - image
 *             properties:
 *               name:
 *                 type: string
 *               production_company:
 *                 type: string
 *               director:
 *                 type: string
 *               actors:
 *                 type: string
 *               running_time:
 *                 type: number
 *               version:
 *                 type: string
 *               trailer_link:
 *                 type: string
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date-time
 *               end_date:
 *                 type: string
 *                 format: date-time
 *               showtimes:
 *                 type: array
 *                 items:
 *                   type: string
 *               cinema_room:
 *                 type: string
 *               image_url:
 *                 type: string
 *                 format: uri
 *                 description: Đường dẫn ảnh đã upload lên Cloudinary
 *     responses:
 *       201:
 *         description: Phim được thêm thành công
 *       400:
 *         description: Dữ liệu không hợp lệ

 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn ảnh poster' });
    }

    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: 'movies'
    });

    fs.unlink(req.file.path, err => {
      if (err) console.error('Lỗi xoá file tạm:', err);
    });

    const newMovie = new Movie({
      ...req.body,
      image_url: uploadResult.secure_url,
      is_deleted: false
    });

    const saved = await newMovie.save();
    console.log('✅ Phim đã lưu:', saved);
    res.status(201).json(saved);
  } catch (err) {
    console.error('❌ Lỗi khi thêm phim:', err);
    res.status(500).json({ error: 'Thêm phim thất bại', details: err.message });
  }
});

/**
 * @swagger
 * /api/movies:
 *   get:
 *     tags:
 *       - Movie
 *     summary: Lấy danh sách phim chưa bị xoá mềm
 *     responses:
 *       200:
 *         description: Danh sách phim
 */
router.get('/', async (req, res) => {
  try {
    const movies = await Movie.find({ is_deleted: false });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: 'Không thể lấy danh sách phim' });
  }
});

/**
 * @swagger
 * /api/movies/deleted/all:
 *   get:
 *     tags:
 *       - Movie
 *     summary: Lấy danh sách phim đã bị xoá mềm
 *     responses:
 *       200:
 *         description: Danh sách phim đã xoá
 */
router.get('/deleted/all', async (req, res) => {
  try {
    const deletedMovies = await Movie.find({ is_deleted: true });
    res.json(deletedMovies);
  } catch (err) {
    res.status(500).json({ error: 'Không thể lấy danh sách phim đã xoá mềm' });
  }
});

/**
 * @swagger
 * /api/movies/{id}:
 *   get:
 *     tags:
 *       - Movie
 *     summary: Lấy thông tin chi tiết của một phim
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin phim
 *       404:
 *         description: Không tìm thấy phim
 */
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: 'Không thể lấy thông tin phim' });
  }
});

/**
 * @swagger
 * /api/movies/{id}:
 *   put:
 *     tags:
 *       - Movie
 *     summary: Cập nhật phim, cho phép thay đổi ảnh
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy phim
 */
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'movies'
      });

      updateData.image_url = uploadResult.secure_url;

      fs.unlink(req.file.path, err => {
        if (err) console.error('Lỗi xoá file tạm:', err);
      });
    }

    const updatedMovie = await Movie.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedMovie) return res.status(404).json({ error: 'Không tìm thấy phim để cập nhật' });

    res.json({ message: 'Cập nhật thành công!', data: updatedMovie });
  } catch (err) {
    res.status(400).json({ error: 'Cập nhật thất bại', details: err.message });
  }
});

/**
 * @swagger
 * /api/movies/{id}:
 *   delete:
 *     tags:
 *       - Movie
 *     summary: Ẩn (xoá mềm) phim
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Phim đã được ẩn
 *       404:
 *         description: Không tìm thấy phim
 */
router.delete('/:id', async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { is_deleted: true },
      { new: true }
    );

    if (!movie) return res.status(404).json({ error: 'Không tìm thấy phim để xoá' });

    res.json({ message: `Đã ẩn phim "${movie.name}" thành công!` });
  } catch (err) {
    res.status(500).json({ error: 'Ẩn phim thất bại', details: err.message });
  }
});

module.exports = router;
