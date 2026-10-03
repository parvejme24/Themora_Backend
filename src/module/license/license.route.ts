import { Router } from 'express';
import {
  getAllLicenses,
  getLicenseById,
  validateLicense,
  revokeLicense,
  getLicenseStats,
  getUserLicenses,
} from './license.controller';
import { authenticateAndCheckStatus, authenticateAdminAndCheckStatus } from '../../middleware/authMiddleware';
import {
  validateLicenseKey,
  validateRevokeLicense,
  validateLicenseId,
  validateLicenseQuery,
} from './license.validate';

const router = Router();

// Admin routes
router.get('/licenses', authenticateAdminAndCheckStatus, validateLicenseQuery, getAllLicenses);
router.get('/licenses/stats', authenticateAdminAndCheckStatus, getLicenseStats);
router.get('/licenses/:id', authenticateAdminAndCheckStatus, validateLicenseId, getLicenseById);
router.post('/licenses/validate', validateLicenseKey, validateLicense);

// User routes
router.get('/user/licenses', authenticateAndCheckStatus, validateLicenseQuery, getUserLicenses);

// Admin routes
router.patch('/licenses/:id/revoke', authenticateAdminAndCheckStatus, validateLicenseId, validateRevokeLicense, revokeLicense);

export default router;
