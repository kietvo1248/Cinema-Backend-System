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
    },
    movieId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
    }
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

module.exports = mongoose.models.Comment || mongoose.model('Comment', commentSchema);

