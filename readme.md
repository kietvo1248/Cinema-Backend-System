Cinema Backend System (Node.js, Express, MongoDB, JWT)
=====================================
Introduction
This project is a RESTful API backend for a cinema system, built with Node.js, Express, and MongoDB. It provides core functionalities for user authentication, including registration, login, and protected routes, using Bcrypt for secure password hashing and JSON Web Tokens (JWT) for session management.

Key Features
User Registration: Create new user accounts with username, full name, password, and role.

Secure Password Hashing: Passwords are securely hashed using Bcrypt.

User Login: Authenticate users and issue JSON Web Tokens (JWT).

JWT-based Authentication: Secure API routes require a valid JWT.

Protected Routes: Example endpoint for authenticated users.

User Logout: Instructs the client to discard their JWT.

Environment Configuration: Sensitive data (DB URI, JWT secret) is managed via .env.

Modular Design: Clean separation of concerns with dedicated folders for models, routes, config, and middleware.

Project Structure
my-login-backend/
├── node_modules/           # Project dependencies
├── .env                    # Environment variables
├── package.json            # Project metadata and dependencies
├── app.js                  # Main server entry point
├── models/
│   └── User.js             # User Schema and Model
├── routes/
│   └── auth.js             # Authentication API endpoints
├── config/
│   └── db.js               # MongoDB connection logic
└── middleware/
    └── authMiddleware.js   # JWT authentication middleware

System Requirements
Node.js (v14+ recommended)

npm (Node Package Manager)

MongoDB (Local or Atlas)

Postman (or similar API testing tool)

Setup & Installation
Clone or Create Project:

git clone <YOUR_REPO_URL>
cd my-login-backend

Initialize Node.js Project:

npm init -y

Install Dependencies:

npm install express mongoose dotenv bcryptjs jsonwebtoken cors
npm install -D nodemon # For development auto-restarts

(Add "dev": "nodemon app.js" to scripts in package.json).

Create .env file:
In the project root, create .env and configure:

MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/your_cinema_db?retryWrites=true&w=majority
DB_NAME=your_cinema_db # Must match DB name in MONGODB_URI
JWT_SECRET=your_long_random_and_secure_jwt_secret

(Generate JWT_SECRET with node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

Usage
1. Start the Backend Server
Open your terminal in the project directory and run:

npm start
# or for development: npm run dev

You should see:
MongoDB connected to database: <your_database_name>!
Server running on port 5000

2. API Endpoints (via Postman)
A. Register New User
POST http://localhost:5000/api/auth/register

Headers: Content-Type: application/json

Body (raw, JSON):

{
    "username": "cinemaguy",
    "fullname": "John Doe",
    "password": "securepassword123",
    "role": "user"
}

Response (201 Created): {"message": "Đăng ký người dùng thành công!"}

B. User Login
POST http://localhost:5000/api/auth/login

Headers: Content-Type: application/json

Body (raw, JSON):

{
    "username": "cinemaguy",
    "password": "securepassword123"
}

Response (200 OK): { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
(Copy this token for protected routes)

C. Access Protected Route (/api/auth/home)
GET http://localhost:5000/api/auth/home

Headers: Authorization: Bearer <YOUR_JWT_TOKEN>

Response (200 OK): {"message": "Chào mừng bạn đến với trang chủ! Đây là dữ liệu được bảo vệ.", ...}

D. User Logout
GET http://localhost:5000/api/auth/logout

Headers: Authorization: Bearer <YOUR_JWT_TOKEN>

Response (200 OK): {"message": "Đăng xuất thành công. Vui lòng xóa token trên client."}

Technologies Used
Node.js: JavaScript runtime environment.

Express.js: Web framework for Node.js.

MongoDB: NoSQL database.

Mongoose: ODM for Node.js and MongoDB.

Bcrypt.js: Password hashing library.

jsonwebtoken: Library for JWT creation and verification.

dotenv: For loading environment variables.

cors: Express middleware for Cross-Origin Resource Sharing.