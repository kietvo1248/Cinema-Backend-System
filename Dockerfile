# Sử dụng một image Node.js làm base image
# Chọn phiên bản Node.js phù hợp với dự án của bạn (ví dụ: 18, 20)
FROM node:22-alpine

# Thiết lập thư mục làm việc bên trong container
WORKDIR /app

# Sao chép package.json và package-lock.json để cài đặt dependencies
# Sử dụng wildcards để đảm bảo chỉ sao chép các tệp này
COPY package*.json ./

# Cài đặt các dependencies của dự án
# Sử dụng `--production` nếu bạn chỉ muốn cài đặt các gói cần thiết để chạy
RUN npm install

# Sao chép toàn bộ mã nguồn của ứng dụng vào thư mục làm việc
COPY . .

# Mở cổng mà ứng dụng backend đang lắng nghe (ví dụ: 5000)
EXPOSE 5000

# Lệnh để khởi chạy ứng dụng khi container được tạo
# Sử dụng 'npm run start' hoặc 'node server.js' tùy thuộc vào script của bạn
CMD [ "npm", "start" ]