// services/bakeryUserService.js
const { admin, db } = require('../config/firebase');
const User = require('../models/User');
const { Order } = require('../models/Order');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const AUTH_REQUIRED_ROLES = [
  'bakery_staff',
  'delivery_assistant',
  'production_assistant',
  'bakery_admin',
];

const needsAuthAccount = (role) => AUTH_REQUIRED_ROLES.includes(role);

const generateInitialPassword = (name) => {
  let password = name.split(' ')[0].toLowerCase();
  if (!password) password = '';
  while (password.length < 6) {
    password = password + '1';
  }
  return password;
};

const userExists = async (uid) => {
  try {
    await admin.auth().getUser(uid);
    return true;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
};

const handleRelatedCollections = async (transaction, bakeryId, userId, userData, isDelete = false) => {
  const settingsRef = db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('settings')
    .doc('default');

  // Handle staff collection
  if (needsAuthAccount(userData.role)) {
    const staffRef = settingsRef.collection('staff').doc(userId);
    if (isDelete) {
      transaction.delete(staffRef);
    } else {
      const staffData = {
        name: userData.name,
        firstName: userData.name.split(' ')[0],
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        id: userId,
        address: userData.address,
      };

      if (staffData.phone === undefined || staffData.phone === null || staffData.phone === '') {
        staffData.phone = '';
      }

      if (staffData.address === undefined || staffData.address === null || staffData.address === '') {
        staffData.address = '';
      }

      transaction.set(staffRef, staffData);
    }
  }

  // Handle B2B collection
  if (userData.category === 'B2B') {
    const b2bRef = settingsRef.collection('b2b_clients').doc(userId);
    if (isDelete) {
      transaction.delete(b2bRef);
    } else {
      const b2bData = {
        name: userData.name,
        id: userId,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
      };

      if (b2bData.phone === undefined || b2bData.phone === null || b2bData.phone === '') {
        b2bData.phone = '';
      }

      if (b2bData.address === undefined || b2bData.address === null || b2bData.address === '') {
        b2bData.address = '';
      }

      transaction.set(b2bRef, b2bData);
    }
  }
};

const createBakeryUserService = () => {
  const baseService = createBaseService('users', User, 'bakeries/{bakeryId}');

  const create = async (userData, bakeryId) => {
    let userRecord = null;

    try {
      const newUser = new User({
        ...userData,
        bakeryId,
      });

      // Check for existing user in this bakery
      const existingUser = await baseService.getCollectionRef(bakeryId)
        .where('email', '==', newUser.email)
        .get();

      if (!existingUser.empty) {
        throw new BadRequestError('A user with this email already exists in this bakery');
      }

      // Start transaction
      const result = await db.runTransaction(async (transaction) => {
        let userId;

        // Only create auth account for staff roles
        if (needsAuthAccount(newUser.role)) {
          // Generate password from name
          const password = generateInitialPassword(newUser.name);

          // Create Firebase Auth user
          userRecord = await admin.auth().createUser({
            email: newUser.email,
            password: password,
          });

          // Set custom claims
          await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: newUser.role,
            bakeryId,
          });

          userId = userRecord.uid;
        } else {
          // For customers, generate a custom ID
          userId = baseService.getCollectionRef(bakeryId).doc().id;
        }

        // Create Firestore document
        const userRef = baseService.getCollectionRef(bakeryId).doc(userId);
        const userToSave = {
          ...newUser.toFirestore(),
          id: userId,
        };

        // Handle related collections
        await handleRelatedCollections(transaction, bakeryId, userId, userToSave);

        transaction.set(userRef, userToSave);
        return userToSave;
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

  const update = async (id, data, bakeryId, editor = null) => {
    try {
      const docRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        if (!doc.exists) {
          throw new NotFoundError('User not found');
        }

        const currentUser = User.fromFirestore(doc);
        const wasAuthRequired = needsAuthAccount(currentUser.role);

        // Handle auth updates if needed
        if (wasAuthRequired) {
          if (data.email && data.email !== currentUser.email) {
            await admin.auth().updateUser(id, { email: data.email });
          }
        }

        // Get reference to settings document
        const settingsRef = db
          .collection('bakeries')
          .doc(bakeryId)
          .collection('settings')
          .doc('default');

        // Handle role-specific updates if role is changing
        if (data.role && data.role !== currentUser.role) {

          const hasAuthAccount = await userExists(id);

          if (!hasAuthAccount) {
            const password = generateInitialPassword(currentUser.name);
            // Create Firebase Auth user
            await admin.auth().createUser({
              uid: id,
              email: currentUser.email,
              password: password,
            });
          }

          // Update Firebase Auth claims
          await admin.auth().setCustomUserClaims(id, {
            role: data.role,
            bakeryId,
          });

          const assistantRoles = ['delivery_assistant', 'production_assistant', 'bakery_staff'];
          const wasAssistant = assistantRoles.includes(currentUser.role);
          const willBeAssistant = assistantRoles.includes(data.role);

          // Remove from staff collection if no longer an assistant
          if (wasAssistant && !willBeAssistant) {
            const staffRef = settingsRef.collection('staff').doc(id);
            transaction.delete(staffRef);
          }
        }

        // Create updated user object
        const updatedUser = new User({
          ...currentUser,
          ...data,
          id,
          updatedAt: new Date(),
        });

        // Handle category changes if category is changing
        if (data.category && data.category !== currentUser.category) {
          const categoryHistoryRef = docRef.collection('category_history').doc();
          transaction.set(categoryHistoryRef, {
            previous_category: currentUser.category || 'none',
            new_category: data.category,
            changed_at: new Date(),
            changed_by: {
              userId: editor?.uid || 'system',
              email: editor?.email || 'system@system.com',
              role: editor?.role || 'system',
            },
            reason: data.categoryChangeReason || 'Manual update',
          });
        }

        // Handle related collections
        await handleRelatedCollections(transaction, bakeryId, id, updatedUser);

        // Record changes in history
        const changes = baseService.diffObjects(currentUser, updatedUser);
        await baseService.recordHistory(transaction, docRef, changes, currentUser, editor);

        // Update main user document
        transaction.update(docRef, updatedUser.toFirestore());

        return updatedUser;
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const remove = async (id, bakeryId) => {
    try {
      const userRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(userRef);
        if (!doc.exists) {
          throw new NotFoundError('User not found');
        }

        const currentUser = User.fromFirestore(doc);

        // Only delete auth account if user has one
        if (needsAuthAccount(currentUser.role)) {
          await admin.auth().deleteUser(id);
        }

        // Clean up related collections
        await handleRelatedCollections(transaction, bakeryId, id, currentUser, true);

        // Soft delete the main user document
        transaction.update(userRef, {
          isDeleted: true,
          updatedAt: new Date(),
        });

        return null;
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  const getHistory = async (bakeryId, userId) => {
    try {
      if (!bakeryId || !userId) {
        throw new BadRequestError('Both bakeryId and userId are required');
      }

      const userRef = baseService.getCollectionRef(bakeryId).doc(userId);

      const historySnapshot = await userRef.collection('orderHistory')
        .orderBy('dueDate', 'desc')
        .get();

      return historySnapshot.docs.filter(doc => !doc.data().isDeleted).map(doc => {
        return Order.fromFirestore(doc);
      });
    } catch (error) {
      console.error('Error getting order history:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    getHistory,
    delete: remove,
  };
};

// Export a singleton instance
module.exports = createBakeryUserService();
