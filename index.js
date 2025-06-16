const express = require('express');
const cors = require('cors'); // Import cors để xử lý Cross-Origin Resource Sharing
const authRoutes = require('./routes/auth'); // Import các tuyến xác thực
const connectDB = require('./config/dbconfig'); // Import hàm kết nối DB từ thư mục config

const app = express();
const PORT = process.env.PORT;


app.use(cors());
// Sử dụng express.json() để phân tích cú pháp các yêu cầu JSON từ client
app.use(express.json());

// Gọi hàm kết nối database
connectDB();

// Định nghĩa các tuyến (routes) API
// Mọi yêu cầu đến /api/auth sẽ được xử lý bởi authRoutes
app.use('/api/auth', authRoutes);

// Tuyến mặc định cho kiểm tra server
app.get('/', (req, res) => {
    res.send('Chào mừng đến với API Backend Đăng nhập!');
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
