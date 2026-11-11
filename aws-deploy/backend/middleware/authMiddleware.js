
const jwt = require("jsonwebtoken");

const authenticateUser = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      status: 401,
      message: "Authentication token required"
    };
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return {
      success: true,
      user: decoded
    };

  } catch (error) {
    return {
      success: false,
      status: 401,
      message: "Invalid or expired token"
    };
  }
};

const authorizeRoles = (user, allowedRoles) => {
  if (!allowedRoles.includes(user.role)) {
    return {
      success: false,
      status: 403,
      message: "Access denied"
    };
  }

  return { success: true };
};

module.exports = {
  authenticateUser,
  authorizeRoles
};
