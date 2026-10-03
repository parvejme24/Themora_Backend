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

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use X-Forwarded-For header for Vercel
    return req.ip || req.connection.remoteAddress || "unknown";
  },
});
app.use(limiter);

// CORS configuration
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || [
//       "http://localhost:3000",
//       "http://localhost:3001",
//       "http://localhost:5174",
//       "https://tf-f-ts.vercel.app",
//       "https://techfynite.vercel.app",
//       "https://www.techfynite.com",
//       "https://www.techfynite.org",
//     ],
//     credentials: true,
//   })
// );

const allowedOrigins = [
  env.FRONTEND_URL,
  ...env.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Access-Control-Allow-Origin"],
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
