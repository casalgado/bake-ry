const express = require('express');
const authController = require('../controllers/AuthController');

const router = express.Router();

// Public authentication routes
router.post('/register', authController.register);
router.post('/login', authController.loginUser);

// Session management
router.post('/logout', authController.logoutUser);

module.exports = router;
