const { db, admin } = require('../config/firebase');
const Bakery = require('../models/Bakery');

const bakeryService = {
  async create(bakeryData) {
    try {
      // Get the uid from bakeryData since it's passed from the controller
      const { ownerId: uid } = bakeryData;

      // Start a transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        // Create new bakery with generated ID
        const bakeryRef = db.collection('bakeries').doc();
        const bakeryId = bakeryRef.id;

        const newBakery = new Bakery(bakeryData);

        // Update user document with the new bakeryId
        const userRef = db.collection('users').doc(uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User not found');
        }

        // Set both documents in the transaction
        transaction.set(bakeryRef, newBakery.toFirestore());
        transaction.update(userRef, {
          bakeryId: bakeryId,
          updatedAt: new Date(),
        });

        return { bakery: { ...newBakery, id: bakeryId }, uid };
      });

      const userRecord = await admin.auth().getUser(result.uid);
      const currentClaims = userRecord.customClaims || {};

      // Update custom claims outside transaction
      await admin.auth().setCustomUserClaims(result.uid, {
        ...currentClaims,
        bakeryId: result.bakery.id,
      });

      return result.bakery;
    } catch (error) {
      console.error('Error in bakery create:', error);
      throw error;
    }
  },

  async getById(id) {
    try {
      console.log('Getting bakery by ID:', id);
      const doc = await db.collection('bakeries').doc(id).get();
      if (!doc.exists) {
        return null;
      }
      return Bakery.fromFirestore(doc);
    } catch (error) {
      console.error('Error in getBakeryById:', error);
      throw error;
    }
  },

  async getAll() {
    try {
      const snapshot = await db.collection('bakeries').get();
      return snapshot.docs.map((doc) => Bakery.fromFirestore(doc));
    } catch (error) {
      console.error('Error in getAllBakeries:', error);
      throw error;
    }
  },

  async update(id, bakeryData) {
    try {
      const bakeryRef = db.collection('bakeries').doc(id);
      const doc = await bakeryRef.get();
      if (!doc.exists) {
        return null;
      }
      console.log('In bakeryService updateBakery, bakeryData', bakeryData);
      const updatedBakery = new Bakery({
        ...Bakery.fromFirestore(doc),
        ...bakeryData,
        id,
        updatedAt: new Date(),
      });
      console.log(
        'In bakeryService updateBakery, updatedBakery',
        updatedBakery,
      );
      console.log(
        'In bakeryService updateBakery, updatedBakery.toFirestore()',
        updatedBakery.toFirestore(),
      );
      await bakeryRef.update(updatedBakery.toFirestore());
      return updatedBakery;
    } catch (error) {
      console.error('Error in updateBakery:', error);
      throw error;
    }
  },

  /**
 * Partially update a bakery
 * @param {string} id - Bakery ID
 * @param {Object} patchData - Fields to update
 * @returns {Promise<Bakery>} Updated bakery
 */
  async patch(id, patchData) {
    try {
      const bakeryRef = db.collection('bakeries').doc(id);

      // Remove protected fields from patch data
      const {
        id: _,           // Prevent ID modification
        createdAt,       // Prevent creation date modification
        ownerId,         // Prevent owner modification
        ...safeUpdateData
      } = patchData;
      void [_, createdAt, ownerId];

      // Add updatedAt timestamp
      const updateFields = {
        ...safeUpdateData,
        updatedAt: new Date(),
      };

      // Directly update only the specified fields
      await bakeryRef.update(updateFields);

      // Get the updated document to return
      const updatedDoc = await bakeryRef.get();
      return Bakery.fromFirestore(updatedDoc);
    } catch (error) {
      console.error('Error in patchBakery:', error);
      throw error;
    }
  },

  async delete(id) {
    try {
      await db.collection('bakeries').doc(id).delete();
    } catch (error) {
      console.error('Error in deleteBakery:', error);
      throw error;
    }
  },
};

module.exports = bakeryService;
