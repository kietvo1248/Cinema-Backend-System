const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  promotionId: {
    type: String,
    unique: true,
  },
  title: {
    type: String,
    required: [true, 'Tiêu đề khuyến mãi là bắt buộc'],
    trim: true,
    maxlength: [255, 'Tiêu đề không được vượt quá 255 ký tự']
  },
  short_description: {
    type: String,
    required: [true, 'Mô tả ngắn là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Mô tả ngắn không được vượt quá 1000 ký tự']
  },
  full_details: {
    type: new mongoose.Schema({
      rules: { type: String, required: [true, 'Thể lệ là bắt buộc'] },
      notes: { type: String, default: '' },
      combos: {
        type: [
          {
            title: { type: String, required: true },
            items: { type: [String], default: [] },
            price: { type: Number, required: true }
          }
        ],
        default: []
      },
      conditions: { type: [String], default: [] }
    }, { _id: false }),
    required: true
  },
  promotion_code: {
    type: String,
    trim: true,
    maxlength: [50, 'Mã khuyến mãi không được vượt quá 50 ký tự']
  },
  discount: {
    type: Number,
    min: [0, 'Giảm giá không được nhỏ hơn 0%'],
    max: [100, 'Giảm giá không được lớn hơn 100%']
  },

  start_date: {
    type: Date,
    required: [true, 'Ngày bắt đầu là bắt buộc']
  },
  end_date: {
    type: Date,
    required: [true, 'Ngày kết thúc là bắt buộc']
  },
  image_url: {
    type: String,
    required: [true, 'Ảnh là bắt buộc'],
    trim: true
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'promotion'
});

promotionSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'movieId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.movieId = 'PROMO' + String(counter.seq).padStart(9, '0');
    } catch (error) {
      return next(error); // Chuyển lỗi nếu không thể tạo Id
    }
  }
});

module.exports = mongoose.model('Promotion', promotionSchema);
