const express = require('express');
const cors = require('cors'); // Import cors để xử lý Cross-Origin Resource Sharing
const connectDB = require('./config/dbconfig'); // Import hàm kết nối DB từ thư mục config


// Import các tuyến (routes) từ thư mục routes
const authRoutes = require('./routes/authentication/auth'); 
const profileRoutes = require('./routes/userFeature/profileRoutes');
const featureRoutes = require('./routes/userFeature/featureRoutes');
const uploadRoutes = require('./routes/movie/uploadRoute');
const movieRoutes = require('./routes/movie/movieRoutes');
const customerManagementRoutes = require('./routes/admin/userManagementRoutes'); // Quản lý người dùng
// Khởi tạo ứng dụng Express

const app = express();

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Swagger docs route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use(cors());
// Sử dụng express.json() để phân tích cú pháp các yêu cầu JSON từ client
app.use(express.json());


// Định nghĩa các tuyến (routes) API người dùng
app.use('/api/auth', authRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/feature', featureRoutes);
// định nghĩa các tuyến quản lý người dùng
app.use('/api/admin/customers', customerManagementRoutes);

// Định nghĩa các tuyến (routes) cho upload và movie
app.use('/api/upload', uploadRoutes);
app.use('/api/movies', movieRoutes);

app.use('/api/bookings', require('../src/routes/booking/bookingManagement'));


module.exports = app;
