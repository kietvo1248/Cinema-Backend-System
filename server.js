const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const connectDB = require('./src/config/dbconfig');
const app = require('./src/app');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

// ✅ Kết nối MongoDB
connectDB();

// ✅ Tạo HTTP server
const server = http.createServer(app);

// ✅ Tạo socket.io instance
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // frontend
        methods: ["GET", "POST"],
        credentials: true,
    },
});

// ✅ Gắn io vào app.locals để sử dụng trong các route
app.locals.io = io;

// ✅ Xử lý kết nối Socket.io
io.on('connection', (socket) => {
    console.log('🟢 Socket connected:', socket.id);

    // Đăng ký user theo username
    socket.on("register", (username) => {
        socket.join(username); // join vào room tên là username
        console.log(`✅ ${username} joined room ${username}, socket ${socket.id}`);
    });

    // Ngắt kết nối
    socket.on('disconnect', () => {
        console.log('🔴 Socket disconnected:', socket.id);
        // ❌ Không cần xóa khỏi connectedUsers nữa
    });
});

// ✅ Khởi động server
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📄 Swagger Docs tại: http://localhost:${PORT}/api-docs`);
});
