import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

// Validates body/query/params with Zod. Parsed values are stored on
// req.validatedData / req.validatedQuery / req.validatedParams (the names the
// existing modules already use). ZodErrors go to the global error handler,
// which responds with 400.
export const validateRequest =
  (schemas: RequestSchemas) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) (req as any).validatedParams = schemas.params.parse(req.params);
      if (schemas.query) (req as any).validatedQuery = schemas.query.parse(req.query);
      if (schemas.body) (req as any).validatedData = schemas.body.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
