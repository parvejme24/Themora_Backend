import { Contact, ContactReply, User } from "@prisma/client";

// Base Contact interface
export interface IContact extends Contact {
  user?: User | null;
  replies?: ContactReply[];
}

// Contact creation interface
export interface ICreateContact {
  projectDetails: string;
  budget: string;
  fullName: string;
  email: string;
  companyName: string;
  serviceRequired: string;
  userId?: string;
}

// Contact update interface
export interface IUpdateContact {
  projectDetails?: string;
  budget?: string;
  fullName?: string;
  email?: string;
  companyName?: string;
  serviceRequired?: string;
}

// Contact query interface
export interface IContactQuery {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
  email?: string;
  sortBy?: 'createdAt' | 'fullName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

// Contact stats interface
export interface IContactStats {
  totalContacts: number;
  totalReplies: number;
  contactsThisMonth: number;
  contactsLastMonth: number;
  averageRepliesPerContact: number;
  recentContacts: IContact[];
  statusCounts?: {
    PENDING: number;
    IN_REVIEW: number;
    REPLIED: number;
    CLOSED: number;
  };
}

// Contact reply interface
export interface IContactReply extends ContactReply {
  user?: User | null;
  contact?: Contact | null;
}

// Create contact reply interface
export interface ICreateContactReply {
  subject: string;
  message: string;
  contactId: string;
  userId: string;
}
