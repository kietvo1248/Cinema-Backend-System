const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware');
const employeeMiddleware = require('../../middleware/employeeMiddleware');
const Combo = require('../../models/Combo');
const Product = require('../../models/Product');

// Helper function để kiểm tra và lấy thông tin sản phẩm
const validateComboItems = async (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return { valid: false, message: 'Danh sách sản phẩm trong combo không hợp lệ.' };
    }

    const productNamesInCombo = items.map(item => item.productName);

    // --- CHANGE HERE: Use 'productName' instead of 'name' for the query ---
    const productsInDb = await Product.find({ productName: { $in: productNamesInCombo }, is_deleted: false });

    const productMap = new Map(productsInDb.map(p => [p.productName, p])); // Use productName as key for the map

    for (const item of items) {
        if (!item.productName || typeof item.quantity !== 'number' || item.quantity <= 0) {
            return { valid: false, message: 'Mỗi sản phẩm trong combo phải có tên và số lượng dương.' };
        }

        const productDetail = productMap.get(item.productName);

        if (!productDetail) {
            return { valid: false, message: `Sản phẩm "${item.productName}" không tồn tại hoặc đã bị xóa.` };
        }

        // --- Ensure 'combo' is in the Product category enum ---
        if (productDetail.category === 'combo') {
            return { valid: false, message: `Không thể thêm sản phẩm có loại 'combo' ("${item.productName}") vào combo khác.` };
        }
    }
    return { valid: true, productsInDb };
};



// @route   POST /api/combos/new
// @desc    Thêm một combo mới
// @access  Private (Chỉ dành cho ở đợ)
router.post('/new_combo', authMiddleware, employeeMiddleware, async (req, res) => {
    const { comboName, description, price, items, startDate, endDate, imageUrl, isActive } = req.body;

    try {
        if (!comboName || !price || !items || !startDate || !endDate) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên, giá, danh sách sản phẩm, ngày bắt đầu và ngày kết thúc.' });
        }

        // Sử dụng helper function để kiểm tra items
        const validationResult = await validateComboItems(items);
        if (!validationResult.valid) {
            return res.status(400).json({ message: validationResult.message });
        }

        const existingCombo = await Combo.findOne({ comboName });
        if (existingCombo) {
            return res.status(409).json({ message: 'Tên combo đã tồn tại. Vui lòng chọn tên khác.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
            return res.status(400).json({ message: 'Ngày bắt đầu và ngày kết thúc không hợp lệ hoặc ngày bắt đầu phải trước ngày kết thúc.' });
        }

        const newCombo = new Combo({
            comboName,
            description,
            price,
            items: items.map(item => ({ productName: item.productName, quantity: item.quantity })),
            startDate: start,
            endDate: end,
            imageUrl,
            isActive: typeof isActive === 'boolean' ? isActive : true,
            category: 'combo' // Mặc định category là 'combo'
        });

        await newCombo.save();

        res.status(201).json({
            message: 'Combo mới đã được tạo thành công.',
            combo: newCombo
        });
    } catch (error) {
        console.error('Lỗi khi tạo combo:', error.message);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return res.status(409).json({ message: 'Tên combo đã tồn tại.' });
        }
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
router.put('/:comboID/update', authMiddleware, employeeMiddleware, async (req, res) => {
    const { comboName, description, price, items, startDate, endDate, imageUrl, isActive } = req.body;
    const comboId = req.params.comboID;

    try {
        const combo = await Combo.findOne({ comboID: comboId, isDeleted: false });
        if (!combo || combo.isDeleted) {
            return res.status(404).json({ message: 'Combo không tồn tại hoặc đã bị xóa.' });
        }

        // Kiểm tra tên trùng lặp nếu tên được thay đổi
        if (comboName && comboName !== combo.comboName) {
            const existingCombo = await Combo.findOne({ comboName });
            if (existingCombo) {
                return res.status(409).json({ message: 'Tên combo đã tồn tại. Vui lòng chọn tên khác.' });
            }
        }

        // Sử dụng helper function để kiểm tra items nếu có cập nhật
        if (items) {
            const validationResult = await validateComboItems(items);
            if (!validationResult.valid) {
                return res.status(400).json({ message: validationResult.message });
            }
            combo.items = items.map(item => ({ productName: item.productName, quantity: item.quantity }));
        }

        // Kiểm tra và cập nhật ngày tháng
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : combo.startDate;
            const end = endDate ? new Date(endDate) : combo.endDate;
            if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
                return res.status(400).json({ message: 'Ngày bắt đầu và ngày kết thúc không hợp lệ hoặc ngày bắt đầu phải trước ngày kết thúc.' });
            }
            combo.startDate = start;
            combo.endDate = end;
        }

        combo.comboName = comboName || combo.comboName;
        combo.description = description !== undefined ? description : combo.description;
        combo.price = typeof price === 'number' && price >= 0 ? price : combo.price;
        combo.imageUrl = imageUrl !== undefined ? imageUrl : combo.imageUrl;
        combo.isActive = typeof isActive === 'boolean' ? isActive : combo.isActive;

        await combo.save();

        res.status(200).json({
            message: 'Thông tin combo đã được cập nhật thành công.',
            combo
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật combo:', error.message);
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return res.status(409).json({ message: 'Tên combo đã tồn tại.' });
        }
        res.status(500).send('Lỗi máy chủ khi cập nhật combo.');
    }
});

// DELETE route

module.exports = router;