const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getDB } = require("../config/db");
const { sendOTPEmail } = require("../services/emailService");

const OTP_EXPIRY = 5 * 60 * 1000;
const RESEND_WAIT = 60 * 1000;
const MAX_ATTEMPTS = 5;

const hashOTP = (otp) =>
  crypto.createHash("sha256").update(otp).digest("hex");

const generateOTP = () =>
  crypto.randomInt(100000, 1000000).toString();

const response = (status, success, message, extra = {}) => ({
  status,
  success,
  message,
  ...extra
});

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Save and email a new OTP
const createAndSendOTP = async (email, purpose) => {
  const db = getDB();
  const collection = db.collection("emailOtps");

  const existing = await collection.findOne({ email, purpose });
  const now = Date.now();

  if (
    existing &&
    existing.lastSentAt &&
    now - existing.lastSentAt.getTime() < RESEND_WAIT
  ) {
    return {
      success: false,
      wait: Math.ceil(
        (RESEND_WAIT - (now - existing.lastSentAt.getTime())) / 1000
      )
    };
  }

  const otp = generateOTP();

  await collection.updateOne(
    { email, purpose },
    {
      $set: {
        otpHash: hashOTP(otp),
        expiresAt: new Date(now + OTP_EXPIRY),
        lastSentAt: new Date(now),
        attempts: 0,
        verifiedAt: null
      }
    },
    { upsert: true }
  );

  await sendOTPEmail(email, otp, purpose);

  return { success: true };
};

// REGISTRATION: REQUEST OTP
const registerUser = async (userData) => {
  try {
    const { name, email, mobile, password, role } = userData;

    if (!name || !email || !mobile || !password || !role) {
      return response(400, false, "All fields are required");
    }

    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail)) {
      return response(400, false, "Invalid email address");
    }

    if (String(password).length < 8) {
      return response(400, false, "Password must contain at least 8 characters");
    }

    if (!["customer", "owner"].includes(role)) {
      return response(400, false, "Invalid account role");
    }

    const existingUser = await User.findByEmail(normalizedEmail);

    if (existingUser) {
      return response(409, false, "Email is already registered");
    }

    const db = getDB();
    const pending = db.collection("pendingRegistrations");

    const hashedPassword = await bcrypt.hash(password, 12);

    await pending.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          name: String(name).trim(),
          email: normalizedEmail,
          mobile: String(mobile).trim(),
          password: hashedPassword,
          role,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    const sent = await createAndSendOTP(
      normalizedEmail,
      "registration"
    );

    if (!sent.success) {
      return response(
        429,
        false,
        `Please wait ${sent.wait} seconds before requesting another OTP`
      );
    }

    return response(
      200,
      true,
      "OTP sent to your email. Verify it to complete registration."
    );

  } catch (error) {
    console.error("Registration OTP error:", error.message);
    return response(500, false, "Unable to send registration OTP");
  }
};

// VERIFY REGISTRATION OTP AND CREATE ACCOUNT
const verifyRegistrationOTP = async ({ email, otp }) => {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail) || !/^\d{6}$/.test(String(otp || ""))) {
      return response(400, false, "Valid email and 6-digit OTP are required");
    }

    const db = getDB();
    const otps = db.collection("emailOtps");
    const pending = db.collection("pendingRegistrations");

    const record = await otps.findOne({
      email: normalizedEmail,
      purpose: "registration"
    });

    if (!record || record.expiresAt < new Date()) {
      return response(400, false, "OTP expired. Please request a new OTP.");
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return response(429, false, "Too many incorrect attempts. Request a new OTP.");
    }

    if (record.otpHash !== hashOTP(String(otp))) {
      await otps.updateOne(
        { _id: record._id },
        { $inc: { attempts: 1 } }
      );

      return response(400, false, "Incorrect OTP");
    }

    const registration = await pending.findOne({
      email: normalizedEmail
    });

    if (!registration) {
      return response(400, false, "Registration expired. Please register again.");
    }

    const existingUser = await User.findByEmail(normalizedEmail);

    if (existingUser) {
      await pending.deleteOne({ email: normalizedEmail });
      await otps.deleteOne({ _id: record._id });
      return response(409, false, "Email is already registered");
    }

    await User.create({
      name: registration.name,
      email: registration.email,
      mobile: registration.mobile,
      password: registration.password,
      role: registration.role,
      isActive: true,
      isEmailVerified: true
    });

    await pending.deleteOne({ email: normalizedEmail });
    await otps.deleteOne({ _id: record._id });

    return response(201, true, "Email verified. Registration successful.");

  } catch (error) {
    console.error("OTP verification error:", error.message);
    return response(500, false, "OTP verification failed");
  }
};

