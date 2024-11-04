// services/bakeryService.js

const { db, admin } = require('../config/firebase');
const Bakery = require('../models/Bakery');
const BaseService = require('./base/BaseService');

class BakeryService extends BaseService {
  constructor() {
    // Bakeries is a top-level collection, so no parentPath needed
    super('bakeries', Bakery);
  }

  // Override create method to handle the special case with user claims
  async create(bakeryData) {
    try {
      // Get the uid from bakeryData since it's passed from the controller
      const { ownerId: uid } = bakeryData;

      // Start a transaction to ensure atomicity
      const result = await db.runTransaction(async (transaction) => {
        // Create new bakery with generated ID
        const bakeryRef = this.getCollectionRef().doc();
        const bakeryId = bakeryRef.id;

        const newBakery = new this.ModelClass(bakeryData);

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
  }

  // Use parent class methods for basic operations
  async getById(id) {
    return super.getById(id);
  }

  async getAll() {
    return super.getAll();
  }

  async update(id, bakeryData) {
    return super.update(id, bakeryData);
  }

  async delete(id) {
    return super.delete(id);
  }

}

// Export a single instance
module.exports =  BakeryService;
