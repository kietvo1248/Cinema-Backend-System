const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');
const Movie = require('../../models/Movie');
const constants = require('constants');

const upload = multer({ dest: './src/uploads/' });
const dayjs = require('dayjs');

const calculateStatus = (start, end) => {
  const today = dayjs();
  if (today.isBefore(dayjs(start))) return 'coming_soon';
  if (today.isAfter(dayjs(end))) return 'ended';
  return 'now_showing';
};
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
 *               genres:
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
 *               age_limit:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [now_showing, coming_soon, ended]
 *               is_hot:
 *                 type: boolean
 *               image:
 *                 type: string
 *                 format: binary
 *               banner_url:
 *                 type: string
 *                 format: uri
 *               banner:
 *                 type: string
 *                 format: binary 
 *     responses:
 *       201:
 *         description: Phim được thêm thành công
 *       400:
 *         description: Dữ liệu không hợp lệ

 */
router.post('/', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const { files, body } = req;

    if (!files.image || files.image.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ảnh poster' });
    }

    const imageFile = files.image[0];
    const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
      folder: 'movies'
    });
    fs.unlinkSync(imageFile.path); // Xóa file tạm sau khi upload

    let bannerUrl = '';
    if (files.banner && files.banner.length > 0) {
      const bannerFile = files.banner[0];
      const bannerUpload = await cloudinary.uploader.upload(bannerFile.path, {
        folder: 'movies'
      });
      fs.unlinkSync(bannerFile.path);
      bannerUrl = bannerUpload.secure_url;
    }

    // Xử lý showtimes (chuỗi thành mảng)
    if (typeof body.showtimes === 'string') {
      body.showtimes = body.showtimes.split(',').map(s => s.trim());
    }

    const status = calculateStatus(body.start_date, body.end_date);

    const newMovie = new Movie({
      ...body,
      image_url: imageUpload.secure_url,
      banner_url: bannerUrl,
      is_deleted: false,
      status
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

//VIEW DETAILS FILM 
// router.get('/:name', async (req, res) => {

//   try {
//     const movies = await Movie.find({ name: req.params.name });
//     if (movies.length === 0) {
//       return res.status(404).json({ error: 'Không tìm thấy phim' });
//     }
//     // const moviesNotDeleted = await Movie.find({ is_deleted: false });


//     res.json(movies);
//   } catch (err) {
//     res.status(500).json({ error: 'Không thể lấy danh sách phim' });
//   }
// }); 

//VIEW ALL FILM

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
router.put('/:id', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Nếu có file poster
    if (req.files?.image?.length) {
      const imageFile = req.files.image[0];
      const uploadImage = await cloudinary.uploader.upload(imageFile.path, {
        folder: 'movies/images'
      });
      updateData.image_url = uploadImage.secure_url;
      fs.unlinkSync(imageFile.path);
    }

    // Nếu có file banner
    if (req.files?.banner?.length) {
      const bannerFile = req.files.banner[0];
      const uploadBanner = await cloudinary.uploader.upload(bannerFile.path, {
        folder: 'movies/banners'
      });
      updateData.banner_url = uploadBanner.secure_url;
      fs.unlinkSync(bannerFile.path);
    }

    if (updateData.start_date && updateData.end_date) {
      updateData.status = calculateStatus(updateData.start_date, updateData.end_date);
    }

    const updatedMovie = await Movie.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });


    if (!updatedMovie) {
      return res.status(404).json({ error: 'Không tìm thấy phim để cập nhật' });
    }

    res.json({ message: 'Cập nhật thành công!', data: updatedMovie });
  } catch (err) {
    console.error('❌ Lỗi cập nhật:', err.message);
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
