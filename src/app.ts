import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { xss } from "express-xss-sanitizer";
import morgan from "morgan";
import pinoHttp from "pino-http";
import { logger } from "./config/monitoring";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { buildOpenApiSpec, swaggerHtml } from "./docs/openapi";

const app = express();

// Trust proxy for Vercel deployment
app.set("trust proxy", 1);

// Logging middleware
// Request logs: JSON in production (searchable in Vercel), readable in development
if (env.NODE_ENV === "production") {
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));
} else if (env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

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


const allowedOrigins = new Set(
  [env.FRONTEND_URL, ...env.CORS_ORIGINS.split(","), "https://themora.vercel.app"]
    .filter(Boolean)
    .map((origin) => origin.trim().replace(/\/+$/, ""))
);
if (env.NODE_ENV !== "production") {
  ["http://localhost:3000", "http://localhost:3001", "http://localhost:5174"].forEach((origin) => allowedOrigins.add(origin));
}

// Vercel preview deployments of the Themora frontend only (not any *.vercel.app site)
const PREVIEW_ORIGIN = /^https:\/\/themora(-frontend)?(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      // Server-to-server calls (webhooks, cron, curl) send no Origin header
      if (!requestOrigin) return callback(null, true);
      const origin = requestOrigin.trim().replace(/\/+$/, "");
      // Unknown origins get no CORS headers, so browsers block the response
      callback(null, allowedOrigins.has(origin) || PREVIEW_ORIGIN.test(origin));
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
    if (req.url?.includes("/webhooks/stripe")) {
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

// Health check for uptime monitoring
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, status: "ok", database: "up", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ success: false, status: "degraded", database: "down", timestamp: new Date().toISOString() });
  }
});

// API documentation (OpenAPI generated from the request validation schemas)
app.get("/api/v1/openapi.json", (_req, res) => {
  res.json(buildOpenApiSpec());
});
app.get("/docs", (_req, res) => {
  // Swagger UI loads its assets from jsDelivr
  res
    .setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:"
    )
    .type("html")
    .send(swaggerHtml);
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
