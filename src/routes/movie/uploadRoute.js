const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../../config/cloudinary');

// Multer config – lưu file tạm
const upload = multer({
  dest: './src/uploads/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      return cb(new Error('Chỉ chấp nhận file JPG, JPEG, PNG'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Route POST /api/upload
router.post(
  '/',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!req.files || (!req.files.image && !req.files.banner)) {
        return res.status(400).json({ error: 'Không có file được tải lên.' });
      }

      const result = {};

      // Upload image (nếu có)
      if (req.files.image) {
        const imageFile = req.files.image[0];
        const uploadImage = await cloudinary.uploader.upload(imageFile.path, {
          folder: 'movies'
        });
        fs.unlinkSync(imageFile.path);
        result.imageUrl = uploadImage.secure_url;
      }

      // Upload banner (nếu có)
      if (req.files.banner) {
        const bannerFile = req.files.banner[0];
        const uploadBanner = await cloudinary.uploader.upload(bannerFile.path, {
          folder: 'movies'
        });
        fs.unlinkSync(bannerFile.path);
        result.bannerUrl = uploadBanner.secure_url;
      }

      // Trả về link
      res.json({
        message: 'Upload thành công!',
        ...result
      });
    } catch (err) {
      console.error('Lỗi upload:', err.message);
      res.status(500).json({ error: 'Upload thất bại' });
    }
  }
);

module.exports = router;
