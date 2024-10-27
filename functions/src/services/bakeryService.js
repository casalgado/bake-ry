const { db, admin } = require("../config/firebase");
const Bakery = require("../models/Bakery");

const bakeryService = {
  async createBakery(bakeryData) {
    try {
      // Get the uid from bakeryData since it's passed from the controller
      const { ownerId: uid } = bakeryData;

      // Start a transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        // Create new bakery with generated ID
        const bakeryRef = db.collection("bakeries").doc();
        const bakeryId = bakeryRef.id;

        const newBakery = new Bakery(bakeryData);

        // Update user document with the new bakeryId
        const userRef = db.collection("users").doc(uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        // Set both documents in the transaction
        transaction.set(bakeryRef, newBakery.toFirestore());
        transaction.update(userRef, {
          bakeryId: bakeryId,
          updatedAt: new Date(),
        });

        return { bakery: { ...newBakery, id: bakeryId }, uid };
      });

      // Update custom claims outside transaction
      await admin.auth().setCustomUserClaims(result.uid, {
        ...result.uid.customClaims,
        bakeryId: result.bakery.id,
      });

      return result.bakery;
    } catch (error) {
      console.error("Error in createBakery:", error);
      throw error;
    }
  },

  async getBakeryById(id) {
    try {
      console.log("Getting bakery by ID:", id);
      const doc = await db.collection("bakeries").doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return Bakery.fromFirestore(doc);
    } catch (error) {
      console.error("Error in getBakeryById:", error);
      throw error;
    }
  },

  async getAllBakeries() {
    try {
      const snapshot = await db.collection("bakeries").get();
      return snapshot.docs.map((doc) => Bakery.fromFirestore(doc));
    } catch (error) {
      console.error("Error in getAllBakeries:", error);
      throw error;
    }
  },

  async updateBakery(id, bakeryData) {
    try {
      const bakeryRef = db.collection("bakeries").doc(id);
      const doc = await bakeryRef.get();
      if (!doc.exists) {
        return null;
      }
      const updatedBakery = new Bakery({
        ...Bakery.fromFirestore(doc),
        ...bakeryData,
        id,
        updatedAt: new Date(),
      });
      await bakeryRef.update(updatedBakery.toFirestore());
      return updatedBakery;
    } catch (error) {
      console.error("Error in updateBakery:", error);
      throw error;
    }
  },

  async deleteBakery(id) {
    try {
      await db.collection("bakeries").doc(id).delete();
    } catch (error) {
      console.error("Error in deleteBakery:", error);
      throw error;
    }
  },
};

module.exports = bakeryService;
