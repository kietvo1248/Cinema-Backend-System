const express = require('express');
const router = express.Router();
const MovieNews = require('../../models/MovieNews');
const multer = require('multer');
const authMiddleware = require('../../middleware/authMiddleware');
const adminMiddleware = require('../../middleware/adminMiddleware');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/uploadsforNews'));
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});


const upload = multer({
  dest: './src/temp/',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
      return cb(new Error('Chỉ chấp nhận ảnh JPG, JPEG hoặc PNG'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // Giới hạn 5MB
});

// ➕ Tạo movie news: POST /api/movie-news/add
router.post(
  '/add',
  authMiddleware,
  adminMiddleware,
  upload.single('image'),
  async (req, res) => {
    try {
      const { title, short_description, content, author, date } = req.body;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (!title || !slug || !short_description || !content || !req.file) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin và chọn ảnh.' });
      }

      const existing = await MovieNews.findOne({ slug });
      if (existing) {
        return res.status(400).json({ message: 'Slug đã tồn tại.' });
      }

      const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
        folder: 'movie-news'
      });
      fs.unlinkSync(req.file.path); // Xoá file tạm

      const newNews = new MovieNews({
        title,
        slug,
        short_description,
        content,
        author,
        date,
        image_url: uploadedImage.secure_url
      });

      await newNews.save();

      res.status(201).json({
        message: 'Tạo Movie News thành công!',
        news: newNews
      });
    } catch (err) {
      console.error('❌ Lỗi tạo news:', err);
      res.status(500).json({ message: 'Lỗi máy chủ khi tạo movie news.', error: err.message });
    }
  }
);


/**
 * 📄 Lấy 1 bài viết movie news theo slug: GET /api/movie-news/news/:slug
 */
router.get('/news/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const newsItem = await MovieNews.findOne({ slug, is_deleted: false });

    if (!newsItem) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.status(200).json(newsItem);
  } catch (err) {
    console.error('❌ Lỗi khi lấy chi tiết news:', err.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết movie news.' });
  }
});

/**
 * 🗑️ Xoá mềm movie news: DELETE /api/movie-news/:movieNewsId/delete
 */
router.delete('/:movieNewsId/delete', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const news = await MovieNews.findById(req.params.movieNewsId);

    if (!news) {
      return res.status(404).json({ message: 'Không tìm thấy movie news.' });
    }

    if (news.is_deleted) {
      return res.status(400).json({ message: 'Movie news đã bị xoá rồi.' });
    }

    news.is_deleted = true;
    await news.save();

    res.status(200).json({
      message: `Movie news "${news.title}" đã được xoá mềm.`
    });
  } catch (err) {
    console.error('❌ Lỗi xoá movie news:', err.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi xoá movie news.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const newsList = await MovieNews.find({ is_deleted: false }).sort({ date: -1 });
    res.status(200).json(newsList);
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách movie news:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách movie news.' });
  }
});

/**
 * ✏️ Cập nhật movie news: PUT /api/movie-news/:id
 */
router.put('/:id', authMiddleware, adminMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { title, short_description, content, author, date } = req.body;
    const { id } = req.params;

    const newsItem = await MovieNews.findById(id);
    if (!newsItem || newsItem.is_deleted) {
      return res.status(404).json({ message: 'Không tìm thấy movie news để cập nhật.' });
    }

    // Cập nhật trường
    newsItem.title = title || newsItem.title;
    newsItem.short_description = short_description || newsItem.short_description;
    newsItem.content = content || newsItem.content;
    newsItem.author = author || newsItem.author;
    newsItem.date = date || newsItem.date;

    // Nếu tiêu đề thay đổi -> update slug
    if (title && title !== newsItem.title) {
      newsItem.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    // Nếu có file ảnh mới
    if (req.file) {
      newsItem.image_url = `/uploads/${req.file.filename}`;
    }

    await newsItem.save();

    res.status(200).json({ message: 'Movie news đã được cập nhật thành công.', news: newsItem });
  } catch (err) {
    console.error('❌ Lỗi cập nhật movie news:', err.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật movie news.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const news = await MovieNews.findById(req.params.id);
    if (!news || news.is_deleted) {
      return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    }
    res.status(200).json(news);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy bài viết' });
  }
});




module.exports = router;
