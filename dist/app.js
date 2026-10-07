"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_xss_sanitizer_1 = require("express-xss-sanitizer");
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const app = (0, express_1.default)();
app.set("trust proxy", 1);
app.use((0, morgan_1.default)("dev"));
app.use((req, res, next) => {
    console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
app.use((0, helmet_1.default)());
app.use((0, express_xss_sanitizer_1.xss)());
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5000,
    skip: () => env_1.env.NODE_ENV === "development",
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: false },
});
app.use(limiter);
const rawOrigins = [
    env_1.env.FRONTEND_URL,
    ...env_1.env.CORS_ORIGINS.split(","),
    "https://themora.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5174",
];
const allowedOrigins = Array.from(new Set(rawOrigins
    .filter(Boolean)
    .map((origin) => origin.trim().replace(/\/+$/, ""))));
app.use((0, cors_1.default)({
    origin: (requestOrigin, callback) => {
        if (!requestOrigin)
            return callback(null, true);
        const normalizedOrigin = requestOrigin.trim().replace(/\/+$/, "");
        if (allowedOrigins.includes(normalizedOrigin) ||
            normalizedOrigin.endsWith(".vercel.app")) {
            return callback(null, true);
        }
        console.warn(`⚠️ Blocked by CORS: ${requestOrigin}`);
        return callback(null, true);
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
}));
app.use(express_1.default.json({
    limit: "10mb",
    verify: (req, _res, buffer) => {
        if (req.url?.includes("/webhook/lemonsqueezy")) {
            req.rawBody = Buffer.from(buffer);
        }
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
const routes_1 = __importDefault(require("./routes"));
app.use(routes_1.default);
app.get("/", (req, res) => {
    res.json({
        message: "Themora Backend Server",
        version: "1.0.0",
        status: "running",
    });
});
app.use((req, res) => {
    res.status(404).json({
        error: "Route not found",
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString(),
    });
});
app.use((err, req, res, next) => {
    console.error("Error:", err.stack);
    res.status(500).json({
        error: "Internal Server Error",
        message: env_1.env.NODE_ENV === "development"
            ? err.message
            : "Something went wrong!",
        timestamp: new Date().toISOString(),
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map