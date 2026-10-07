import { Request, Response } from "express";
import { contactService } from "./contact.service";
import { IContactQuery } from "./contact.interface";
import { sendContactNotification, sendContactReplyEmail } from "../../utils/email";

// Get all contacts (Admin/Super Admin only)
export const getAllContacts = async (req: Request, res: Response) => {
  try {
    const query: IContactQuery = (req as any).validatedQuery || req.query;
    const result = await contactService.getAllContacts(query);
    
    return res.status(200).json({
      success: true,
      message: "Contacts fetched successfully",
      data: result.contacts,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get contact by ID
export const getContactById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const contact = await contactService.getContactById(id);
    
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
        data: null,
      });
    }

    const user = (req as any).user;
    if (user?.role !== "ADMIN" && contact.userId !== user?.id && contact.email.toLowerCase() !== user?.email?.toLowerCase()) {
      return res.status(404).json({ success: false, message: "Contact not found", data: null });
    }
    
    return res.status(200).json({
      success: true,
      message: "Contact fetched successfully",
      data: contact,
    });
  } catch (error) {
    console.error("Error fetching contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get contacts by user email (with pagination support)
export const getContactsByUserEmail = async (req: Request, res: Response) => {
  try {
    const { userEmail } = req.params;
    const user = (req as any).user;
    if (user?.role !== "ADMIN" && user?.email?.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ success: false, message: "You can only view contact requests for your own account" });
    }
    
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    
    const result = await contactService.getContactsByUserEmail(userEmail, page, limit);
    
    return res.status(200).json({
      success: true,
      message: "User contacts fetched successfully",
      data: result.contacts,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching user contacts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user contacts",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Create new contact (Public route)
export const addNewContact = async (req: Request, res: Response) => {
  try {
    const rawData = (req as any).validatedBody || req.body;
    const contactData = {
      fullName: rawData.fullName || rawData.name || "Customer",
      email: rawData.email,
      projectDetails: rawData.projectDetails || rawData.message || "No details provided",
      budget: rawData.budget || "Flexible",
      companyName: rawData.companyName || "N/A",
      serviceRequired: rawData.serviceRequired || rawData.service || "General Inquiry",
      userId: (req as any).user?.id || rawData.userId,
    };
    
    const contact = await contactService.createContact(contactData);
    let notificationSent = false;
    try {
      notificationSent = await sendContactNotification(contactData);
    } catch (emailError) {
      console.error("Contact saved but notification email failed:", emailError);
    }
    
    return res.status(201).json({
      success: true,
      message: notificationSent ? "Contact submitted successfully" : "Contact submitted; email notification could not be sent",
      notificationSent,
      data: contact,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create contact",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update contact
export const updateContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = (req as any).validatedBody || req.body;
    
    // Check if contact exists
    const contact = await contactService.getContactById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
        data: null,
      });
    }
    
    const updatedContact = await contactService.updateContact(id, updateData);
    
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
  } catch (error) {
    console.error("Error updating contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update contact",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Delete contact
export const deleteContact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const contact = await contactService.getContactById(id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact not found",
        data: null,
      });
    }
    
    const deleted = await contactService.deleteContact(id);
    
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
  } catch (error) {
    console.error("Error deleting contact:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete contact",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Send contact reply (Admin/Super Admin only)
export const sendContactReply = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subject, message } = (req as any).validatedBody || req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
        data: null,
      });
    }
    
    const contact = await contactService.getContactById(id);
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
    
    const reply = await contactService.createContactReply(replyData);
    try {
      await sendContactReplyEmail(contact.email, contact.fullName, subject, message);
    } catch (emailError) {
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
  } catch (error) {
    console.error("Error sending contact reply:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send reply",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get contact statistics (Admin/Super Admin only)
export const getContactStats = async (req: Request, res: Response) => {
  try {
    const stats = await contactService.getContactStats();
    
    return res.status(200).json({
      success: true,
      message: "Contact statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching contact statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contact statistics",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
