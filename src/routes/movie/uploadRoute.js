const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../../config/cloudinary'); // Cloudinary config đã setup

// Multer config – Lưu file tạm vào thư mục "uploads/"
const upload = multer({
  dest: '.src/uploads/',

  // (tuỳ chọn) kiểm tra loại file
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      return cb(new Error('Chỉ chấp nhận file JPG, JPEG, PNG'), false);
    }
    cb(null, true);
  },

  limits: {
    fileSize: 5 * 1024 * 1024 // giới hạn 5MB
  }
});

// Route POST /api/upload
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file được tải lên.' });
    }

    // Upload lên Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'movies'
    });

    // Xóa file tạm local
    fs.unlinkSync(req.file.path);

    // Trả về link ảnh
    res.json({
      message: 'Upload thành công!',
      imageUrl: result.secure_url
    });
  } catch (err) {
    console.error('Lỗi upload:', err.message);
    res.status(500).json({ error: 'Upload thất bại' });
  }
});

module.exports = router;
