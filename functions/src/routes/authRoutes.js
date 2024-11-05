const express = require('express');
const AuthController = require('../controllers/AuthController');
const AuthService = require('../services/AuthService');

const bindController = (controller) => ({
  register: controller.register.bind(controller),
  login: controller.login.bind(controller),
});

const controller = new AuthController(new AuthService());
const authController = bindController(controller);

const router = express.Router();

// Public authentication routes
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;
