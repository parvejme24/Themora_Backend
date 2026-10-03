"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.disconnectDatabase = exports.connectDatabase = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    log: ['warn', 'error'],
});
exports.prisma = prisma;
const connectDatabase = async () => {
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
        try {
            attempts++;
            await prisma.$connect();
            console.log('✅ Database connected successfully');
            return;
        }
        catch (error) {
            console.error(`❌ Database connection attempt ${attempts} failed:`, error);
            if (attempts >= maxAttempts) {
                process.exit(1);
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }
    }
};
exports.connectDatabase = connectDatabase;
const disconnectDatabase = async () => {
    try {
        await prisma.$disconnect();
        console.log('✅ Database disconnected successfully');
    }
    catch (error) {
        console.error('❌ Database disconnection failed:', error);
    }
};
exports.disconnectDatabase = disconnectDatabase;
//# sourceMappingURL=database.js.map