const mongoose = require('mongoose');
const Counter = require('./Counter');

// Sub-schema cho mỗi ghế
const seatSchema = new mongoose.Schema({
  row: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  column: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['Normal', 'VIP']
  },
  price: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    unique: true,
    trim: true
  },
  roomName: {
    type: String,
    required: [true, 'Tên phòng là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên phòng không được vượt quá 100 ký tự']
  },
  rows: {
    type: Number,
    required: [true, 'Số hàng ghế là bắt buộc'],
    min: [1, 'Số hàng ghế phải lớn hơn 0'],
    max: [50, 'Số hàng ghế không được vượt quá 50']
  },
  columns: {
    type: Number,
    required: [true, 'Số cột ghế là bắt buộc'],
    min: [1, 'Số cột ghế phải lớn hơn 0'],
    max: [50, 'Số cột ghế không được vượt quá 50']
  },
  quantity: {
    type: Number,
    required: [true, 'Số lượng ghế là bắt buộc'],
    min: [1, 'Số lượng ghế phải lớn hơn 0'],
    max: [500, 'Số lượng ghế không được vượt quá 500']
  },
  roomType: {
    type: String,
    required: [true, 'Loại phòng là bắt buộc'],
    enum: ['2D', '3D', 'IMAX']
  },
  is_deleted: {
    type: Boolean,
    default: false
  },
  is_actived: {
    type: Boolean,
    default: true
  },
  seats: [seatSchema]
}, {
  timestamps: true,
  collection: 'room'
});

// Middleware trước khi lưu
roomSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'roomId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.roomId = 'ROOM' + String(counter.seq).padStart(9, '0');
    } catch (error) {
      return next(error);
    }
  }

  // Tính số lượng ghế dựa vào rows x columns
  if (this.isModified('rows') || this.isModified('columns')) {
    this.quantity = this.rows * this.columns;
  }

  next();
});

module.exports = mongoose.model('Room', roomSchema);
