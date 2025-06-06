// routes/whatsappRoutes.js
const express = require('express');
const whatsappController = require('../controllers/whatsappController');

const router = express.Router();

router.post('/wphook', whatsappController.wphook);
router.get('/wphook', whatsappController.wphook);

module.exports = router;
