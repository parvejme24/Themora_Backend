import { Router } from 'express';
import { handleLemonSqueezyWebhook, handleFastSpringWebhook, testWebhook } from './webhook.controller';

const router = Router();

// Lemon Squeezy webhook endpoint
router.post('/webhook/lemonsqueezy', handleLemonSqueezyWebhook);
router.post('/webhooks/lemonsqueezy', handleLemonSqueezyWebhook);

// FastSpring webhook endpoint
router.post('/webhook/fastspring', handleFastSpringWebhook);
router.post('/webhooks/fastspring', handleFastSpringWebhook);

// Test webhook endpoint (for development)
router.get('/webhook/test', testWebhook);
router.get('/webhooks/test', testWebhook);

export default router;
