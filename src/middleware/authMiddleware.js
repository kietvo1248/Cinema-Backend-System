const jwt = require('jsonwebtoken'); // Import jsonwebtoken để xác minh token
const dotenv = require('dotenv'); // Import dotenv để tải biến môi trường

dotenv.config();

/**
 * Middleware để xác minh JWT từ header Authorization của request.
 * Nếu token hợp lệ, thông tin người dùng được giải mã sẽ được gắn vào req.user.
 * Nếu không có token hoặc token không hợp lệ, sẽ trả về lỗi 401 (Unauthorized).
 */
const authMiddleware = (req, res, next) => {
    // Lấy token từ header Authorization.
    // Header này thường có dạng "Bearer <token_chuỗi_thực>".
    const token = req.header('Authorization');

    // Kiểm tra xem token có tồn tại không.
    if (!token) {
        return res.status(401).json({ message: 'Không có token, ủy quyền bị từ chối.' });
    }

    try {
        // Cắt bỏ phần "Bearer " để lấy chuỗi token thực tế.
        const actualToken = token.startsWith('Bearer ') ? token.slice(7, token.length) : token;

        // Xác minh token bằng cách sử dụng JWT_SECRET.
        // jwt.verify sẽ trả về payload đã được giải mã nếu token hợp lệ và chưa hết hạn.
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

        // Gắn thông tin người dùng từ payload đã giải mã vào đối tượng request (req.user).
        req.user = decoded.user;

        if (!req.user || !req.user.userId) {
            console.error('Lỗi xác minh token: Payload không chứa userId.');
            return res.status(401).json({ message: 'Token không hợp lệ: Thiếu thông tin người dùng.' });
        }

        next();
    } catch (error) {
        console.error('Lỗi xác minh token:', error.message);
        res.status(401).json({ message: 'Token không hợp lệ.' });
    }
};

module.exports = authMiddleware;