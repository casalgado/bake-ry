const userService = require("../services/userService");

// possible roles: bakery_customer, bakery_staff, bakery_admin, or system_admin
const userController = {
  async register(req, res) {
    try {
      const { email, password, role, name, bakeryId } = req.body;
      const user = await userService.createUser({
        email,
        password,
        role,
        name,
        bakeryId,
      });
      res.status(201).json({ message: "User created successfully", user });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async loginUser(req, res) {
    try {
      // Get the ID token from the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const userData = await userService.loginUser(idToken, email);
      res.json(userData);
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message });
    }
  },

  async logoutUser(req, res) {
    try {
      const { user } = req.body;
      const result = await userService.logoutUser(user);
      res.json(result);
    } catch (error) {
      console.error("Logout error:", error);
      res.status(400).json({ error: error.message });
    }
  },
};

module.exports = userController;
