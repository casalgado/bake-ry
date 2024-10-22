const { admin, db } = require("../config/firebase");
const User = require("../models/User");

const userService = {
  async createUser(userData) {
    console.log("Received bakeryId:", userData.bakeryId);
    console.log("Role:", userData.role);
    try {
      const newUser = new User(userData);
      // Check if the email already exists for the given bakery
      const existingUser = await db
        .collection("users")
        .where("email", "==", newUser.email)
        .where("bakeryId", "==", newUser.bakeryId)
        .get();

      if (!existingUser.empty) {
        throw new Error("A user with this email already exists in this bakery");
      }

      // If no existing user, proceed with user creation
      const userRecord = await admin.auth().createUser({
        email: newUser.email,
        password: newUser.password,
      });

      const customClaims = { role: newUser.role };
      if (newUser.role !== "system_admin" && newUser.bakeryId) {
        customClaims.bakeryId = newUser.bakeryId;
      }
      await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

      if (newUser.role !== "system_admin") {
        if (!newUser.bakeryId) {
          throw new Error("BakeryId is required for non-system_admin users");
        }
      }

      await db.collection("users").doc(userRecord.uid).set(newUser);

      // Keep the original return format for backward compatibility
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        role: newUser.role,
        name: newUser.name,
        bakeryId: newUser.bakeryId,
      };
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  async loginUser(email, password) {
    try {
      // Firebase Auth doesn't have a direct login method in the admin SDK
      // We would typically use Firebase Client SDK for this
      // For now, we'll just fetch the user data
      const userRecord = await admin.auth().getUserByEmail(email);
      const userDoc = await db.collection("users").doc(userRecord.uid).get();
      const userData = userDoc.data();

      // In a real application, you'd verify the password here
      // and create a custom token or session

      // Keep the original return format for backward compatibility
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        role: userData.role,
        name: userData.name,
        bakeryId: userData.bakeryId,
      };
    } catch (error) {
      console.error("Error logging in user:", error);
      throw error;
    }
  },

  async verifyToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error("Error verifying token:", error);
      throw error;
    }
  },

  // New method to get a user by ID
  async getUser(userId) {
    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        ...userData,
      };
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error;
    }
  },

  // New method to update user data (patch)
  async updateUser(userId, updateData) {
    try {
      const userDoc = await db.collection("users").doc(userId).get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      // Remove any fields that shouldn't be updated
      const { email, role, createdAt, ...validUpdateData } = updateData;

      const updates = {
        ...validUpdateData,
        updatedAt: new Date(),
      };

      await db.collection("users").doc(userId).update(updates);

      // Return updated user data
      const updatedDoc = await db.collection("users").doc(userId).get();
      const updatedData = updatedDoc.data();

      return {
        uid: userId,
        ...updatedData,
      };
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },
};

module.exports = userService;
