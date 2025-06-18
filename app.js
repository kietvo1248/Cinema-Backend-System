const express = require('express');
const cors = require('cors'); // Import cors để xử lý Cross-Origin Resource Sharing
const connectDB = require('./config/dbconfig'); // Import hàm kết nối DB từ thư mục config


// Import các tuyến (routes) từ thư mục routes
const authRoutes = require('./routes/authentication/auth'); 
const userFeatureRoutes = require('./routes/userFeature/userFeatureRoute'); // Import các tuyến người dùng
const uploadRoutes = require('./routes/movie/uploadRoute');
const movieRoutes = require('./routes/movie/movieRoutes');
// Khởi tạo ứng dụng Express

const app = express();
const PORT = process.env.PORT;

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Swagger docs route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use(cors());
// Sử dụng express.json() để phân tích cú pháp các yêu cầu JSON từ client
app.use(express.json());

// Gọi hàm kết nối database
connectDB();



// Định nghĩa các tuyến (routes) API
app.use('/api/auth', authRoutes);
app.use('/api/user', userFeatureRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/movies', movieRoutes);

// Tuyến mặc định cho kiểm tra server
app.get('/', (req, res) => {
    res.send('Chào mừng đến với API Backend Đăng nhập!');
});

// Khởi động server
app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
    console.log(`Swagger Docs tại: http://localhost:${PORT}/api-docs`);
});
