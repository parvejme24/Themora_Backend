import { prisma } from "../../config/database";
import { IContact, ICreateContact, IUpdateContact, IContactQuery, IContactStats, ICreateContactReply } from "./contact.interface";

export class ContactService {
  // Get all contacts with pagination and filtering
  public async getAllContacts(query: IContactQuery): Promise<{
    contacts: IContact[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const { page = 1, limit = 10, search, userId, email, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { projectDetails: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    if (email) {
      where.email = email;
    }
    
    // Get total count
    const total = await prisma.contact.count({ where });
    
    // Get contacts with pagination
    const contacts = await prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        user: true,
        replies: {
          include: {
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Get contact by ID
  public async getContactById(id: string): Promise<IContact | null> {
    return await prisma.contact.findUnique({
      where: { id },
      include: {
        user: true,
        replies: {
          include: {
            user: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  // Get contacts by user email (with pagination support)
  public async getContactsByUserEmail(userEmail: string, page = 1, limit = 10): Promise<{
    contacts: IContact[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const skip = (page - 1) * limit;
    const where = { email: userEmail };
    const [total, contacts] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: true,
          replies: {
            include: {
              user: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Create new contact
  public async createContact(data: ICreateContact): Promise<IContact> {
    return await prisma.contact.create({
      data,
      include: {
        user: true,
        replies: true,
      },
    });
  }

  // Update contact
  public async updateContact(id: string, data: IUpdateContact): Promise<IContact | null> {
    try {
      return await prisma.contact.update({
        where: { id },
        data,
        include: {
          user: true,
          replies: {
            include: {
              user: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      return null;
    }
  }

  // Delete contact
  public async deleteContact(id: string): Promise<boolean> {
    try {
      await prisma.contact.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Create contact reply
  public async createContactReply(data: ICreateContactReply) {
    return await prisma.contactReply.create({
      data,
      include: {
        user: true,
        contact: true,
      },
    });
  }

  // Get contact statistics
  public async getContactStats(): Promise<IContactStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalContacts,
      totalReplies,
      contactsThisMonth,
      contactsLastMonth,
      contactsWithReplies,
      recentContacts,
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contactReply.count(),
      prisma.contact.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      prisma.contact.count({
        where: {
          createdAt: {
            gte: startOfLastMonth,
            lte: endOfLastMonth,
          },
        },
      }),
      prisma.contact.count({
        where: {
          replies: {
            some: {},
          },
        },
      }),
      prisma.contact.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          replies: {
            include: {
              user: true,
            },
          },
        },
      }),
    ]);

    const averageRepliesPerContact = totalContacts > 0 ? totalReplies / totalContacts : 0;
    const repliedCount = contactsWithReplies;
    const pendingCount = Math.max(0, totalContacts - repliedCount);
    const inReviewCount = Math.floor(pendingCount / 2);
    const closedCount = repliedCount;

    return {
      totalContacts,
      totalReplies,
      contactsThisMonth,
      contactsLastMonth,
      averageRepliesPerContact,
      recentContacts,
      statusCounts: {
        PENDING: pendingCount,
        IN_REVIEW: inReviewCount,
        REPLIED: repliedCount,
        CLOSED: closedCount,
      },
    };
  }

  // Check if contact exists
  public async contactExists(id: string): Promise<boolean> {
    const contact = await prisma.contact.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!contact;
  }
}

export const contactService = new ContactService();
