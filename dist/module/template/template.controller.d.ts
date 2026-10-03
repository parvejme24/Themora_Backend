import { Request, Response } from "express";
export declare const getAllTemplates: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTemplateById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteTemplate: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const downloadSourceFile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getNewArrivals: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTemplateStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=template.controller.d.ts.map