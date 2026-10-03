"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLOUDINARY_URL = exports.CLOUDINARY_API_SECRET = exports.CLOUDINARY_API_KEY = exports.CLOUDINARY_CLOUD_NAME = exports.CONTACT_NOTIFICATION_EMAIL = exports.EMAIL_FROM = exports.SMTP_PASS = exports.SMTP_USER = exports.SMTP_PORT = exports.SMTP_HOST = exports.PORT = exports.FRONTEND_URL = exports.BCRYPT_ROUNDS = exports.DATABASE_URL = void 0;
const env_1 = require("./env");
exports.DATABASE_URL = env_1.env.DATABASE_URL;
exports.BCRYPT_ROUNDS = env_1.env.BCRYPT_ROUNDS;
exports.FRONTEND_URL = env_1.env.FRONTEND_URL;
exports.PORT = env_1.env.PORT;
exports.SMTP_HOST = env_1.env.SMTP_HOST;
exports.SMTP_PORT = env_1.env.SMTP_PORT;
exports.SMTP_USER = env_1.env.SMTP_USER;
exports.SMTP_PASS = env_1.env.SMTP_PASS;
exports.EMAIL_FROM = env_1.env.EMAIL_FROM;
exports.CONTACT_NOTIFICATION_EMAIL = env_1.env.CONTACT_NOTIFICATION_EMAIL;
exports.CLOUDINARY_CLOUD_NAME = env_1.env.CLOUDINARY_CLOUD_NAME;
exports.CLOUDINARY_API_KEY = env_1.env.CLOUDINARY_API_KEY;
exports.CLOUDINARY_API_SECRET = env_1.env.CLOUDINARY_API_SECRET;
exports.CLOUDINARY_URL = env_1.env.CLOUDINARY_URL;
//# sourceMappingURL=secret.js.map