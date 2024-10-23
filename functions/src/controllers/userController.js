const userService = require("../services/userService");

// possible roles: customer, staff, admin, or system_admin
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

  async login(req, res) {
    try {
      const { user } = req.body;
      const result = await userService.loginUser(user);
      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message });
    }
  },
};

module.exports = userController;
