
require("dotenv").config();

const http = require("http");
const fs = require("node:fs");
const path = require("node:path");

const { connectDB } = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const trackingRoutes = require("./routes/trackingRoutes");

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, "public");

// Show whether email configuration is available without logging secrets.
console.log("Email configured:", Boolean(process.env.EMAIL_USER));
console.log(
  "App password configured:",
  Boolean(process.env.EMAIL_APP_PASSWORD)
);

// Static file content types, including Cesium assets.
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".xml": "application/xml",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".ktx2": "image/ktx2",
  ".b3dm": "application/octet-stream",
  ".pnts": "application/octet-stream",
  ".terrain": "application/octet-stream",
  ".geojson": "application/geo+json",
  ".topojson": "application/json",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

// Serve the React production build.
async function serveFrontend(req, res, url) {
  if (!["GET", "HEAD"].includes(req.method)) {
    return false;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Invalid URL");
    return true;
  }

  // Resolve the requested file inside backend/public.
  const relativePath = pathname.replace(/^\/+/, "");

  const filePathCandidate = path.resolve(
    PUBLIC_DIR,
    relativePath
  );

  // Prevent path traversal outside the public directory.
  if (
    filePathCandidate !== PUBLIC_DIR &&
    !filePathCandidate.startsWith(PUBLIC_DIR + path.sep)
  ) {
    res.writeHead(404);
    res.end("Not found");
    return true;
  }

  let filePath = filePathCandidate;
  let stats;

  try {
    stats = await fs.promises.stat(filePath);

    // Support directory index files.
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stats = await fs.promises.stat(filePath);
    }

    if (!stats.isFile()) {
      throw new Error("Requested path is not a file");
    }
  } catch {
    // Missing static files must return 404, not React HTML.
    if (path.extname(pathname)) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end("File not found");
      return true;
    }

    // React SPA fallback for routes such as /owner/dashboard.
    filePath = path.join(PUBLIC_DIR, "index.html");

    try {
      stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        throw new Error("index.html is not a file");
      }
    } catch {
      res.writeHead(503, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Frontend is not deployed");
      return true;
    }
  }

  const extension = path.extname(filePath).toLowerCase();

  const contentType =
    MIME_TYPES[extension] || "application/octet-stream";

  const filename = path.basename(filePath);

  let cacheControl = "public, max-age=86400";

  if (filename === "index.html") {
    cacheControl = "no-cache";
  } else if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/cesium/")
  ) {
    cacheControl = "public, max-age=31536000, immutable";
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stats.size,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": cacheControl
  });

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  const stream = fs.createReadStream(filePath);

  stream.on("error", (error) => {
    console.error("Frontend file error:", error);
    res.destroy(error);
  });

  stream.pipe(res);

  return true;
}

// Main HTTP server.
const server = http.createServer(async (req, res) => {
  try {
    // CORS configuration for local development.
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

    // Handle browser preflight requests.
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    // Parse the URL so query parameters do not break route matching.
    const requestUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    // Send all non-API browser requests to the React frontend.
    if (
      !requestUrl.pathname.startsWith("/api/") &&
      requestUrl.pathname !== "/api"
    ) {
      if (await serveFrontend(req, res, requestUrl)) {
        return;
      }
    }

    // Health check.
    if (
      req.method === "GET" &&
      requestUrl.pathname === "/api/health"
    ) {
      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      return res.end(
        JSON.stringify({
          success: true,
          message: "RideMate backend is running!",
          database: "Connected"
        })
      );
    }

    let body = {};

    // Read request body.
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      let rawBody = "";
      let bodySize = 0;

      for await (const chunk of req) {
        bodySize += chunk.length;

        if (bodySize > 1024 * 1024) {
          res.writeHead(413, {
            "Content-Type": "application/json"
          });

          return res.end(
            JSON.stringify({
              success: false,
              message: "Request body is too large"
            })
          );
        }

        rawBody += chunk.toString();
      }

      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    }

    // Existing RideMate API routes.
    if (await authRoutes(req, res, body)) return;

    if (await vehicleRoutes(req, res, body)) return;

    if (await bookingRoutes(req, res, body)) return;

    if (await trackingRoutes(req, res, body)) return;

    // API route not found.
    res.writeHead(404, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        success: false,
        message: "API route not found"
      })
    );

  } catch (error) {
    console.error("Server request error:", error);

    if (!res.headersSent) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          success: false,
          message: "Request failed"
        })
      );
    }
  }
});

// Start server only after MongoDB connects successfully.
async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from environment variables");
    }

    await connectDB();

    server.listen(PORT, "0.0.0.0", () => {
      console.log("MongoDB Atlas connected successfully!");
      console.log(`RideMate application running on port ${PORT}`);
      console.log(`Health: /api/health`);
      console.log(`Vehicles: /api/vehicles`);
      console.log(`Frontend directory: ${PUBLIC_DIR}`);
    });

  } catch (error) {
    console.error("RideMate startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
