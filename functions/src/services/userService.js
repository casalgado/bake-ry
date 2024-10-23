const { admin, db } = require("../config/firebase");
const User = require("../models/User");

const userService = {
  async createUser(userData) {
    console.log("Received bakeryId:", userData.bakeryId);
    console.log("Role:", userData.role);

    let userRecord = null;

    try {
      const newUser = new User(userData);

      // Validate role and bakeryId first
      if (newUser.role !== "system_admin") {
        if (!newUser.bakeryId) {
          throw new Error("BakeryId is required for non-system_admin users");
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
        if (newUser.role !== "system_admin" && newUser.bakeryId) {
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

  async loginUser(user) {
    try {
      console.log("User:", user);

      const customToken = await admin.auth().createCustomToken(user.uid);
      console.log("Custom Token:", customToken);

      // Then, exchange it for an ID token (this step simulates client-side auth)
      const idToken = await getIdTokenFromCustomToken(customToken);
      console.log("ID Token:", idToken);

      return {
        uid: user.uid,
        email: user.email,
        role: user.role,
        name: user.name,
        bakeryId: user.bakeryId,
        token: idToken,
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

// This function simulates exchanging a custom token for an ID token
// In a real app, this would happen on the client side
async function getIdTokenFromCustomToken(customToken) {
  const firebaseApiKey = process.env.BAKERY_API_KEY;

  if (!firebaseApiKey) {
    throw new Error("Firebase API key is not set in environment variables");
  }

  const response = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyCustomToken?key=${firebaseApiKey}`,
    {
      method: "POST",
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true,
      }),
    }
  );

  const data = await response.json();
  console.log("Data:", data);
  return data.idToken;
}

module.exports = userService;
