// src/config/payosConfig.js
require('dotenv').config();

const PAYOS_CONFIG = {
    CLIENT_ID: process.env.PAYOS_CLIENT_ID,
    API_KEY: process.env.PAYOS_API_KEY,
    CHECKSUM_KEY: process.env.PAYOS_CHECKSUM_KEY,
    WEBHOOK_SECRET: process.env.PAYOS_WEBHOOK_SECRET, // Key dùng để xác minh webhook
    API_URL: 'https://api-merchant.payos.vn/v2/payment-requests', // Mặc định là production, có thể đổi thành sandbox
    FRONTEND_URL: 'http://localhost:3000',
    BACKEND_URL: 'http://localhost:5000'
};

// Kiểm tra các biến môi trường quan trọng
// for (const key in PAYOS_CONFIG) {
//     if (!PAYOS_CONFIG[key] && !['API_URL', 'FRONTEND_URL', 'BACKEND_URL'].includes(key)) {
//         console.warn(`[WARNING] PayOS config missing ${key}. Please check your .env file.`);
//     }
// }

module.exports = PAYOS_CONFIG;