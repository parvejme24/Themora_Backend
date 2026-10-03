import "dotenv/config";
export declare const env: {
    NODE_ENV: "development" | "production" | "test";
    DATABASE_URL: string;
    PORT: number;
    FRONTEND_URL: string;
    CORS_ORIGINS: string;
    BCRYPT_ROUNDS: number;
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_USER: string;
    SMTP_PASS: string;
    EMAIL_FROM: string;
    CONTACT_NOTIFICATION_EMAIL: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    CLOUDINARY_URL: string;
    LEMONSQUEEZY_API_KEY: string;
    LEMONSQUEEZY_STORE_ID: string;
    LEMONSQUEEZY_WEBHOOK_SECRET: string;
    VERCEL?: string | undefined;
};
//# sourceMappingURL=env.d.ts.map