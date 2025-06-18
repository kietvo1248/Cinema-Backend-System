const dotenv = require('dotenv'); // Import dotenv để tải biến môi trường
dotenv.config(); // Tải các biến môi trường từ file .env ngay từ đầu

const connectDB = require('./src/config/dbconfig'); // Import hàm kết nối DB
const app = require('./src/app'); // Import instance Express app từ src/app.js

const PORT = process.env.PORT; // Cổng server, mặc định là 5000

// Gọi hàm kết nối database
connectDB();

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
     console.log(`Swagger Docs tại: http://localhost:${PORT}/api-docs`);
});
