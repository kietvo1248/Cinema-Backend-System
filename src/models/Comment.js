const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    movieName: {
      type: String,
      required: true,
      index: true, // Giúp tìm kiếm bình luận theo tên phim
    },
    author: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    }
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

module.exports = mongoose.model('Comment', commentSchema);
