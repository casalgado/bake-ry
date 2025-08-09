// services/adminUserService.js
const { admin, db } = require('../config/firebase');
const User = require('../models/User');
const createBaseService = require('./base/serviceFactory');
const { NotFoundError, BadRequestError } = require('../utils/errors');

const createAdminUserService = () => {
  const baseService = createBaseService('users', User);

  const create = async (userData) => {
    let userRecord = null;

    try {
      const newUser = new User(userData);

      // Check for existing user with same email
      const existingUser = await baseService.getCollectionRef()
        .where('email', '==', newUser.email)
        .get();

      if (!existingUser.empty) {
        throw new BadRequestError('A user with this email already exists');
      }

      // Start transaction
      const result = await db.runTransaction(async (transaction) => {
        // 1. Create Firebase Auth user
        userRecord = await admin.auth().createUser({
          email: newUser.email,
          password: newUser.password,
        });

        // 2. Set custom claims
        const customClaims = { role: newUser.role };
        if (newUser.role === 'bakery_admin' && newUser.bakeryId) {
          customClaims.bakeryId = newUser.bakeryId;
        }
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // 3. Create Firestore document
        const userRef = baseService.getCollectionRef().doc(userRecord.uid);
        const userToSave = {
          ...newUser.toFirestore(),
          id: userRecord.uid,
        };
        delete userToSave.password; // Don't store password in Firestore

        transaction.set(userRef, userToSave);

        return {
          uid: userRecord.uid,
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          bakeryId: newUser.bakeryId,
        };
      });

      return result;
    } catch (error) {
      // Cleanup if Firebase Auth user was created but transaction failed
      if (userRecord) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (cleanupError) {
          console.error('Error cleaning up Auth user:', cleanupError);
        }
      }
      throw error;
    }
  };

  const update = async (id, updateData, parentId = null) => {
    try {
      const docRef = baseService.getCollectionRef().doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError('User not found');
        }

        if (updateData.email) {
          await admin.auth().updateUser(id, { email: updateData.email });
        }

        const currentUser = User.fromFirestore(doc);
        const updatedUser = new User({
          ...currentUser,
          ...updateData,
          id,
          updatedAt: new Date(),
        });

        const changes = baseService.diffObjects(currentUser, updatedUser);
        await baseService.recordHistory(transaction, docRef, changes, currentUser);

        transaction.update(docRef, updatedUser.toFirestore());
        return updatedUser;
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const remove = async (id) => {
    try {
      // Delete from Firebase Auth
      await admin.auth().deleteUser(id);
      // Delete from Firestore using base service
      return await baseService.remove(id);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  // Get subscription data for a bakery (same logic as bakeryUserService)
  const getBakerySubscriptionData = async (bakeryId) => {
    try {
      const settingsRef = db
        .collection('bakeries')
        .doc(bakeryId)
        .collection('settings')
        .doc('default');

      const settingsDoc = await settingsRef.get();

      if (!settingsDoc.exists) {
        return {
          status: 'TRIAL',
          tier: 'BASIC',
        };
      }

      const settings = settingsDoc.data();
      return {
        status: settings.subscription?.status || 'TRIAL',
        tier: settings.subscription?.tier || 'BASIC',
      };
    } catch (error) {
      console.error('Error getting bakery subscription data:', error);
      return {
        status: 'TRIAL',
        tier: 'BASIC',
      };
    }
  };

  // Update JWT custom claims with subscription info for a single admin user
  const updateUserJWTWithSubscription = async (userId, bakeryId, subscriptionData = null) => {
    try {
      // Get current custom claims
      const userRecord = await admin.auth().getUser(userId);
      const currentClaims = userRecord.customClaims || {};

      // Get subscription data if not provided
      let subscription = subscriptionData;
      if (!subscription) {
        subscription = await getBakerySubscriptionData(bakeryId);
      }

      // Update custom claims with subscription info
      const newClaims = {
        ...currentClaims,
        subscriptionStatus: subscription.status,
        subscriptionTier: subscription.tier,
      };

      await admin.auth().setCustomUserClaims(userId, newClaims);

      console.log(`Updated admin JWT for user ${userId} with subscription:`, subscription);

      return newClaims;
    } catch (error) {
      console.error(`Error updating admin JWT for user ${userId}:`, error);
      throw error;
    }
  };

  // Refresh JWT tokens for all admin users associated with a specific bakery
  const refreshBakeryAdminTokens = async (bakeryId, subscriptionData = null) => {
    try {
      console.log(`Refreshing JWT tokens for admin users with access to bakery ${bakeryId}`);

      // Get subscription data if not provided
      let subscription = subscriptionData;
      if (!subscription) {
        subscription = await getBakerySubscriptionData(bakeryId);
      }

      // Get all bakery_admin users that have this bakeryId
      const adminUsersSnapshot = await baseService.getCollectionRef()
        .where('bakeryId', '==', bakeryId)
        .get();

      console.log(`Found ${adminUsersSnapshot.docs.length} admin users with access to bakery ${bakeryId}`);

      // Update JWT claims for all admin users in parallel
      const updatePromises = adminUsersSnapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        try {
          await updateUserJWTWithSubscription(userId, bakeryId, subscription);
          return { userId, success: true };
        } catch (error) {
          console.error(`Failed to update admin JWT for user ${userId}:`, error);
          return { userId, success: false, error: error.message };
        }
      });

      const results = await Promise.all(updatePromises);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`Admin JWT token refresh complete for bakery ${bakeryId}: ${successful} successful, ${failed} failed`);

      return {
        bakeryId,
        subscription,
        totalUsers: adminUsersSnapshot.docs.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      console.error(`Error refreshing admin user tokens for bakery ${bakeryId}:`, error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    remove,
    getBakerySubscriptionData,
    updateUserJWTWithSubscription,
    refreshBakeryAdminTokens,
  };
};

// Export a singleton instance
module.exports = createAdminUserService();
