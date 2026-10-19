
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
import { authenticateAndCheckStatus, optionalAuth } from "../../middleware/authMiddleware";
import { authorize } from "../../middleware/permissions";

const router = Router();

// Public route - anyone can submit contact form (with or without user account)
router.post("/contacts", optionalAuth, validateCreateContact, addNewContact);

// Admin/Super Admin only routes
router.get("/contacts", authorize("support"), validateContactQuery, getAllContacts);
router.post("/contacts/:id/reply", authorize("support"), validateContactParams, validateCreateContactReply, sendContactReply);

// Stats route must come before :id route
router.get("/contacts/stats", authorize("support"), getContactStats);

// User routes - requires user account
router.get("/contacts/email/:userEmail", authenticateAndCheckStatus, validateUserEmailParams, getContactsByUserEmail);
router.get("/contacts/:id", optionalAuth, validateContactParams, getContactById);
router.delete("/contacts/:id", authorize("support"), validateContactParams, deleteContact);

export default router;
