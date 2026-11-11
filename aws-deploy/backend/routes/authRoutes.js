const {
  authenticateUser
} = require("../middleware/authMiddleware");

const User = require("../models/User");

const {
  registerUser,
  verifyRegistrationOTP,
  resendRegistrationOTP,
  loginUser,
  forgotPassword,
  verifyResetOTP,
  resetPassword
} = require("../controllers/authController");

const sendResponse = (res, result) => {
  res.writeHead(result.status, {
    "Content-Type": "application/json"
  });

  res.end(JSON.stringify(result));
  return true;
};

const authRoutes = async (req, res, body = {}) => {
  try {
    const routes = {
      "POST /api/auth/register": registerUser,
      "POST /api/auth/verify-otp": verifyRegistrationOTP,
      "POST /api/auth/resend-otp": resendRegistrationOTP,
      "POST /api/auth/login": loginUser,
      "POST /api/auth/forgot-password": forgotPassword,
      "POST /api/auth/verify-reset-otp": verifyResetOTP,
      "POST /api/auth/reset-password": resetPassword
    };

    const key = `${req.method} ${req.url}`;
    const handler = routes[key];

    if (handler) {
      const result = await handler(body);
      return sendResponse(res, result);
    }

    // GET: Validate JWT and retrieve complete user profile.
    if (
      req.method === "GET" &&
      req.url === "/api/auth/profile"
    ) {
      const auth = authenticateUser(req);

      if (!auth.success) {
        return sendResponse(res, auth);
      }

      // Fetch complete user details from MongoDB.
      const user = await User.findById(auth.user.userId);

      if (!user) {
        return sendResponse(res, {
          status: 404,
          success: false,
          message: "User account not found"
        });
      }

      // Return safe profile information only.
      return sendResponse(res, {
        status: 200,
        success: true,
        message: "Authentication successful",

        user: {
          id: String(user._id),
          userId: String(user._id),
          name: user.name || "",
          email: user.email || "",
          mobile: user.mobile || "",
          role: user.role || auth.user.role
        }
      });
    }

    return false;

  } catch (error) {
    console.error("Auth route error:", error);

    return sendResponse(res, {
      status: 500,
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = authRoutes;