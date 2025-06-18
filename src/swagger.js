const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cinema Backend API',
      version: '1.0.0',
      description: 'Tài liệu API cho hệ thống rạp chiếu phim',
    },
    servers: [
      {
        url: 'http://localhost:5000',
      },
    ],
    tags: [
      { name: 'Movie', description: 'Quản lý phim' },
      { name: 'Auth', description: 'Xác thực người dùng' },
      { name: 'User', description: 'Tính năng người dùng' },
    ]
  },
  apis: ['./routes/**/*.js'], // ✅ sửa ở đây
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
