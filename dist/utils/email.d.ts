export declare function sendOtpEmail(to: string, otp: string, purpose?: "registration" | "password reset"): Promise<void>;
export declare function sendContactNotification(contact: {
    fullName: string;
    email: string;
    companyName: string;
    serviceRequired: string;
    budget: string;
    projectDetails: string;
}): Promise<boolean>;
export declare function sendContactReplyEmail(to: string, name: string, subject: string, message: string): Promise<void>;
//# sourceMappingURL=email.d.ts.map