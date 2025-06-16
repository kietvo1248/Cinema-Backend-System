const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: [1, 'Tiêu đề không được để trống'],
        maxlength: [100, 'Tiêu đề không được quá 100 kí tự']
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: [1, 'Mô tả không được để trống'],
        maxlength: [500, 'Mô tả không được quá 500 kí tự']
    },
    releaseDate: {
        type: Date,
        required: true
    },
    genre: {
        type: String,
        required: true,
        trim: true
    },
    director: {
        type: String,
        required: true,
        trim: true
    },
    cast: [{
        type: String,
        required: true
    }],
    rating: {
        type: Number,
        min: 0,
        max: 10
    },
    is_deleted: { // Thêm trường is_deleted
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Movie = mongoose.model('Movie', movieSchema);
module.exports = Movie;