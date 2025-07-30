const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
    },
    receiver: {
      type: String, // hoặc ObjectId nếu bạn dùng User model
    },

    author: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reply', replySchema);
