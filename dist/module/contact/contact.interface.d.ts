import { Contact, ContactReply, User } from "@prisma/client";
export interface IContact extends Contact {
    user?: User | null;
    replies?: ContactReply[];
}
export interface ICreateContact {
    projectDetails: string;
    budget: string;
    fullName: string;
    email: string;
    companyName: string;
    serviceRequired: string;
    userId?: string;
}
export interface IUpdateContact {
    projectDetails?: string;
    budget?: string;
    fullName?: string;
    email?: string;
    companyName?: string;
    serviceRequired?: string;
}
export interface IContactQuery {
    page?: number;
    limit?: number;
    search?: string;
    userId?: string;
    email?: string;
    sortBy?: 'createdAt' | 'fullName' | 'email';
    sortOrder?: 'asc' | 'desc';
}
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
export interface IContactReply extends ContactReply {
    user?: User | null;
    contact?: Contact | null;
}
export interface ICreateContactReply {
    subject: string;
    message: string;
    contactId: string;
    userId: string;
}
//# sourceMappingURL=contact.interface.d.ts.map