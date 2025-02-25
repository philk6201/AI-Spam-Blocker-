export const mailTemplate = () => {
  return `
  <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Scheduled</title>
    <style>
        /* General Styles */
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #ffffff;
        }
        .container {
            max-width: 600px;
            margin: 20px;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            background-color: #ffffff;
            text-align: center;
            color: #333333;
        }
        h1 {
            font-size: 28px;
            margin-bottom: 20px;
            color: #6a11cb;
        }
        p {
            margin-bottom: 20px;
            font-size: 16px;
            line-height: 1.8;
            color: #555555;
        }
        .meeting-details {
            background-color: #f1f1f1;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            color: #333333;
        }
        .meeting-details p {
            margin: 10px 0;
        }
        .btn {
            display: inline-block;
            margin: 20px auto;
            padding: 15px 30px;
            background-color: #2575fc;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            font-size: 16px;
            transition: background-color 0.3s ease;
        }
        .btn:hover {
            background-color: #1a5bb8;
        }
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #777777;
        }
    </style>
</head>

<body>
    <div class="container">
        <h1>Meeting Scheduled</h1>
        <p>You have a new meeting scheduled. Here are the details:</p>
        <div class="meeting-details">
            <p><strong>Meeting with:</strong> demo@example.com</p>
            <p><strong>Date and Time:</strong> July 1, 2024, at 10:00 AM (UTC)</p>
        </div>
        <a href="https://meet.google.com/demo-meeting-link" class="btn">Join Meeting</a>
        <p>If you didn't schedule this meeting, you can safely ignore this email.</p>
        <div class="footer">
            <p>Thank you,</p>
            <p>The Example Team</p>
        </div>
    </div>
</body>
</html>
  `;
};
