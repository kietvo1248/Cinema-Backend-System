Cinema Backend System (Node.js, Express, MongoDB, JWT)
=====================================
Introduction
This project is a RESTful API backend for a cinema system, built with Node.js, Express, and MongoDB. It provides core functionalities for user authentication, including registration, login, and protected routes, using Bcrypt for secure password hashing and JSON Web Tokens (JWT) for session management.
<img src="https://scontent.fsgn2-8.fna.fbcdn.net/v/t39.30808-6/290612422_750526599597283_3367313551794571151_n.jpg?_nc_cat=102&ccb=1-7&_nc_sid=6ee11a&_nc_eui2=AeEXg4eKZV55FcUNSuV4EL_IrjLjKCTuDLCuMuMoJO4MsLZ2-nex5CDASFdzw0c8YXrDBmLbG2wexIljxuQjglyT&_nc_ohc=2UvAL8NeJlIQ7kNvwHL5SVP&_nc_oc=AdnnyvoH-Jw_WWx6o9QY8UcQgOdSiffABvqtklx2hDN8EcQ7bP_6ACB1zfzxRfalMxU&_nc_zt=23&_nc_ht=scontent.fsgn2-8.fna&_nc_gid=Bx21P6OUynhcea-V24AzpA&oh=00_AfSYf0RErLqc2WeQstJtZfLyBAtHWG_PqZ7ta8RUg5bxbg&oe=688F70CD" />
<img src="https://i.ytimg.com/vi/2P8p1P-kGyw/maxresdefault.jpg" />
<img src="https://sohanews.sohacdn.com/zoom/700_438/160588918557773824/2023/12/7/photo1701922722163-1701922722307797925176.jpg" />
<img src="https://cdnphoto.dantri.com.vn/8HCEsdkRMM0BNgBrV9E8zFBKEXU=/thumb_w/1020/2023/07/27/1554134331712214183201933810056015126893647n-edited-1690442070141.jpeg" />
<img src="https://langnghesondong.com.vn/wp-content/uploads/2023/09/Thich-Tam-Phuc-3.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/p2kwmry3gvhtfvek55np.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/uizthlwguvuysom8nq3a.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/rsvu7txb4qizuzuonoxr.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/n96cztwiokvahcnbrych.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/fi7kdtktrquugvnumwv8.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850515/rxvquj4xymxmwwglwffa.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850514/h1qml1nce7dleldwrox8.jpg" />
<img src="https://res.cloudinary.com/dsqbxgh88/image/upload/v1753850515/xdi9kjzngn4ygei5odos.jpg" />    


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
