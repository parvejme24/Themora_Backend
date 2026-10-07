import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { xss } from "express-xss-sanitizer";
import morgan from "morgan";
import { env } from "./config/env";

const app = express();

// Trust proxy for Vercel deployment
app.set("trust proxy", 1);

// Logging middleware
app.use(morgan("dev"));

// Custom request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Security middleware
app.use(helmet());
app.use(xss());

// Rate limiting - optimized for fast API responses
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // allow up to 5000 requests per 15 minutes
  skip: () => env.NODE_ENV === "development", // skip in development
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: false },
});
app.use(limiter);


const rawOrigins = [
  env.FRONTEND_URL,
  ...env.CORS_ORIGINS.split(","),
  "https://themora.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5174",
];

const allowedOrigins = Array.from(
  new Set(
    rawOrigins
      .filter(Boolean)
      .map((origin) => origin.trim().replace(/\/+$/, ""))
  )
);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!requestOrigin) return callback(null, true);

      const normalizedOrigin = requestOrigin.trim().replace(/\/+$/, "");
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }

      console.warn(`⚠️ Blocked by CORS: ${requestOrigin}`);
      return callback(null, true); // Still allow in development/staging or pass through to avoid unexpected frontend outages
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Access-Control-Allow-Origin",
      "x-nextauth-secret",
    ],
  })
);

// Body parsing middleware
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buffer) => {
    if (req.url?.includes("/webhook/lemonsqueezy")) {
      (req as any).rawBody = Buffer.from(buffer);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Import routes
import routes from "./routes";

// Use routes
app.use(routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Themora Backend Server",
    version: "1.0.0",
    status: "running",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong!",
      timestamp: new Date().toISOString(),
    });
  }
);

export default app;
