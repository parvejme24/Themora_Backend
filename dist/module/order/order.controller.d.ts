import { Request, Response } from "express";
export declare const getAllOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getOrderById: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createOrder: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getOrderStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getUserOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getTopSellingTemplates: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=order.controller.d.ts.map