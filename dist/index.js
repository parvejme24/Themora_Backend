"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const PORT = env_1.env.PORT;
const startServer = async () => {
    try {
        console.log('🚀 Starting Themora Backend Server...');
        console.log('📋 Environment:', env_1.env.NODE_ENV);
        console.log('🔌 Connecting to database...');
        await (0, database_1.connectDatabase)();
        app_1.default.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log('🎉 Server started successfully!');
            console.log('='.repeat(50));
            console.log(`🌐 Server URL: http://localhost:${PORT}`);
            console.log(`📝 Environment: ${env_1.env.NODE_ENV}`);
            console.log(`⏰ Started at: ${new Date().toISOString()}`);
            console.log('='.repeat(50));
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});
if (env_1.env.NODE_ENV !== 'production' || !env_1.env.VERCEL) {
    startServer();
}
//# sourceMappingURL=index.js.map