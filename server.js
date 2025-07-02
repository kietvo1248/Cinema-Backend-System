const dotenv = require('dotenv');
dotenv.config(); // Tải các biến môi trường 
const connectDB = require('./src/config/dbconfig'); 
const app = require('./src/app'); // Import instance Express app từ src/app.js

const PORT = process.env.PORT; 

// Gọi hàm kết nối database
connectDB();

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
     console.log(`Swagger Docs tại: http://localhost:${PORT}/api-docs`);
});
