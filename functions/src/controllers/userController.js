const User = require("../models/User");
const { admin } = require("../config/firebase");

/**
 *  possible roles: "system_admin",  "bakery_admin", "bakery_staff", "client"
 */

class UserController {
  async createUser(req, res) {
    try {
      const { email, password, role, bakeryId, name } = req.body;

      // Check if the user making the request has permission to create this type of user
      if (!this.canCreateUser(req.user, role, bakeryId)) {
        return res
          .status(403)
          .json({ error: "Insufficient permissions to create this user type" });
      }

      const newUser = await User.create({
        email,
        password,
        role,
        bakeryId,
        name,
      });
      res.status(201).json(newUser);
    } catch (error) {
      console.error("Error in createUser:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  }

  async getUser(req, res) {
    try {
      const userId = req.params.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the requesting user has permission to view this user's details
      if (!this.canViewUser(req.user, user)) {
        return res
          .status(403)
          .json({ error: "Insufficient permissions to view this user" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error in getUser:", error);
      res.status(500).json({ error: "Failed to retrieve user" });
    }
  }

  async updateUser(req, res) {
    try {
      const userId = req.params.userId;
      const updateData = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the requesting user has permission to update this user
      if (!this.canUpdateUser(req.user, user)) {
        return res
          .status(403)
          .json({ error: "Insufficient permissions to update this user" });
      }

      const updatedUser = await user.update(updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error in updateUser:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  }

  async deleteUser(req, res) {
    try {
      const userId = req.params.userId;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if the requesting user has permission to delete this user
      if (!this.canDeleteUser(req.user, user)) {
        return res
          .status(403)
          .json({ error: "Insufficient permissions to delete this user" });
      }

      await user.delete();
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error in deleteUser:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }

  // Helper methods to check permissions
  canCreateUser(requestingUser, newUserRole, newUserBakeryId) {
    if (requestingUser.role === "system_admin") return true;
    if (
      requestingUser.role === "bakery_admin" &&
      ["bakery_staff", "client"].includes(newUserRole) &&
      requestingUser.bakeryId === newUserBakeryId
    )
      return true;
    return false;
  }

  canViewUser(requestingUser, targetUser) {
    if (requestingUser.role === "system_admin") return true;
    if (requestingUser.bakeryId === targetUser.bakeryId) return true;
    return false;
  }

  canUpdateUser(requestingUser, targetUser) {
    if (requestingUser.role === "system_admin") return true;
    if (
      requestingUser.role === "bakery_admin" &&
      requestingUser.bakeryId === targetUser.bakeryId
    )
      return true;
    return false;
  }

  canDeleteUser(requestingUser, targetUser) {
    if (requestingUser.role === "system_admin") return true;
    if (
      requestingUser.role === "bakery_admin" &&
      requestingUser.bakeryId === targetUser.bakeryId &&
      ["bakery_staff", "client"].includes(targetUser.role)
    )
      return true;
    return false;
  }
}

module.exports = new UserController();
