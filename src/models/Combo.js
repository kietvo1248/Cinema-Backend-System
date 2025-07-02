// src/models/Combo.js
const mongoose = require('mongoose');
const Product = require('./Product'); // Import mô hình Product để tham chiếu
const Counter = require('./Counter'); // Import mô hình Counter để sử dụng bộ đếm số tuần tự

const comboSchema = new mongoose.Schema({
    comboID: { // ID của combo, sẽ được tạo tự động
        type: String,
        unique: true,
        trim: true
    },
    comboName: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        default: ''
    },
    price: { // Giá của combo
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true,
        default: 'combo',
        enum: ['combo'] // Đảm bảo chỉ có thể là 'combo'
    },
    items: [ // Mảng các sản phẩm trong combo
        {
            // Thay đổi từ tham chiếu ObjectId sang lưu trực tiếp tên sản phẩm
            productName: {
                type: String,
                required: true
            },
            quantity: {
                type: Number,
                required: true,
                min: 1
            }
        }
    ],
    startDate: { // Ngày bắt đầu bán combo
        type: Date,
        required: true
    },
    endDate: { // Ngày kết thúc bán combo
        type: Date,
        required: true
    },
    imageUrl: {
        type: String,
        trim: true
    },
    isActive: { // Trạng thái kích hoạt (admin bật/tắt)
        type: Boolean,
        default: true
    },
    isDeleted: { // Xóa mềm
        type: Boolean,
        default: false
    },
    // Trường để lưu trạng thái hiện tại của combo (có bán hay không)
    // Trường này sẽ được tính toán dựa trên isActive, isDeleted, startDate, endDate
    status: {
        type: String,
        enum: ['active', 'upcoming', 'expired', 'inactive', 'deleted'],
        default: 'upcoming' // Mặc định khi tạo là upcoming nếu startDate trong tương lai
    }
}, {
    timestamps: true,
    collection: 'combo' // Chỉnh sửa collection trong MongoDB ở đây
});

// Virtual property hoặc Pre-save hook để tự động cập nhật trạng thái
comboSchema.pre('save', async function (next) {
    if (this.isNew) {
        try {
            const counter = await Counter.findOneAndUpdate(
                { _id: 'productId' },
                { $inc: { seq: 1 } },
                { new: true, upsert: true }
            );
            this.comboID = `COMBO-${counter.seq.toString().padStart(6, '0')}`; // Tạo productId với định dạng PROD-000001
            next();
        } catch (error) {
            next(error);
        }
    }
    const now = new Date();
    // Chuyển về 00:00:00 của ngày hiện tại để so sánh chỉ dựa vào ngày
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const start = new Date(this.startDate.getFullYear(), this.startDate.getMonth(), this.startDate.getDate());
    const end = new Date(this.endDate.getFullYear(), this.endDate.getMonth(), this.endDate.getDate());

    if (this.isDeleted) {
        this.status = 'deleted';
    } else if (!this.isActive) {
        this.status = 'inactive';
    } else if (today < start) {
        this.status = 'upcoming';
    } else if (today > end) {
        this.status = 'expired';
    } else {
        this.status = 'active'; // Đang trong thời gian bán và kích hoạt
    }
    next();
});

// Có thể tạo một phương thức tĩnh để làm mới trạng thái cho nhiều combo
comboSchema.statics.updateStatuses = async function () {
    const combos = await this.find({ isDeleted: false });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const combo of combos) {
        let newStatus;
        const start = new Date(combo.startDate.getFullYear(), combo.startDate.getMonth(), combo.startDate.getDate());
        const end = new Date(combo.endDate.getFullYear(), combo.endDate.getMonth(), combo.endDate.getDate());

        if (combo.isDeleted) {
            newStatus = 'deleted';
        } else if (!combo.isActive) {
            newStatus = 'inactive';
        } else if (today < start) {
            newStatus = 'upcoming';
        } else if (today > end) {
            newStatus = 'expired';
        } else {
            newStatus = 'active';
        }

        if (combo.status !== newStatus) {
            combo.status = newStatus;
            await combo.save({ validateBeforeSave: false }); // Bỏ qua validation để chỉ cập nhật status
        }
    }
};

module.exports = mongoose.model('Combo', comboSchema);