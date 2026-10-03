"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheResponse = exports.clearCache = void 0;
const memoryCache = new Map();
const clearCache = (prefix) => {
    if (!prefix) {
        memoryCache.clear();
        return;
    }
    for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
            memoryCache.delete(key);
        }
    }
};
exports.clearCache = clearCache;
const cacheResponse = (ttlSeconds = 30) => {
    return (req, res, next) => {
        if (req.method !== "GET") {
            return next();
        }
        if (req.headers.authorization && (req.url.includes("/user/") || req.url.includes("/admin/") || req.url.includes("/me"))) {
            return next();
        }
        const key = `${req.originalUrl || req.url}`;
        const cached = memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
            res.setHeader("X-Cache", "HIT");
            return res.status(200).json(cached.data);
        }
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200 && body && body.success !== false) {
                memoryCache.set(key, {
                    data: body,
                    expiry: Date.now() + ttlSeconds * 1000,
                });
            }
            res.setHeader("X-Cache", "MISS");
            return originalJson(body);
        };
        next();
    };
};
exports.cacheResponse = cacheResponse;
//# sourceMappingURL=cache.js.map