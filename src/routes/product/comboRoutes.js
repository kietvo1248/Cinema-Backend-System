const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../../config/cloudinary'); // Thêm Cloudinary config
const authMiddleware = require('../../middleware/authMiddleware');
const employeeMiddleware = require('../../middleware/employeeMiddleware');
const Combo = require('../../models/Combo');
const Product = require('../../models/Product');

// Multer config
const upload = multer({ dest: './src/uploads/' });
const dayjs = require('dayjs');

const calculateStatus = (start, end) => {
    const today = dayjs();
    if (today.isBefore(dayjs(start))) return 'upcoming';
    if (today.isAfter(dayjs(end))) return 'expired';
    return 'active';
};

// Helper function để kiểm tra sản phẩm
const validateComboItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return { valid: false, message: 'Danh sách sản phẩm trong combo không hợp lệ.' };
    }

    const productNamesInCombo = items.map(item => item.productName);
    const productsInDb = await Product.find({ productName: { $in: productNamesInCombo }, is_deleted: false });
    const productMap = new Map(productsInDb.map(p => [p.productName, p]));

    for (const item of items) {
        if (!item.productName || typeof item.quantity !== 'number' || item.quantity <= 0) {
            return { valid: false, message: 'Mỗi sản phẩm trong combo phải có tên và số lượng dương.' };
        }

        const productDetail = productMap.get(item.productName);
        if (!productDetail) {
            return { valid: false, message: `Sản phẩm "${item.productName}" không tồn tại hoặc đã bị xóa.` };
        }

        if (productDetail.category === 'combo') {
            return { valid: false, message: `Không thể thêm sản phẩm có loại 'combo' ("${item.productName}") vào combo khác.` };
        }
    }
    return { valid: true, productsInDb };
};

// @route POST /api/combos/new_combo
// @desc  Tạo combo mới có upload ảnh
router.post('/new_combo', authMiddleware, employeeMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { comboName, description, price, items, startDate, endDate, isActive } = req.body;
        const file = req.file;

        if (!comboName || !price || !items || !startDate || !endDate ) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin combo.' });
        }

        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        const validationResult = await validateComboItems(parsedItems);
        if (!validationResult.valid) {
            return res.status(400).json({ message: validationResult.message });
        }

        const existingCombo = await Combo.findOne({ comboName });
        if (existingCombo) {
            return res.status(409).json({ message: 'Tên combo đã tồn tại. Vui lòng chọn tên khác.' });
        }

        const start = dayjs(startDate);
        const end = dayjs(endDate);
        if (!start.isValid() || !end.isValid() || !start.isBefore(end)) {
            return res.status(400).json({ message: 'Ngày bắt đầu và ngày kết thúc không hợp lệ hoặc ngày bắt đầu phải trước ngày kết thúc.' });
        }

        const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: 'combos'
        });

        fs.unlinkSync(file.path);

        const newCombo = new Combo({
            comboName,
            description,
            price,
            items: parsedItems.map(item => ({ productName: item.productName, quantity: item.quantity })),
            startDate: start.toDate(),
            endDate: end.toDate(),
            image_url: uploadResult.secure_url,
            isActive: typeof isActive === 'boolean' ? isActive : true,
            category: 'combo',
            status: calculateStatus(start, end) // Optional nếu model cần trường này
        });

        await newCombo.save();

        res.status(201).json({
            message: 'Combo mới đã được tạo thành công.',
            combo: newCombo
        });
    } catch (error) {
        console.error('Lỗi khi tạo combo:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo combo.');
    }
});

// @route   GET /api/combos
// @desc    Lấy danh sách tất cả combo
// @access  Public
router.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.search || '';
    const statusFilter = req.query.status || '';
    const includeDeleted = req.query.includeDeleted === 'true';

    const skip = (page - 1) * limit;

    try {
        let query = {};
        if (!includeDeleted) {
            query.isDeleted = false;
        }

        if (searchTerm) {
            query.name = { $regex: searchTerm, $options: 'i' };
        }
        if (statusFilter && ['active', 'upcoming', 'expired', 'inactive', 'deleted'].includes(statusFilter)) {
            query.status = statusFilter;
        }

        await Combo.updateStatuses();

        const totalCombos = await Combo.countDocuments(query);
        let combos = await Combo.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ startDate: -1, name: 1 })
            .select('-__v')
            .lean();

        // Lấy thông tin chi tiết sản phẩm cho mỗi combo
        for (const combo of combos) {
            const productNames = combo.items.map(item => item.productName);
            const productsInfo = await Product.find({ name: { $in: productNames }, is_deleted: false })
                .select('name price category imageUrl -_id');

            const productMap = new Map(productsInfo.map(p => [p.name, p])); // Tạo map để tra cứu nhanh

            combo.items = combo.items.map(item => {
                const productDetail = productMap.get(item.productName);
                return {
                    ...item,
                    productDetail: productDetail || null // Đính kèm chi tiết hoặc null nếu không tìm thấy
                };
            });
        }

        res.status(200).json({
            message: 'Lấy danh sách combo thành công.',
            combos,
            pagination: {
                totalItems: totalCombos,
                totalPages: Math.ceil(totalCombos / limit),
                currentPage: page,
                itemsPerPage: limit,
            },
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách combo:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách combo.');
    }
});

