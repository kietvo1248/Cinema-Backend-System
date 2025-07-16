// src/config/VnPayConfig.js
require('dotenv').config(); // Load environment variables from .env file

module.exports = {
    vnp_TmnCode: process.env.VNPAY_TMNCODE,
    vnp_HashSecret: process.env.VNPAY_HASHSECRET,
    vnp_Url: process.env.VNPAY_URL,
    vnp_ReturnUrlFrontend: process.env.VNPAY_RETURN_URL_FRONTEND, // URL frontend trả về
    vnp_IpnUrl: process.env.VNPAY_IPN_URL, // URL IPN của backend
};