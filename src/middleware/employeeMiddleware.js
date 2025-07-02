module.exports = function(req, res, next) {
    // req.user được gán từ authMiddleware (chứa thông tin người dùng từ JWT)
    // Nếu không có req.user (ví dụ, authMiddleware chưa chạy hoặc lỗi)
    if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Không có quyền truy cập. Yêu cầu xác thực.' });
    }

    // Kiểm tra xem vai trò của người dùng có phải là 'ở đợ' không
    if (req.user.role !== 'employee') {
        return res.status(403).json({ message: 'Không có quyền truy cập. Yêu cầu quyền quản trị.' });
    }

    // Nếu là thằng ở đợ, chuyển sang middleware hoặc route tiếp theo
    next();
};
