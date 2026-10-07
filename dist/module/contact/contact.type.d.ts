import { z } from "zod";
export declare const createContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        projectDetails: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        budget: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        fullName: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodString;
        companyName: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        serviceRequired: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        userId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const updateContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        projectDetails: z.ZodOptional<z.ZodString>;
        budget: z.ZodOptional<z.ZodString>;
        fullName: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        companyName: z.ZodOptional<z.ZodString>;
        serviceRequired: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const contactQuerySchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
        limit: z.ZodOptional<z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<number, string>>, z.ZodNumber>>;
        search: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodOptional<z.ZodEnum<{
            fullName: "fullName";
            email: "email";
            createdAt: "createdAt";
        }>>;
        sortOrder: z.ZodOptional<z.ZodEnum<{
            asc: "asc";
            desc: "desc";
        }>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const createContactReplySchema: z.ZodObject<{
    body: z.ZodObject<{
        subject: z.ZodString;
        message: z.ZodString;
        userEmail: z.ZodOptional<z.ZodString>;
        userName: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const contactParamsSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const userEmailParamsSchema: z.ZodObject<{
    params: z.ZodObject<{
        userEmail: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=contact.type.d.ts.map