import { IContact, ICreateContact, IUpdateContact, IContactQuery, IContactStats, ICreateContactReply } from "./contact.interface";
export declare class ContactService {
    getAllContacts(query: IContactQuery): Promise<{
        contacts: IContact[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getContactById(id: string): Promise<IContact | null>;
    getContactsByUserEmail(userEmail: string, page?: number, limit?: number): Promise<{
        contacts: IContact[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    createContact(data: ICreateContact): Promise<IContact>;
    updateContact(id: string, data: IUpdateContact): Promise<IContact | null>;
    deleteContact(id: string): Promise<boolean>;
    createContactReply(data: ICreateContactReply): Promise<{
        user: {
            id: string;
            fullName: string;
            email: string;
            password: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            isBanned: boolean;
            isTrashed: boolean;
            isDeletedPermanently: boolean;
            otpCode: string | null;
            otpPurpose: import(".prisma/client").$Enums.OtpPurpose | null;
            otpExpiresAt: Date | null;
            otpVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
            isLoggedIn: boolean;
            lastLoginAt: Date | null;
            nextAuthExpiresAt: Date | null;
            nextAuthSecret: string | null;
            provider: string | null;
            providerId: string | null;
        };
        contact: {
            id: string;
            fullName: string;
            email: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            projectDetails: string;
            budget: string;
            companyName: string;
            serviceRequired: string;
        };
    } & {
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        subject: string;
        contactId: string;
    }>;
    getContactStats(): Promise<IContactStats>;
    contactExists(id: string): Promise<boolean>;
}
export declare const contactService: ContactService;
//# sourceMappingURL=contact.service.d.ts.map