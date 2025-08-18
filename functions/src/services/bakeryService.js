// services/bakeryService.js
const { db, admin } = require('../config/firebase');
const Bakery = require('../models/Bakery');
const { BakerySettings } = require('../models/BakerySettings');
const createBaseService = require('./base/serviceFactory');

const createBakeryService = () => {
  const baseService = createBaseService('bakeries', Bakery);

  const generateUniqueCustomId = async (bakeryName, transaction = null) => {
    const baseSlug = bakeryName.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

    // Method 1: Using timestamp (your current approach - improved)
    const timestamp = Date.now();
    const customId = `${baseSlug}-${timestamp}`;

    return customId;
  };

  const create = async ({ userData, bakeryData, settingsData }) => {
    let userRecord = null;

    try {
      // 1. Check if user already exists
      const existingUserQuery = await db.collection('users')
        .where('email', '==', userData.email)
        .limit(1)
        .get();

      if (!existingUserQuery.empty) {
        throw new Error('A user with this email already exists');
      }

      // 2. Create Firebase Auth user first (outside transaction)
      userRecord = await admin.auth().createUser({
        email: userData.email,
        password: userData.password,
      });

      const uid = userRecord.uid;

      // 3. Start a transaction to ensure atomicity for Firestore operations
      const result = await db.runTransaction(async (transaction) => {

        // Create new bakery with generated ID
        const customId = await generateUniqueCustomId(bakeryData.name);
        const bakeryRef = baseService.getCollectionRef().doc(customId);
        const bakeryId = bakeryRef.id;

        const newBakery = new Bakery({
          ...bakeryData,
          ownerId: uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Create settings (custom or default)
        const settingsRef = bakeryRef.collection('settings').doc('default');
        const newSettings = new BakerySettings({
          bakeryId: bakeryId,
          ...settingsData,
        });

        // Create user document
        const userRef = db.collection('users').doc(uid);
        const userDoc = {
          id: uid,
          email: userData.email,
          name: userData.name,
          role: 'bakery_admin',
          bakeryId: bakeryId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Set all documents in the transaction
        transaction.set(bakeryRef, newBakery.toFirestore());
        transaction.set(settingsRef, newSettings.toFirestore());
        transaction.set(userRef, userDoc);

        return {
          bakery: { ...newBakery, id: bakeryId },
          settings: { ...newSettings },
          user: userDoc,
          uid,
        };
      });

      // 4. Update custom claims outside transaction
      await admin.auth().setCustomUserClaims(uid, {
        role: 'bakery_admin',
        bakeryId: result.bakery.id,
      });

      // 5. Create custom token for immediate login
      const customToken = await admin.auth().createCustomToken(uid);

      return {
        bakery: result.bakery,
        settings: result.settings,
        user: {
          uid: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          bakeryId: result.user.bakeryId,
        },
        customToken,
      };
    } catch (error) {
      // Cleanup Firebase Auth user if created but transaction failed
      if (userRecord) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (cleanupError) {
          console.error('Error cleaning up Auth user:', cleanupError);
        }
      }
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
