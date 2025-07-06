const mongooose = require('mongoose');
const Product = require('../../models/Product'); // Import mô hình Product
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware'); // Import middleware xác thực JWT
const employeeMiddleware = require('../../middleware/employeeMiddleware');
const multer = require('multer');
const fs = require('fs');
const cloudinary = require('../../config/cloudinary');
const upload = multer({ dest: './src/uploads/' }); // Import middleware kiểm tra quyền ở đợ

// @route   POST /api/product/new_product
// @desc    Tạo một sản phẩm mới
// @access  Private (Chỉ dành cho nhân viên)
router.post('/new_product', authMiddleware, employeeMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { productName, category, price, stockQuantity, description } = req.body;

        if (!productName || !price || !req.file) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên sản phẩm, giá và ảnh.' });
        }

        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
            folder: 'products'
        });
        fs.unlinkSync(req.file.path);

        const newProduct = new Product({
            productName,
            category: category || 'other',
            price,
            stockQuantity,
            description,
            image_url: uploadResult.secure_url,
            is_deleted: false
        });

        await newProduct.save();

        res.status(201).json({
            message: 'Sản phẩm mới đã được tạo thành công.',
            product: newProduct
        });
    } catch (error) {
        console.error('Lỗi khi tạo sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo sản phẩm.');
    }
});

// @route   PUT /api/products/:id
// @desc    Cập nhật thông tin sản phẩm
// @access  Private (Chỉ dành cho quản trị viên)
router.put('/:id/update', authMiddleware, employeeMiddleware, upload.single('image'), async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await Product.findById(productId);
        if (!product || product.is_deleted) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
        }

        const { productName, category, price, stockQuantity, description } = req.body;

        if (productName) product.productName = productName;
        if (category) product.category = category;
        if (price && price >= 0) product.price = price;
        if (stockQuantity && stockQuantity >= 0) product.stockQuantity = stockQuantity;
        if (description !== undefined) product.description = description;

        if (req.file) {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'products'
            });
            fs.unlinkSync(req.file.path);
            product.image_url = uploadResult.secure_url;
        }

        await product.save();

        res.status(200).json({
            message: 'Thông tin sản phẩm đã được cập nhật thành công.',
            product
        });
    } catch (error) {
        console.error('Lỗi khi cập nhật sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi cập nhật sản phẩm.');
    }
});

// @route   GET /api/product
// @desc    Lấy danh sách tất cả các sản phẩm
// @access  Private (Chỉ dành cho nhân viên)
router.get('/', authMiddleware, employeeMiddleware, async (req, res) => {
    try {
        // Lấy danh sách tất cả các sản phẩm
        const products = await Product.find().select('-__v'); // Loại bỏ trường __v để giảm bớt dữ liệu trả về

        res.status(200).json({
            message: 'Danh sách sản phẩm: ',
            products
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách sản phẩm.');
    }
});

// @route   GET /api/product
// @desc    Lấy danh sách 1 sản phẩm
// @access  Private (Chỉ dành cho nhân viên)
router.get('/:productId', authMiddleware, employeeMiddleware, async (req, res) => {
    const { productId } = req.params;

    try {
        // Lấy danh sách tất cả các sản phẩm
        const product = await Product.findById(productId).select('-__v'); // Loại bỏ trường __v để giảm bớt dữ liệu trả về

        res.status(200).json({
            product
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi lấy danh sách sản phẩm.');
    }
});

// @route   PATCH /api/product/:productId/delete
// @desc    Xóa một sản phẩm
// @access  Private (Chỉ dành cho nhân viên)
router.patch('/:productId/delete', authMiddleware, employeeMiddleware, async (req, res) => {
    const { productId } = req.params;
    try {
        // Tìm sản phẩm theo productId
        const product = await Product.findByIdAndUpdate(
            productId,
            { is_deleted: true },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
        }

        // Đánh dấu sản phẩm là đã xóa


        res.status(200).json({
            message: 'Sản phẩm đã được đánh dấu là đã xóa.',
            product
        });
    } catch (error) {
        console.error('Lỗi khi xóa sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi xóa sản phẩm.');
    }
});

module.exports = router;