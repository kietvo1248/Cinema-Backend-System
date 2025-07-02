const mongooose = require('mongoose');
const Product = require('../../models/Product'); // Import mô hình Product
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middleware/authMiddleware'); // Import middleware xác thực JWT
const employeeMiddleware = require('../../middleware/employeeMiddleware'); // Import middleware kiểm tra quyền ở đợ

// @route   POST /api/product/new_product
// @desc    Tạo một sản phẩm mới
// @access  Private (Chỉ dành cho nhân viên)
router.post('/new_product', authMiddleware, employeeMiddleware, async (req, res) => {
    const { productId, productName, category, price, stockQuantity, description, imageUrl, is_deleted } = req.body;
    try {
        // Kiểm tra các trường bắt buộc
        if (!productName || !price) {
            return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ tên sản phẩm và giá.' });
        }
        
        // Tạo một sản phẩm mới
        const newProduct = new Product({
            productId,
            productName,
            category: category || 'other', // Mặc định là 'other' nếu không có danh mục
            price,
            stockQuantity,
            description,
            imageUrl,
            is_deleted
        });

        // Lưu sản phẩm vào cơ sở dữ liệu
        await newProduct.save();

        res.status(201).json({
            message: 'Sản phẩm mới đã được tạo thành công.',
        });
    } catch (error) {
        console.error('Lỗi khi tạo sản phẩm:', error.message);
        res.status(500).send('Lỗi máy chủ khi tạo sản phẩm.');
    }
});

// @route   PUT /api/products/:id
// @desc    Cập nhật thông tin sản phẩm
// @access  Private (Chỉ dành cho quản trị viên)
router.put('/:id', authMiddleware, employeeMiddleware, async (req, res) => {
    const { name, category, price, stockQuantity, description, imageUrl } = req.body;
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId);
        if (!product || product.is_deleted) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
        }

        // Kiểm tra tên trùng lặp nếu tên được thay đổi
        if (name && name !== product.name) {
            const existingProduct = await Product.findOne({ name });
            if (existingProduct) {
                return res.status(409).json({ message: 'Tên sản phẩm đã tồn tại. Vui lòng chọn tên khác.' });
            }
        }

        // Cập nhật các trường
        product.name = name || product.name;
        product.category = category || product.category;
        product.price = typeof price === 'number' && price >= 0 ? price : product.price;
        product.stockQuantity = typeof stockQuantity === 'number' && stockQuantity >= 0 ? stockQuantity : product.stockQuantity;
        product.description = description !== undefined ? description : product.description;
        product.imageUrl = imageUrl !== undefined ? imageUrl : product.imageUrl;

        await product.save();

        res.status(200).json({
            message: 'Thông tin sản phẩm đã được cập nhật thành công.',
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

// @route   PATCH /api/product/:productId/delete
// @desc    Xóa một sản phẩm
// @access  Private (Chỉ dành cho nhân viên)
router.patch('/:productId/delete', authMiddleware, employeeMiddleware, async (req, res) => {
    const { productId } = req.params;
    try {
        // Tìm sản phẩm theo productId
        const product = await Product.findOne({ productId });

        if (!product) {
            return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
        }

        // Đánh dấu sản phẩm là đã xóa
        product.is_deleted = true;
        await product.save();

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