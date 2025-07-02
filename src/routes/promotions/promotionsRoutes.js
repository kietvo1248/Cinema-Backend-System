const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');
const Promotion = require('../../models/Promotion');

const upload = multer({ dest: './src/uploads/' });

/**
 * @swagger
 * /api/promotions:
 *   post:
 *     tags:
 *       - Promotion
 *     summary: Thêm khuyến mãi mới và upload ảnh
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - start_date
 *               - end_date
 *               - short_description
 *               - image
 *             properties:
 *               title:
 *                 type: string
 *               start_date:
 *                 type: string
 *               end_date:
 *                 type: string
 *               short_description:
 *                 type: string
 *               rules:
 *                 type: string
 *               notes:
 *                 type: string
 *               combos:
 *                 type: string
 *                 description: JSON stringified array
 *               conditions:
 *                 type: string
 *                 description: JSON stringified array
 *               image:
 *                 type: string
 *                 format: binary
 */
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { body, file } = req;
    if (!file) return res.status(400).json({ error: 'Vui lòng chọn ảnh khuyến mãi' });

    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: 'promotions'
    });
    fs.unlinkSync(file.path);

    // ✅ Đảm bảo tên field là "combos", không phải "combo"
    let combos = [];
    let conditions = [];

    try {
      if (body.combos) combos = JSON.parse(body.combos);  // 🔁 combo → combos
      if (body.conditions) conditions = JSON.parse(body.conditions);
    } catch (e) {
      return res.status(400).json({ error: 'Combos/Conditions không phải JSON hợp lệ' });
    }

    const newPromotion = new Promotion({
      promotionId: body.promotionId,
      title: body.title,
      start_date: body.start_date,
      end_date: body.end_date,
      short_description: body.short_description,
      promotion_code: body.promotion_code ,  // ✅ thêm dòng này
      discount: body.discount ,               // ✅ và dòng này
      full_details: {
        rules: body.rules || '',
        notes: body.notes || '',
        combos,          // ✅ combos đúng tên
        conditions
      },
      image_url: uploadResult.secure_url,
      is_deleted: false
    });

    const saved = await newPromotion.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: 'Thêm thất bại', details: err.message });
  }
});




/**
 * @swagger
 * /api/promotions:
 *   get:
 *     tags:
 *       - Promotion
 *     summary: Lấy danh sách khuyến mãi
 *     responses:
 *       200:
 *         description: Danh sách khuyến mãi
 */
router.get('/', async (req, res) => {
  try {
    const promos = await Promotion.find({ is_deleted: false });
    res.json(promos);
  } catch (err) {
    res.status(500).json({ error: 'Không thể lấy danh sách' });
  }
});

/**
 * @swagger
 * /api/promotions/deleted/all:
 *   get:
 *     tags:
 *       - Promotion
 *     summary: Lấy danh sách khuyến mãi đã xoá mềm
 *     responses:
 *       200:
 *         description: Danh sách khuyến mãi đã xoá
 */
router.get('/deleted/all', async (req, res) => {
  try {
    const deleted = await Promotion.find({ is_deleted: true });
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: 'Không thể lấy danh sách xoá' });
  }
});

/**
 * @swagger
 * /api/promotions/{id}:
 *   get:
 *     tags:
 *       - Promotion
 *     summary: Lấy thông tin chi tiết khuyến mãi
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết khuyến mãi
 *       404:
 *         description: Không tìm thấy
 */
router.get('/:id', async (req, res) => {
  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(promo);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

/**
 * @swagger
 * /api/promotions/{id}:
 *   put:
 *     tags:
 *       - Promotion
 *     summary: Cập nhật khuyến mãi
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               short_description:
 *                 type: string
 *               full_details:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         description: Không tìm thấy
 */
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const promo = await Promotion.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: 'Không tìm thấy để cập nhật' });

    // Parse combos và conditions nếu có
    let combos = promo.full_details.combos;
    let conditions = promo.full_details.conditions;

    try {
      if (req.body.combos) combos = JSON.parse(req.body.combos);
      if (req.body.conditions) conditions = JSON.parse(req.body.conditions);
    } catch (err) {
      return res.status(400).json({ error: 'Combos/Conditions không phải JSON hợp lệ' });
    }

    // Nếu có ảnh mới thì upload lên Cloudinary
    let image_url = promo.image_url;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'promotions'
      });
      image_url = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    // Cập nhật với dữ liệu mới hoặc giữ nguyên dữ liệu cũ
    const updatedData = {
      title: req.body.title || promo.title,
      start_date: req.body.start_date || promo.start_date,
      end_date: req.body.end_date || promo.end_date,
      short_description: req.body.short_description || promo.short_description,
      promotion_code: req.body.promotion_code || promo.promotion_code,
      discount: req.body.discount || promo.discount,
      full_details: {
        rules: req.body.rules || promo.full_details.rules,
        notes: req.body.notes || promo.full_details.notes,
        combos,
        conditions
      },
      image_url
    };

    const updatedPromo = await Promotion.findByIdAndUpdate(req.params.id, updatedData, {
      new: true,
      runValidators: true
    });

    res.json({ message: 'Cập nhật thành công!', data: updatedPromo });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cập nhật', details: err.message });
  }
});


/**
 * @swagger
 * /api/promotions/{id}:
 *   delete:
 *     tags:
 *       - Promotion
 *     summary: Xoá mềm khuyến mãi
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã xoá mềm thành công
 *       404:
 *         description: Không tìm thấy
 */
router.delete('/:id', async (req, res) => {
  try {
    const promo = await Promotion.findByIdAndUpdate(
      req.params.id,
      { is_deleted: true },
      { new: true }
    );
    if (!promo) return res.status(404).json({ error: 'Không tìm thấy để xoá' });
    res.json({ message: `Đã ẩn khuyến mãi "${promo.title}" thành công!` });
  } catch (err) {
    res.status(500).json({ error: 'Xoá thất bại', details: err.message });
  }
});

module.exports = router;