// RESEND REGISTRATION OTP
const resendRegistrationOTP = async ({ email }) => {
  try {
    const normalizedEmail = normalizeEmail(email);
    const db = getDB();

    const pending = await db.collection("pendingRegistrations")
      .findOne({ email: normalizedEmail });

    if (!pending) {
      return response(404, false, "Registration not found. Please register again.");
    }

    const result = await createAndSendOTP(
      normalizedEmail,
      "registration"
    );

    if (!result.success) {
      return response(429, false, `Please wait ${result.wait} seconds`);
    }

    return response(200, true, "A new OTP has been sent.");

  } catch (error) {
    console.error("Resend OTP error:", error.message);
    return response(500, false, "Unable to resend OTP");
  }
};

// LOGIN - EXISTING JWT BEHAVIOR PRESERVED
const loginUser = async (userData) => {
  try {
    const { email, password } = userData;

    if (!email || !password) {
      return response(400, false, "Email and password are required");
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findByEmail(normalizedEmail);

    if (!user || !await bcrypt.compare(password, user.password)) {
      return response(401, false, "Invalid email or password");
    }

    if (!user.isActive) {
      return response(403, false, "Your account is inactive");
    }

    // New accounts must have verified their email.
    // Existing accounts without this field remain compatible.
    if (user.isEmailVerified === false) {
      return response(403, false, "Please verify your email first");
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return response(200, true, "Login successful", {
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);
    return response(500, false, "Login failed");
  }
};

// FORGOT PASSWORD: REQUEST OTP
const forgotPassword = async ({ email }) => {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail)) {
      return response(400, false, "Enter a valid email address");
    }

    const user = await User.findByEmail(normalizedEmail);

    // Same response whether the email exists or not.
    if (user) {
      const result = await createAndSendOTP(
        normalizedEmail,
        "password_reset"
      );

      if (!result.success) {
        return response(
          429,
          false,
          `Please wait ${result.wait} seconds before requesting another OTP`
        );
      }
    }

    return response(
      200,
      true,
      "If the account exists, a password reset OTP has been sent."
    );

  } catch (error) {
    console.error("Forgot password error:", error.message);
    return response(500, false, "Unable to process password reset");
  }
};

// VERIFY PASSWORD RESET OTP
const verifyResetOTP = async ({ email, otp }) => {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail) || !/^\d{6}$/.test(String(otp || ""))) {
      return response(400, false, "Valid email and 6-digit OTP are required");
    }

    const otps = getDB().collection("emailOtps");

    const record = await otps.findOne({
      email: normalizedEmail,
      purpose: "password_reset"
    });

    if (!record || record.expiresAt < new Date()) {
      return response(400, false, "OTP expired. Request a new one.");
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return response(429, false, "Too many incorrect attempts. Request a new OTP.");
    }

    if (record.otpHash !== hashOTP(String(otp))) {
      await otps.updateOne(
        { _id: record._id },
        { $inc: { attempts: 1 } }
      );

      return response(400, false, "Incorrect OTP");
    }

    await otps.updateOne(
      { _id: record._id },
      { $set: { verifiedAt: new Date() } }
    );

    return response(200, true, "OTP verified. You can now reset your password.");

  } catch (error) {
    console.error("Reset OTP verification error:", error.message);
    return response(500, false, "OTP verification failed");
  }
};

// RESET PASSWORD
const resetPassword = async ({ email, newPassword }) => {
  try {
    const normalizedEmail = normalizeEmail(email);

    if (!validEmail(normalizedEmail) ||
        typeof newPassword !== "string" ||
        newPassword.length < 8) {
      return response(400, false, "Enter a valid email and password of at least 8 characters");
    }

    const db = getDB();
    const otps = db.collection("emailOtps");

    const record = await otps.findOne({
      email: normalizedEmail,
      purpose: "password_reset"
    });

    if (
      !record ||
      !record.verifiedAt ||
      record.expiresAt < new Date() ||
      Date.now() - record.verifiedAt.getTime() > OTP_EXPIRY
    ) {
      return response(403, false, "Verify a valid password reset OTP first");
    }

    const user = await User.findByEmail(normalizedEmail);

    if (!user) {
      return response(404, false, "Account not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await User.collection().updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        }
      }
    );

    await otps.deleteOne({ _id: record._id });

    return response(200, true, "Password reset successful. Please log in again.");

  } catch (error) {
    console.error("Password reset error:", error.message);
    return response(500, false, "Password reset failed");
  }
};

module.exports = {
  registerUser,
  verifyRegistrationOTP,
  resendRegistrationOTP,
  loginUser,
  forgotPassword,
  verifyResetOTP,
  resetPassword
};