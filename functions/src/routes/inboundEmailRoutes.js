// routes/inboundEmailRoutes.js
const express = require('express');
const inboundEmailController = require('../controllers/inboundEmailController');

const router = express.Router();

// Called by the Cloudflare Email Worker, authenticated by a shared secret header.
// 25mb matches Cloudflare Email Routing's max message size.
router.post('/', express.raw({ type: 'message/rfc822', limit: '25mb' }), inboundEmailController.receive);

module.exports = router;
