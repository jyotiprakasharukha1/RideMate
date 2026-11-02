
require("dotenv").config();

console.log("Email configured:", Boolean(process.env.EMAIL_USER));
console.log("App password configured:", Boolean(process.env.EMAIL_APP_PASSWORD));

const http = require("http");
const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const trackingRoutes = require("./routes/trackingRoutes");

const PORT = process.env.PORT || 5000;

const server = http.createServer(async (req, res) => {
  try {
    // CORS configuration
    const allowedOrigins = [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5175",
      "http://127.0.0.1:5175",
      ...(process.env.FRONTEND_URL || "")
        .split(",")
        .map(url => url.trim())
        .filter(Boolean)
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Vary", "Origin");

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    // Health check
    if (req.method === "GET" && req.url === "/api/health") {
      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        success: true,
        message: "RideMate backend is running!",
        database: "Connected"
      }));
    }

    let body = {};

    // Read request body
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      let rawBody = "";
      let bodySize = 0;

      for await (const chunk of req) {
        bodySize += chunk.length;

        if (bodySize > 1024 * 1024) {
          res.writeHead(413, {
            "Content-Type": "application/json"
          });

          return res.end(JSON.stringify({
            success: false,
            message: "Request body is too large"
          }));
        }

        rawBody += chunk.toString();
      }

      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    }

    // API routes
    if (await authRoutes(req, res, body)) return;
    if (await vehicleRoutes(req, res, body)) return;
    if (await bookingRoutes(req, res, body)) return;
    if (await trackingRoutes(req, res, body)) return;

    // Route not found
    res.writeHead(404, {
      "Content-Type": "application/json"
    });

    res.end(JSON.stringify({
      success: false,
      message: "API route not found"
    }));

  } catch (error) {
    console.error("Server request error:", error);

    if (!res.headersSent) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        message: "Request failed"
      }));
    }
  }
});

// Start server after database connection
async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    await connectDB();

    server.listen(PORT, () => {
      console.log("MongoDB Atlas connected successfully!");
      console.log(`RideMate backend running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
      console.log(`Vehicles: http://localhost:${PORT}/api/vehicles`);
    });

  } catch (error) {
    console.error("RideMate startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
