const { admin, db } = require("../config/firebase");
const User = require("../models/User");

const userService = {
  async createUser(userData) {
    console.log("Received userData:", userData);

    // requires: email, password, role, name

    let userRecord = null;

    try {
      const newUser = new User(userData);

      // Validate role and bakeryId first
      if (newUser.role !== "system_admin" && newUser.role !== "bakery_admin") {
        if (!newUser.bakeryId) {
          throw new Error("BakeryId is required for non-admin users");
        }
      }

      // Check if the email already exists for the given bakery
      const existingUser = await db
        .collection("users")
        .where("email", "==", newUser.email)
        .where("bakeryId", "==", newUser.bakeryId)
        .get();

      if (!existingUser.empty) {
        throw new Error("A user with this email already exists in this bakery");
      }

      // Start a transaction for atomicity
      const result = await db.runTransaction(async (transaction) => {
        // 1. Create the user in Auth
        userRecord = await admin.auth().createUser({
          email: newUser.email,
          password: newUser.password,
        });

        // 2. Set custom claims
        const customClaims = { role: newUser.role };
        // Assign bakeryId to customClaims if applicable
        if (
          newUser.role !== "system_admin" &&
          newUser.role !== "bakery_admin" &&
          newUser.bakeryId
        ) {
          customClaims.bakeryId = newUser.bakeryId;
        }
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // 3. Create the user document in Firestore
        const userRef = db.collection("users").doc(userRecord.uid);
        transaction.set(userRef, newUser.toFirestore());

        return {
          uid: userRecord.uid,
          email: userRecord.email,
          role: newUser.role,
          name: newUser.name,
          bakeryId: newUser.bakeryId,
        };
      });

      return result;
    } catch (error) {
      console.error("Error creating user:", error);

      // If we created a user in Auth but the transaction failed,
      // we need to clean up the Auth user
      if (userRecord) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
          console.log("Cleaned up Auth user after failed transaction");
        } catch (cleanupError) {
          console.error("Error cleaning up Auth user:", cleanupError);
          // Log this incident for admin attention
          // You might want to add proper error logging here
        }
      }

      throw error;
    }
  },

  async loginUser(idToken, email) {
    try {
      // 1. Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      console.log("Decoded token:", decodedToken);

      // 2. Get the user document from Firestore
      const userSnapshot = await db
        .collection("users")
        .where("email", "==", email)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        throw new Error("User not found");
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // 3. Verify the user's Firebase UID matches
      if (decodedToken.uid !== userDoc.id) {
        throw new Error("User authentication failed");
      }

      // 4. Return user data (excluding sensitive information)
      return {
        uid: userDoc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        bakeryId: userData.bakeryId,
        // Add any other necessary user data
        // Do NOT include password or other sensitive data
      };
    } catch (error) {
      console.error("Error in loginUser service:", error);
      if (error.code === "auth/id-token-expired") {
        throw new Error("Session expired. Please login again.");
      } else if (error.code === "auth/invalid-id-token") {
        throw new Error("Invalid authentication token.");
      }
      throw new Error("Authentication failed. Please try again.");
    }
  },

  // Helper method to get user data by ID (useful for other parts of your app)
  async getUserById(uid) {
    try {
      const userDoc = await db.collection("users").doc(uid).get();

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const userData = userDoc.data();
      return {
        uid: userDoc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        bakeryId: userData.bakeryId,
      };
    } catch (error) {
      console.error("Error getting user by ID:", error);
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
