const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');
const Movie = require('../../models/Movie');
const constants = require('constants');

const upload = multer({ dest: './src/uploads/' });
const dayjs = require('dayjs');

const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);

const isBetween = require('dayjs/plugin/isBetween');
dayjs.extend(isBetween);

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


router.post('/check-showtime-conflict', async (req, res) => {
  try {
    const { cinema_room, showTimes, startDate, endDate, runningTime } = req.body;

    if (!cinema_room || !Array.isArray(showTimes) || !startDate || !endDate || !runningTime) {
      return res.status(400).json({ message: 'Thiếu dữ liệu đầu vào hoặc không hợp lệ' });
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (!start.isValid() || !end.isValid()) {
      return res.status(400).json({ message: 'Ngày bắt đầu hoặc kết thúc không hợp lệ' });
    }

    const BUFFER = 20;
    const totalDuration = runningTime + BUFFER;

    // 🔍 Lấy tất cả phim đang chiếu trong cùng phòng, giao với khoảng ngày yêu cầu
    const existingMovies = await Movie.find({
      cinema_room: cinema_room,
      start_date: { $lte: end.toDate() },
      end_date: { $gte: start.toDate() },
    });

    // ✅ 1. Tính toàn bộ blockedSlots: convert suất chiếu về 1 ngày mẫu
    const referenceDay = "2025-01-01";
    const blockedSlots = [];

    for (const movie of existingMovies) {
      if (!Array.isArray(movie.showtimes) || !movie.running_time) continue;

      for (const time of movie.showtimes) {
        const st = dayjs(`${referenceDay}T${time}`);
        const et = st.add(movie.running_time + BUFFER, 'minute');
        blockedSlots.push({ start: st, end: et });
      }
    }

    // ✅ 2. Tính các khung giờ gợi ý (không trùng giờ phim nào trong khoảng ngày)
    const suggestions = [];
    let current = dayjs(`${referenceDay}T07:00`);
    const latest = dayjs(`${referenceDay}T23:00`);

    while (current.add(totalDuration, 'minute').isBefore(latest)) {
      const endTime = current.add(totalDuration, 'minute');

      const isSafe = blockedSlots.every(({ start, end }) =>
        endTime.isBefore(start) || current.isAfter(end)
      );

      if (isSafe) {
        suggestions.push(current.format("HH:mm"));
      }

      current = current.add(15, 'minute'); // bước nhảy 15 phút
    }

    // ✅ 3. (Tùy chọn) Kiểm tra conflict thực tế nếu có showTimes được chọn sẵn
    const conflicts = [];

    if (showTimes.length > 0) {
      for (let date = start.clone(); date.isBefore(end.add(1, 'day')); date = date.add(1, 'day')) {
        const dateStr = date.format('YYYY-MM-DD');

        for (const movie of existingMovies) {
          for (const time of movie.showtimes) {
            const st = dayjs(`${dateStr}T${time}`);
            const et = st.add(movie.running_time + BUFFER, 'minute');

            for (const newTime of showTimes) {
              const newStart = dayjs(`${dateStr}T${newTime}`);
              const newEnd = newStart.add(totalDuration, 'minute');

              const isOverlap = newStart.isBefore(et) && st.isBefore(newEnd);
              if (isOverlap) {
                conflicts.push({
                  date: dateStr,
                  existingTime: st.format("HH:mm"),
                  newTime: newStart.format("HH:mm"),
                  existingMovie: movie.name || "Không rõ"
                });
              }
            }
          }
        }
      }
    }

    // ✅ 4. Kiểm tra xung đột nội bộ giữa các suất mới
    const internalConflicts = [];

    for (let i = 0; i < showTimes.length; i++) {
      const timeA = showTimes[i];
      const startA = dayjs(`${referenceDay}T${timeA}`);
      const endA = startA.add(totalDuration, 'minute');

      for (let j = i + 1; j < showTimes.length; j++) {
        const timeB = showTimes[j];
        const startB = dayjs(`${referenceDay}T${timeB}`);
        const endB = startB.add(totalDuration, 'minute');

        const isOverlap = startA.isBefore(endB) && startB.isBefore(endA);
        if (isOverlap) {
          internalConflicts.push({ newTimeA: timeA, newTimeB: timeB });
        }
      }
    }


    return res.status(200).json({
      conflict: conflicts.length > 0 || internalConflicts.length > 0,
      message:
        conflicts.length > 0
          ? 'Trùng suất chiếu với các phim khác trong cùng phòng'
          : internalConflicts.length > 0
            ? 'Các suất chiếu bị trùng với nhau'
            : 'Không có xung đột suất chiếu',
      conflicts,
      internalConflicts,
      suggestedShowtimes: suggestions,
    });


  } catch (err) {
    console.error('💥 Lỗi server:', err);
    return res.status(500).json({ message: 'Lỗi server khi kiểm tra xung đột suất chiếu' });
  }
});



module.exports = router;
