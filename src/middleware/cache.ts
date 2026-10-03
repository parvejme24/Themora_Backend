import { Request, Response, NextFunction } from "express";

interface CacheEntry {
  data: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();

export const clearCache = (prefix?: string) => {
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

export const cacheResponse = (ttlSeconds: number = 30) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching for authenticated user-specific or admin routes
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

    res.json = (body: any) => {
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
