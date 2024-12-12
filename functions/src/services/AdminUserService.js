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

  return {
    ...baseService,
    create,
    update,
    remove,
  };
};

// Export a singleton instance
module.exports = createAdminUserService();
