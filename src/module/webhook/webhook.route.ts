import { Router } from 'express';
import { handleLemonSqueezyWebhook, handleFastSpringWebhook, testWebhook } from './webhook.controller';

const router = Router();

// Lemon Squeezy webhook endpoint
router.post('/webhook/lemonsqueezy', handleLemonSqueezyWebhook);

// FastSpring webhook endpoint
router.post('/webhook/fastspring', handleFastSpringWebhook);

// Test webhook endpoint (for development)
router.get('/webhook/test', testWebhook);

export default router;
