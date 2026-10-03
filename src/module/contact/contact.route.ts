
import { Router } from "express";
import {
  addNewContact,
  getAllContacts,
  sendContactReply,
  getContactsByUserEmail,
  getContactById,
  deleteContact,
  getContactStats,
} from "./contact.controller";
import {
  validateCreateContact,
  validateContactQuery,
  validateCreateContactReply,
  validateContactParams,
  validateUserEmailParams,
} from "./contact.validate";
import { authenticateAdminAndCheckStatus, authenticateAndCheckStatus, optionalAuth } from "../../middleware/authMiddleware";

const router = Router();

// Public route - anyone can submit contact form (with or without user account)
router.post("/contacts", optionalAuth, validateCreateContact, addNewContact);

// Admin/Super Admin only routes
router.get("/contacts", authenticateAdminAndCheckStatus, validateContactQuery, getAllContacts);
router.post("/contacts/:id/reply", authenticateAdminAndCheckStatus, validateContactParams, validateCreateContactReply, sendContactReply);

// Stats route must come before :id route
router.get("/contacts/stats", authenticateAdminAndCheckStatus, getContactStats);

// User routes - requires user account
router.get("/contacts/email/:userEmail", authenticateAndCheckStatus, validateUserEmailParams, getContactsByUserEmail);
router.get("/contacts/:id", optionalAuth, validateContactParams, getContactById);
router.delete("/contacts/:id", authenticateAdminAndCheckStatus, validateContactParams, deleteContact);

export default router;
