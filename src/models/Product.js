const mongoose = require ('mongoose');
const Counter = require('./Counter'); // Import mô hình Counter để sử dụng bộ đếm số tuần tự

const productSchema = new mongoose.Schema({
    productId: {
        type: String,
        unique: true,
        trim: true
    },
    productName: {
        type: String,
        required: [true, 'Tên sản phẩm là bắt buộc'],
        trim: true,
        maxlength: [100, 'Tên sản phẩm không được vượt quá 100 ký tự']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Mô tả sản phẩm không được vượt quá 500 ký tự']
    },
    price: {
        type: Number,
        required: [true, 'Giá sản phẩm là bắt buộc'],
        min: [0, 'Giá sản phẩm phải lớn hơn hoặc bằng 0']
    },
    category: {
        type: String,
        required: [true, 'Danh mục sản phẩm là bắt buộc'],
        enum: ['popcorn', 'drink', 'snack', 'other'],
        default: 'other'
    },
    stockQuantity: {
        type: Number,
        required: [true, 'Số lượng trong kho là bắt buộc'],
        min: [0, 'Số lượng trong kho phải lớn hơn hoặc bằng 0']
    },
    imageUrl: {
        type: String,
        //required: [true, 'URL hình ảnh là bắt buộc'],
        trim: true
        // , validate: {
        //     validator: function (v) {
        //         return /^(http|https):\/\/[^ "]+$/.test(v); // Kiểm tra định dạng URL
        //     },
        //     message: 'URL hình ảnh không hợp lệ'
        // }
    },
    is_deleted: { // Thêm trường is_deleted
        type: Boolean,
        default: false
    }
}, {
    timestamps: true, // Tự động thêm createdAt và updatedAt
    collection: 'products' // chỉnh sửa collection trong MongoDB ở đây
});

productSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'productId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.productId = `PROD-${counter.seq.toString().padStart(6, '0')}`; // Tạo productId với định dạng PROD-000001
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Product', productSchema);
// Mô hình Product sử dụng bộ đếm để tạo productId tự động với định dạng