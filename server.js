const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const connectDB = require('./src/config/dbconfig');
const app = require('./src/app');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

connectDB();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.locals.io = io;

// Bản đồ lưu socket
const employeeSockets = new Map();             // employeeUsername -> socketId
const userSockets = new Map();                 // username -> Map<deviceId, socketId>

io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  const { deviceId } = socket.handshake.query;

socket.on("register", (data) => {
  const username = data?.username || data;
  const role = data?.role || 'customer';

  if (!username || !deviceId) return;

  socket.username = username;
  socket.role = role;
  socket.deviceId = deviceId;

  if (!socket.rooms.has(username)) {
    socket.join(username);
    console.log(`✅ ${username} (role: ${role}) đã join phòng '${username}'`);
  }

  if (role === 'employee') {
    employeeSockets.set(username, socket.id);
  } else {
    let deviceMap = userSockets.get(username) || new Map();

    // 👇 Di chuyển phần cập nhật map xuống sau khi kiểm tra
    // Kiểm tra tất cả socketId cũ khác deviceId hiện tại
    for (const [oldDeviceId, oldSocketId] of deviceMap.entries()) {
      if (oldDeviceId !== deviceId) {
        const oldSocket = io.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit("forceLogout", {
            message: "Tài khoản đã đăng nhập ở thiết bị khác.",
          });
          console.log(`🔁 Đã đăng xuất socket cũ của ${username} (device: ${oldDeviceId})`);
          oldSocket.disconnect(true);
          deviceMap.delete(oldDeviceId); // 👈 xoá deviceId cũ sau khi disconnect
        }
      }
    }

    // Lưu lại socket mới (ghi đè hoặc thêm)
    deviceMap.set(deviceId, socket.id);
    userSockets.set(username, deviceMap);

    for (const empSocketId of employeeSockets.values()) {
      io.to(empSocketId).emit('userOnline', username);
    }
  }
});


  socket.on('sendMessageToEmployee', ({ sender, message }) => {
    console.log(`📨 Tin nhắn từ user ${sender}: ${message}`);
    for (const empSocketId of employeeSockets.values()) {
      io.to(empSocketId).emit('receiveMessage', { sender, message });
    }
  });

  socket.on('sendMessage', ({ sender, receiver, message }) => {
    const deviceMap = userSockets.get(receiver);
    if (deviceMap?.size) {
      for (const socketId of deviceMap.values()) {
        io.to(socketId).emit('receiveMessage', { sender, message });
      }
      console.log(`📤 Nhân viên ${sender} gửi tin nhắn đến ${receiver}: ${message}`);
    } else {
      console.log(`⚠️ Không tìm thấy socket của ${receiver}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);

    // Nếu là nhân viên
    for (const [emp, sockId] of employeeSockets.entries()) {
      if (sockId === socket.id) {
        employeeSockets.delete(emp);
        console.log(`❌ Nhân viên ${emp} đã offline`);
        return;
      }
    }

    // Nếu là user
    const username = socket.username;
    const deviceId = socket.deviceId;

    if (username && deviceId && userSockets.has(username)) {
      const deviceMap = userSockets.get(username);
      deviceMap.delete(deviceId);

      if (deviceMap.size === 0) {
        userSockets.delete(username);
        console.log(`❌ User ${username} đã offline`);

        for (const empSocketId of employeeSockets.values()) {
          io.to(empSocketId).emit('userOffline', username);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📄 Swagger Docs tại: http://localhost:${PORT}/api-docs`);
});
