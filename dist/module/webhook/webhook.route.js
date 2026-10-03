"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_controller_1 = require("./webhook.controller");
const router = (0, express_1.Router)();
router.post('/webhook/lemonsqueezy', webhook_controller_1.handleLemonSqueezyWebhook);
router.post('/webhook/fastspring', webhook_controller_1.handleFastSpringWebhook);
router.get('/webhook/test', webhook_controller_1.testWebhook);
exports.default = router;
//# sourceMappingURL=webhook.route.js.map