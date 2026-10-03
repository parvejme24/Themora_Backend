import { Request, Response, NextFunction } from "express";
export declare const clearCache: (prefix?: string) => void;
export declare const cacheResponse: (ttlSeconds?: number) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=cache.d.ts.map