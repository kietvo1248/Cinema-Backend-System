const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên phim là bắt buộc'],
    trim: true,
    minlength: [1, 'Tên phim quá ngắn'],
    maxlength: [255, 'Tên phim không được vượt quá 255 ký tự']
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
  trailer_link: {
    type: String,
    trim: true,
    validate: {
      validator: function (v) {
        return !v || /^https?:\/\/.+/.test(v); // URL hợp lệ hoặc không có
      },
      message: props => `${props.value} không phải là liên kết hợp lệ`
    }
  },
  type: {
    type: String,
    trim: true,
    maxlength: [100, 'Thể loại quá dài']
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
  } ,
  is_deleted: { type: Boolean, default: false }
  
}, {
  timestamps: true,
  collection: 'movies'
});

module.exports = mongoose.model('Movie', movieSchema);