// @route   GET /api/combos/:id
// @desc    Lấy chi tiết một combo
// @access  Public
router.get('/:comboID', async (req, res) => {
    try {
        let combo = await Combo.findById(req.params.comboID).lean();

        if (!combo || combo.isDeleted) {
            return res.status(404).json({ message: 'Combo không tồn tại hoặc đã bị xóa.' });
        }

        const productNames = combo.items.map(item => item.productName);
        const productsInfo = await Product.find({ name: { $in: productNames }, is_deleted: false })
            .select('name price category imageUrl -_id');

        const productMap = new Map(productsInfo.map(p => [p.name, p]));

        combo.items = combo.items.map(item => {
            const productDetail = productMap.get(item.productName);
            return {
                ...item,
                productDetail: productDetail || null
            };
        });

        res.status(200).json({
            message: 'Lấy chi tiết combo thành công.',
            combo
        });
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết combo:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy chi tiết combo.');
    }
});


// @route   PUT /api/combos/:id
// @desc    Cập nhật thông tin combo
// @access  Private (Chỉ dành cho con ở lao động không lương trong rạp này)
router.put('/:comboID/update', authMiddleware, employeeMiddleware, upload.single('image'), async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.comboID);
        if (!combo || combo.isDeleted) {
            return res.status(404).json({ message: 'Combo không tồn tại hoặc đã bị xóa.' });
        }
        const {
            comboName,
            description,
            price,
            startDate,
            endDate,
            isActive
        } = req.body;

        let items = req.body['items[]'];
        let parsedItems = [];

        if (Array.isArray(items)) {
            parsedItems = items.map(item => JSON.parse(item));
        } else if (typeof items === 'string') {
            parsedItems = [JSON.parse(items)];
        }

        if (parsedItems.length > 0) {
            const validationResult = await validateComboItems(parsedItems);
            if (!validationResult.valid) {
                return res.status(400).json({ message: validationResult.message });
            }
            combo.items = parsedItems.map(i => ({
                productName: i.productName,
                quantity: i.quantity
            }));
        }

        if (comboName) {
            const nameConflict = await Combo.findOne({ comboName });
            if (nameConflict && nameConflict._id.toString() !== combo._id.toString()) {
                return res.status(409).json({ message: 'Tên combo đã tồn tại. Vui lòng chọn tên khác.' });
            }
            combo.comboName = comboName;
        }

        combo.description = description ?? combo.description;
        combo.price = price !== undefined ? Number(price) : combo.price;

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (isNaN(start) || isNaN(end) || start >= end) {
                return res.status(400).json({ message: 'Ngày bắt đầu và kết thúc không hợp lệ.' });
            }
            combo.startDate = start;
            combo.endDate = end;
            combo.status = calculateStatus(start, end);
        }

        combo.isActive = isActive === 'true' || isActive === true;

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'combos'
            });
            fs.unlinkSync(req.file.path);
            combo.image_url = uploadResult.secure_url;
        }

        await combo.save();

        res.status(200).json({
            message: 'Cập nhật combo thành công.',
            combo
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật combo:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật combo.');
    }
});


// @route   DELETE /api/combos/:id
// @desc    Xóa một combo
// @access  Private (Chỉ dành cho nhân viên)
router.delete('/:comboID', authMiddleware, employeeMiddleware, async (req, res) => {
    try {
        const combo = await Combo.findById(req.params.comboID);
        if (!combo) {
            return res.status(404).json({ message: 'Combo không tồn tại.' });
        }

        // Thực hiện soft delete thay vì xóa hoàn toàn
        combo.isDeleted = true;
        await combo.save();

        res.status(200).json({
            message: 'Combo đã được xóa thành công.',
            comboId: req.params.comboID
        });
    } catch (error) {
        console.error('Lỗi khi xóa combo:', error.message);
        res.status(500).send('Lỗi máy chủ khi xóa combo.');
    }
});

module.exports = router;