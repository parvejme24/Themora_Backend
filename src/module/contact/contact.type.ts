import { z } from "zod";

// Contact creation validation schema
export const createContactSchema = z.object({
  body: z.object({
    projectDetails: z.string().optional(),
    message: z.string().optional(),
    budget: z.string().optional().default("Flexible"),
    fullName: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email("Invalid email format"),
    companyName: z.string().optional().default("N/A"),
    serviceRequired: z.string().optional().default("General Inquiry"),
    userId: z.string().uuid().optional(),
  }).refine(
    (data) => (data.projectDetails && data.projectDetails.length >= 3) || (data.message && data.message.length >= 3),
    {
      message: "Message or project details must be at least 3 characters",
      path: ["message"],
    }
  ).refine(
    (data) => (data.fullName && data.fullName.length >= 2) || (data.name && data.name.length >= 2),
    {
      message: "Full name or name is required",
      path: ["fullName"],
    }
  ),
});

// Contact update validation schema
export const updateContactSchema = z.object({
  body: z.object({
    projectDetails: z.string().min(10, "Project details must be at least 10 characters").optional(),
    budget: z.string().min(1, "Budget is required").optional(),
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    email: z.string().email("Invalid email format").optional(),
    companyName: z.string().min(1, "Company name is required").optional(),
    serviceRequired: z.string().min(1, "Service required is mandatory").optional(),
  }),
});

// Contact query validation schema
export const contactQuerySchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    search: z.string().optional(),
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    sortBy: z.enum(['createdAt', 'fullName', 'email']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
});

// Contact reply validation schema
export const createContactReplySchema = z.object({
  body: z.object({
    subject: z.string().min(1, "Subject is required"),
    message: z.string().min(10, "Message must be at least 10 characters"),
    // Allow additional fields from frontend
    userEmail: z.string().optional(),
    userName: z.string().optional(),
    userId: z.string().optional(),
  }),
});

// Contact ID parameter validation schema
export const contactParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid contact ID format"),
  }),
});

// User email parameter validation schema
export const userEmailParamsSchema = z.object({
  params: z.object({
    userEmail: z.string().email("Invalid email format"),
  }),
});
