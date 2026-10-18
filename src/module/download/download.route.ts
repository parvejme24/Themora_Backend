import { Request, Response, Router } from "express";
import { authenticateAdminAndCheckStatus, authenticateAndCheckStatus } from "../../middleware/authMiddleware";
import { clearCache } from "../../middleware/cache";
import { asyncHandler } from "../../utils/asyncHandler";
import { signUpload } from "../../utils/cloudinary";
import { sendResponse } from "../../utils/sendResponse";
import { validateRequest } from "../../utils/validateRequest";
import { downloadService } from "./download.service";
import {
  createVersionSchema,
  downloadRequestSchema,
  idParamSchema,
  productIdParamSchema,
  slugParamSchema,
  updateVersionSchema,
  uploadSignatureSchema,
} from "./download.validation";

const userOf = (req: Request) => (req as any).user as { id: string; role: string };

const router = Router();

// Public changelog
router.get(
  "/products/:slug/versions",
  validateRequest({ params: slugParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Changelog fetched", data: await downloadService.changelog(req.params.slug) });
  })
);

// Buyer downloads
router.get(
  "/me/downloads",
  authenticateAndCheckStatus,
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Downloads fetched", data: await downloadService.listMine(userOf(req)) });
  })
);

router.post(
  "/downloads/:productId",
  authenticateAndCheckStatus,
  validateRequest({ params: productIdParamSchema, body: downloadRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const links = await downloadService.createLinks(userOf(req), req.params.productId, { ...(req as any).validatedData, ip: req.ip });
    sendResponse(res, { message: "Download links are valid for 5 minutes", data: links });
  })
);

// Admin: direct-to-Cloudinary uploads and versions
router.post(
  "/admin/uploads/signature",
  authenticateAdminAndCheckStatus,
  validateRequest({ body: uploadSignatureSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Upload signature created", data: signUpload((req as any).validatedData.kind) });
  })
);

router.get(
  "/admin/products/:productId/versions",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Versions fetched", data: await downloadService.listVersions(req.params.productId) });
  })
);

router.post(
  "/admin/products/:productId/versions",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: productIdParamSchema, body: createVersionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const version = await downloadService.createVersion(req.params.productId, (req as any).validatedData);
    clearCache("/api/v1/products");
    sendResponse(res, { statusCode: 201, message: `Version ${version.version} released`, data: version });
  })
);

router.patch(
  "/admin/versions/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: idParamSchema, body: updateVersionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    sendResponse(res, { message: "Version updated", data: await downloadService.updateVersion(req.params.id, (req as any).validatedData) });
  })
);

router.delete(
  "/admin/versions/:id",
  authenticateAdminAndCheckStatus,
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await downloadService.deleteVersion(req.params.id);
    sendResponse(res, { message: "Version deleted" });
  })
);

export default router;
