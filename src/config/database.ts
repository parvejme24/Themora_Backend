import { PrismaClient } from '@prisma/client';
import { env } from './env';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

export const connectDatabase = async (): Promise<void> => {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return;
    } catch (error) {
      console.error(`❌ Database connection attempt ${attempts} failed:`, error);
      if (attempts >= maxAttempts) {
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
};

export { prisma };