"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContactStats = exports.sendContactReply = exports.deleteContact = exports.updateContact = exports.addNewContact = exports.getContactsByUserEmail = exports.getContactById = exports.getAllContacts = void 0;
const contact_service_1 = require("./contact.service");
const email_1 = require("../../utils/email");
const getAllContacts = async (req, res) => {
    try {
        const query = req.validatedQuery || req.query;
        const result = await contact_service_1.contactService.getAllContacts(query);
        return res.status(200).json({
            success: true,
            message: "Contacts fetched successfully",
            data: result.contacts,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching contacts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch contacts",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getAllContacts = getAllContacts;
const getContactById = async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await contact_service_1.contactService.getContactById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
                data: null,
            });
        }
        const user = req.user;
        if (user?.role !== "ADMIN" && contact.userId !== user?.id && contact.email.toLowerCase() !== user?.email?.toLowerCase()) {
            return res.status(404).json({ success: false, message: "Contact not found", data: null });
        }
        return res.status(200).json({
            success: true,
            message: "Contact fetched successfully",
            data: contact,
        });
    }
    catch (error) {
        console.error("Error fetching contact:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch contact",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getContactById = getContactById;
const getContactsByUserEmail = async (req, res) => {
    try {
        const { userEmail } = req.params;
        const user = req.user;
        if (user?.role !== "ADMIN" && user?.email?.toLowerCase() !== userEmail.toLowerCase()) {
            return res.status(403).json({ success: false, message: "You can only view contact requests for your own account" });
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const result = await contact_service_1.contactService.getContactsByUserEmail(userEmail, page, limit);
        return res.status(200).json({
            success: true,
            message: "User contacts fetched successfully",
            data: result.contacts,
            pagination: result.pagination,
        });
    }
    catch (error) {
        console.error("Error fetching user contacts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user contacts",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getContactsByUserEmail = getContactsByUserEmail;
const addNewContact = async (req, res) => {
    try {
        const rawData = req.validatedBody || req.body;
        const contactData = {
            fullName: rawData.fullName || rawData.name || "Customer",
            email: rawData.email,
            projectDetails: rawData.projectDetails || rawData.message || "No details provided",
            budget: rawData.budget || "Flexible",
            companyName: rawData.companyName || "N/A",
            serviceRequired: rawData.serviceRequired || rawData.service || "General Inquiry",
            userId: req.user?.id || rawData.userId,
        };
        const contact = await contact_service_1.contactService.createContact(contactData);
        let notificationSent = false;
        try {
            notificationSent = await (0, email_1.sendContactNotification)(contactData);
        }
        catch (emailError) {
            console.error("Contact saved but notification email failed:", emailError);
        }
        return res.status(201).json({
            success: true,
            message: notificationSent ? "Contact submitted successfully" : "Contact submitted; email notification could not be sent",
            notificationSent,
            data: contact,
        });
    }
    catch (error) {
        console.error("Error creating contact:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create contact",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.addNewContact = addNewContact;
const updateContact = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.validatedBody || req.body;
        const contact = await contact_service_1.contactService.getContactById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
                data: null,
            });
        }
        const updatedContact = await contact_service_1.contactService.updateContact(id, updateData);
        if (!updatedContact) {
            return res.status(500).json({
                success: false,
                message: "Failed to update contact",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Contact updated successfully",
            data: updatedContact,
        });
    }
    catch (error) {
        console.error("Error updating contact:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update contact",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.updateContact = updateContact;
const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        const contact = await contact_service_1.contactService.getContactById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
                data: null,
            });
        }
        const deleted = await contact_service_1.contactService.deleteContact(id);
        if (!deleted) {
            return res.status(500).json({
                success: false,
                message: "Failed to delete contact",
                data: null,
            });
        }
        return res.status(200).json({
            success: true,
            message: "Contact deleted successfully",
            data: null,
        });
    }
    catch (error) {
        console.error("Error deleting contact:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete contact",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.deleteContact = deleteContact;
const sendContactReply = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, message } = req.validatedBody || req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User authentication required",
                data: null,
            });
        }
        const contact = await contact_service_1.contactService.getContactById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
                data: null,
            });
        }
        const replyData = {
            subject,
            message,
            contactId: id,
            userId,
        };
        const reply = await contact_service_1.contactService.createContactReply(replyData);
        try {
            await (0, email_1.sendContactReplyEmail)(contact.email, contact.fullName, subject, message);
        }
        catch (emailError) {
            console.error("Contact reply saved but email delivery failed:", emailError);
            return res.status(201).json({
                success: true,
                message: "Reply saved, but email delivery failed",
                emailSent: false,
                data: reply,
            });
        }
        return res.status(201).json({
            success: true,
            message: "Reply sent successfully",
            emailSent: true,
            data: reply,
        });
    }
    catch (error) {
        console.error("Error sending contact reply:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send reply",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.sendContactReply = sendContactReply;
const getContactStats = async (req, res) => {
    try {
        const stats = await contact_service_1.contactService.getContactStats();
        return res.status(200).json({
            success: true,
            message: "Contact statistics fetched successfully",
            data: stats,
        });
    }
    catch (error) {
        console.error("Error fetching contact statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch contact statistics",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};
exports.getContactStats = getContactStats;
//# sourceMappingURL=contact.controller.js.map