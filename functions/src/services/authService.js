const { admin, db } = require("../config/firebase");

const authService = {
  async createUser({ email, password, role, name, bakeryId }) {
    console.log("Received bakeryId:", bakeryId); // Add this line
    console.log("Role:", role);
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
      });

      const customClaims = { role };
      if (role !== "system_admin" && bakeryId) {
        customClaims.bakeryId = bakeryId;
      }
      await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

      const userData = {
        email,
        role,
        name,
        bakeryId,
        createdAt: Date.now(),
      };

      if (role !== "system_admin") {
        if (!bakeryId) {
          throw new Error("BakeryId is required for non-system_admin users");
        }
        userData.bakeryId = bakeryId;
      }

      await db.collection("users").doc(userRecord.uid).set(userData);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        role,
        name,
        bakeryId: userData.bakeryId,
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
};

module.exports = authService;
