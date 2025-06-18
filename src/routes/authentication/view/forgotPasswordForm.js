
const forgotPasswordForm = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 1px solid #eeeeee;
        }
        .header h1 {
            color: #333333;
        }
        .content {
            padding: 20px 0;
            line-height: 1.6;
            color: #555555;
        }
        .code {
            display: block;
            width: fit-content;
            margin: 20px auto;
            padding: 10px 20px;
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
            background-color: #e9f7ff;
            border: 1px solid #007bff;
            border-radius: 5px;
            text-align: center;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #eeeeee;
            font-size: 12px;
            color: #aaaaaa;
        }
        .button {
            display: inline-block;
            background-color: #007bff;
            color: #ffffff;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Yêu cầu Đặt lại Mật khẩu</h1>
        </div>
        <div class="content">
            <p>Xin chào,</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình. Vui lòng sử dụng mã xác minh dưới đây để hoàn tất quá trình:</p>
            <span class="code">{{RESET_CODE}}</span>
            <p>Mã này sẽ hết hạn sau 10 phút.</p>
            <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này.</p>
            <p>Trân trọng,</p>
            <p>Đội ngũ của bạn</p>
        </div>
        <div class="footer">
            <p>Đây là một email tự động, vui lòng không trả lời.</p>
            <p>&copy; Movie Theather. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

module.exports = forgotPasswordForm;