const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

const sendOTPEmail = async (email, otp, purpose) => {
  const subject =
    purpose === "registration"
      ? "Verify your RideMate account"
      : "RideMate password reset OTP";

  const message =
    purpose === "registration"
      ? "Use this OTP to verify your RideMate email address."
      : "Use this OTP to reset your RideMate password.";

  await transporter.sendMail({
    from: `"RideMate" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    text: `${message}\n\nYour OTP is: ${otp}\n\nThis OTP expires in 5 minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:Arial;padding:25px">
        <h2>RideMate Verification</h2>
        <p>${message}</p>
        <h1 style="letter-spacing:8px">${otp}</h1>
        <p>This OTP expires in 5 minutes.</p>
        <p>Do not share this code with anyone.</p>
      </div>
    `
  });
};

module.exports = { sendOTPEmail };