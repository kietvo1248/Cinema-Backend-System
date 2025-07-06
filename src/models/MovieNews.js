const mongoose = require('mongoose');
const Counter = require('./Counter');

const movieNewsSchema = new mongoose.Schema({
  movieNewsId: {
    type: String,
    unique: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    trim: true
  },
  short_description: {
    type: String,
    required: true
  },
  content: {
    type: String, // Nếu là richtext lưu HTML
    required: true
  },
  image_url: {
    type: String,
    required: true
  },
  author: {
    type: String,
    default: 'admin'
  },
  date: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'movieNews'
});

movieNewsSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: 'movieNewsId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.movieNewsId = 'NEWS' + String(counter.seq).padStart(6, '0');
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('MovieNews', movieNewsSchema);
