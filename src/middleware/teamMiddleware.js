module.exports = function(req, res, next) {
    // req.user is assigned from authMiddleware (contains user information from JWT)
    // If req.user is missing (e.g., authMiddleware hasn't run or there's an error)
    if (!req.user || !req.user.role) {
        return res.status(401).json({ message: 'Không có quyền truy cập. Yêu cầu quyền quản trị.' });
    }

    // Check if the user's role is either 'admin' or 'employee'
    const allowedRoles = ['admin', 'employee'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Không phận sự thì BIẾN' });
    }

    // If the user has an allowed role, proceed to the next middleware or route
    next();
};