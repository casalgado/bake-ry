// services/bakeryService.js
const { db, admin } = require('../config/firebase');
const Bakery = require('../models/Bakery');
const { BakerySettings } = require('../models/BakerySettings');
const createBaseService = require('./base/serviceFactory');

const createBakeryService = () => {
  const baseService = createBaseService('bakeries', Bakery);

  const create = async (bakeryData) => {
    try {
      // Get the uid from bakeryData since it's passed from the controller
      const { ownerId: uid } = bakeryData;

      // Start a transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        // Create new bakery with generated ID
        const bakeryRef = baseService.getCollectionRef().doc();
        const bakeryId = bakeryRef.id;

        const newBakery = new Bakery(bakeryData);

        // Create default settings
        const settingsRef = bakeryRef.collection('settings').doc('default');
        const defaultSettings = new BakerySettings({
          bakeryId: bakeryId,
        });

        // Update user document with the new bakeryId
        const userRef = db.collection('users').doc(uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        // Set all documents in the transaction
        transaction.set(bakeryRef, newBakery.toFirestore());
        transaction.set(settingsRef, defaultSettings.toFirestore());
        transaction.update(userRef, {
          bakeryId: bakeryId,
          updatedAt: new Date(),
        });

        return { bakery: { ...newBakery, id: bakeryId }, uid };
      });

      // Update custom claims outside transaction
      const userRecord = await admin.auth().getUser(result.uid);
      const currentClaims = userRecord.customClaims || {};
      await admin.auth().setCustomUserClaims(result.uid, {
        ...currentClaims,
        bakeryId: result.bakery.id,
      });

      return result.bakery;
    } catch (error) {
      console.error('Error in bakery create:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
  };
};

// Export a singleton instance
module.exports = createBakeryService();
