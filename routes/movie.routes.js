const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../config/cloudinary');
const Movie = require('../models/Movie');

// Multer config - lưu file tạm vào thư mục uploads
const upload = multer({ dest: 'uploads/' });

/**
 * POST /api/movies
 * Thêm phim mới + upload ảnh poster
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
 * GET /api/movies
 * Lấy danh sách phim chưa bị xoá mềm
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
 * GET /api/movies/deleted/all
 * Lấy danh sách phim đã xoá mềm
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
 * GET /api/movies/:id
 * Lấy thông tin 1 phim
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
 * PUT /api/movies/:id
 * Cập nhật phim (có thể thay đổi ảnh)
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
 * DELETE /api/movies/:id
 * Soft delete - chỉ ẩn phim
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
