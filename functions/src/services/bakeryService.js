const { db } = require("../config/firebase");
const Bakery = require("../models/Bakery");

const bakeryService = {
  async createBakery(bakeryData) {
    try {
      const newBakery = new Bakery(bakeryData);
      const docRef = await db
        .collection("bakeries")
        .add(newBakery.toFirestore());
      newBakery.id = docRef.id;
      return newBakery;
    } catch (error) {
      console.error("Error in createBakery:", error);
      throw error;
    }
  },

  async getBakeryById(id) {
    try {
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
