// chỉ là 1 bộ đếm số 
const mongoose = require('mongoose');

const CounterSchema = new mongoose.Schema({
    // _id của document này sẽ là tên của bộ đếm (ví dụ: "userId")
    _id: {
        type: String,
        required: true
    },
    // seq: Giá trị tuần tự hiện tại của bộ đếm
    seq: {
        type: Number,
        default: 0
    }
});

// Tạo và xuất (export) Counter Model
module.exports = mongoose.model('Counter', CounterSchema);