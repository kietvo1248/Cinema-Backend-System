const express = require('express');
const cors = require('cors'); // Import cors để xử lý Cross-Origin Resource Sharing
require('dotenv').config();
const http = require('http');


// Import các tuyến (routes) từ thư mục routes
const authRoutes = require('./routes/authentication/auth');     // Import các tuyến xác thực người dùng
const profileRoutes = require('./routes/userFeature/profileRoutes');    // Import các tuyến quản lý hồ sơ người dùng
const featureRoutes = require('./routes/userFeature/userFeatureRoutes'); // Import các tuyến người dùng
const customerManagementRoutes = require('./routes/admin/customerRoutes');  // Import các tuyến quản lý khách hàng
const employeeManagementRoutes = require('./routes/admin/employeeRoutes');  // Import các tuyến quản lý nhân viên
const uploadRoutes = require('./routes/movie/uploadRoute');   // quản lý upload ảnh
const movieRoutes = require('./routes/movie/movieRoutes');  // quản lý phim
const homepageRoutes = require('./routes/movie/homepageRoutes'); // quản lý trang chủ
const promotionRoutes = require('./routes/promotions/promotionsRoutes'); // quản lý khuyến mãi
const roomManagermentRoutes = require('./routes/theather/room'); // Import tuyến quản lý phòng
const productRoutes = require('./routes/product/productRoutes'); // Import tuyến quản lý sản phẩm
const comboRoutes = require('./routes/product/comboRoutes'); // Import tuyến quản lý combo
const movieNewsRoutes = require('./routes/movie/newsRoutes'); // Import tuyến quản lý tin tức

const bookingRoutes = require('./routes/booking/bookingRoute'); // Import tuyến quản lý đặt vé
const vnpayRoutes = require('./routes/payments/vnPaySandboxRotes'); // Import tuyến thanh toán VNPay Sandbox
const payosRoutes = require('./routes/payments/payosRoutes'); // Import tuyến thanh toán PayOS
const cashRoutes = require('./routes/payments/cashRoutes'); // Import tuyến thanh toán tiền mặt
const bookingManagementRoutes = require('./routes/booking/bookingManagement'); // Import tuyến quản lý đặt vé
const commentsRoutes = require('./routes/movie/commentsRoutes');
const repliesRoutes = require('./routes/movie/repliesRoutes');

// Khởi tạo ứng dụng Express

const app = express();
const path = require('path');

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// Swagger docs route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use(cors());
// Sử dụng express.json() để phân tích cú pháp các yêu cầu JSON từ client
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploadsforNews', express.static(path.join(__dirname, 'public/uploadsforNews')));

// Định nghĩa các tuyến (routes) API
//tuyến người dùng
app.use('/api/auth', authRoutes);
app.use('/api/user', profileRoutes);
app.use('/api/feature', featureRoutes);
//tuyến quản trị viên
app.use('/api/admin/customers', customerManagementRoutes);
app.use('/api/admin/employees', employeeManagementRoutes);
//tuyến quản lý phim
app.use('/api/upload', uploadRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/home', homepageRoutes);
app.use('/api/promotions', promotionRoutes);

// tuyến quản lý đặt vé
app.use('/api/booking', bookingRoutes); // tuyến quản lý đặt vé
app.use('/api/vnpay-payment', vnpayRoutes); // tuyến thanh toán 
app.use('/api/payos-payment', payosRoutes); // tuyến thanh toán 
app.use('/api/cash-payment', cashRoutes); // tuyến thanh toán tiền mặt
app.use('/api/booking-management', bookingManagementRoutes); // tuyến quản lý đặt vé (Admin)
// tuyến quản lý phòng
app.use('/api/theater/rooms', roomManagermentRoutes);
// tuyến quản lý sản phẩm
app.use('/api/product', productRoutes);
app.use('/api/combo', comboRoutes);
//tuyến quản lý tin tức
app.use('/api/movie-news', movieNewsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/replies', repliesRoutes);



// // Tuyến mặc định cho kiểm tra server
// app.get('/', (req, res) => {
//     res.send('Chào mừng đến với API Backend Đăng nhập!');
// });

// // Khởi động server
// app.listen(PORT, () => {
//     console.log(`Server đang chạy trên cổng ${PORT}`);
//     console.log(`Swagger Docs tại: http://localhost:${PORT}/api-docs`);
// });
module.exports = app;
