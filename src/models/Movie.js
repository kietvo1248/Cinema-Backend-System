const mongoose = require('mongoose');
const Counter = require('./Counter'); // Import mô hình Counter để sử dụng bộ đếm số tuần tự


const movieSchema = new mongoose.Schema({
  movieId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: [true, 'Tên phim là bắt buộc'],
    trim: true,
    minlength: [1, 'Tên phim quá ngắn'],
    maxlength: [255, 'Tên phim không được vượt quá 255 ký tự'],
    unique: true
  },
  production_company: {
    type: String,
    trim: true,
    maxlength: [100, 'Tên hãng sản xuất quá dài']
  },
  director: {
    type: String,
    trim: true,
    maxlength: [100, 'Tên đạo diễn quá dài']
  },
  actors: {
    type: String,
    trim: true,
    maxlength: [1000, 'Danh sách diễn viên quá dài']
  },
  running_time: {
    type: Number,
    min: [1, 'Thời lượng phải lớn hơn 0'],
    max: [600, 'Thời lượng không hợp lệ'],
    required: [true, 'Phải có thời lượng phim']
  },
  version: {
    type: String,
    trim: true,
    maxlength: [20, 'Phiên bản phim quá dài']
  },
  cinema_room: {
    type: String,
    trim: true,
    maxlength: [50, 'Tên phòng chiếu quá dài'],
    match: [/^[A-Za-z0-9\s\-]+$/, 'Tên phòng chiếu chứa ký tự không hợp lệ']
  },
  showtimes: {
    type: [String],
    validate: {
      validator: function (arr) {
        return arr.every(time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
      },
      message: 'Mỗi suất chiếu phải theo định dạng HH:mm (VD: 13:00)'
    }
  },
  trailer_link: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: props => `${props.value} không phải là liên kết hợp lệ`
    }
  },
  genres: {
    type: [String],
    default: [],
    maxlength: [5, 'Tối đa 5 thể loại']
  },
  format: {
    type: String, // ví dụ: 2D, 3D, IMAX
    trim: true,
    maxlength: [20, 'Định dạng phim quá dài']
  },
  age_limit: {
    type: String, // ví dụ: "13+", "16+", "18+"
    trim: true,
    maxlength: [5, 'Giới hạn độ tuổi quá dài']
  },
  rating: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  description: {
    type: String,
    maxlength: [5000, 'Mô tả quá dài']
  },
  start_date: {
    type: Date,
    required: [true, 'Phải có ngày khởi chiếu']
  },
  end_date: {
    type: Date,
    required: [true, 'Phải có ngày kết thúc'],
    validate: {
      validator: function (value) {
        return !this.start_date || value >= this.start_date;
      },
      message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'
    }
  },
  image_url: {
    type: String,
    required: [true, 'Phim phải có hình ảnh'],
    validate: {
      validator: function (v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: props => `${props.value} không phải là URL hình ảnh hợp lệ`
    }
  },
  banner_url: {
    type: String,
    required: [true, 'Phim phải có ảnh banner'],
    validate: {
      validator: function (v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: props => `${props.value} không phải là URL hình ảnh hợp lệ`
    }
  },
  status: {
    type: String,
    enum: ['now_showing', 'coming_soon', 'ended'],
    required: true
  },
  is_hot: {
    type: Boolean,
    default: false
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'movies'
});

movieSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'movieId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.movieId = 'MOV' + String(counter.seq).padStart(9, '0');
    } catch (error) {
      return next(error); // Chuyển lỗi nếu không thể tạo Id
    }
  }
});

module.exports = mongoose.model('Movie', movieSchema);
