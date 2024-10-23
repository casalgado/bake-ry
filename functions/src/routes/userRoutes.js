const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// Public authentication routes with rate limiting

router.post("/register", userController.register);
router.post("/login", userController.loginUser);

// Session management
router.post("/logout", userController.logoutUser);

module.exports = router;
