// services/bakeryUserService.js
const { admin, db } = require('../config/firebase');
const User = require('../models/User');
const createBaseService = require('./base/serviceFactory');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const createBakeryUserService = () => {
  const baseService = createBaseService('users', User, 'bakeries/{bakeryId}');

  const create = async (userData, bakeryId) => {
    let userRecord = null;

    try {
      userData.password = 'password';

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
        // 1. Create Firebase Auth user
        userRecord = await admin.auth().createUser({
          email: newUser.email,
          password: newUser.password,
        });

        // 2. Set custom claims with bakeryId
        const customClaims = {
          role: newUser.role,
          bakeryId,
        };
        await admin.auth().setCustomUserClaims(userRecord.uid, customClaims);

        // 3. Create Firestore document
        const userRef = baseService.getCollectionRef(bakeryId).doc(userRecord.uid);
        const userToSave = {
          ...newUser.toFirestore(),
          id: userRecord.uid,
        };
        delete userToSave.password;

        // 4. Add user to bakery's assistant list if they are an assistant
        if (newUser.role === 'delivery_assistant' ||
            newUser.role === 'production_assistant' ||
            newUser.role === 'bakery_staff') {
          const assistantsRef = db
            .collection('bakeries')
            .doc(bakeryId)
            .collection('settings')
            .doc('default')
            .collection('staff');

          assistantsRef.doc(userRecord.uid).set({
            name: newUser.name,
            first_name: newUser.name.split(' ')[0],
            role: newUser.role,
            email: newUser.email,
            phone: newUser.phone,
            id: userRecord.uid,
          });
        }

        // 5. Add user to b2b clients list if they are a b2b client
        if (newUser.category === 'B2B') {
          const b2bClientsRef = db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('b2b_clients');
          b2bClientsRef.doc(userRecord.uid).set({
            name: newUser.name,
            id: userRecord.uid,
            email: newUser.email,
            phone: newUser.phone,
            address: newUser.address,
          });
        }

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

  // services/bakeryUserService.js

  const update = async (id, data, bakeryId, editor = null) => {
    try {
      const docRef = baseService.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError('User not found');
        }

        if (data.email) {
          await admin.auth().updateUser(id, { email: data.email });
        }

        const currentUser = User.fromFirestore(doc);
        const updatedUser = new User({
          ...currentUser,
          ...data,
          id,
          updatedAt: new Date(),
        });

        // Handle role-specific updates if role is changing
        if (data.role && data.role !== currentUser.role) {
        // Update Firebase Auth claims
          await admin.auth().setCustomUserClaims(id, {
            role: data.role,
            bakeryId,
          });

          const staffRef = db
            .collection('bakeries')
            .doc(bakeryId)
            .collection('settings')
            .doc('default')
            .collection('staff')
            .doc(id);

          const assistantRoles = ['delivery_assistant', 'production_assistant', 'bakery_staff'];
          const wasAssistant = assistantRoles.includes(currentUser.role);
          const willBeAssistant = assistantRoles.includes(data.role);

          if (willBeAssistant) {
          // Set or update staff entry
            transaction.set(staffRef, {
              name: updatedUser.name,
              first_name: updatedUser.name.split(' ')[0],
              email: updatedUser.email,
              phone: updatedUser.phone,
              role: data.role,
              id: updatedUser.id,
            });
          } else if (wasAssistant && !willBeAssistant) {
          // Remove from staff collection if no longer an assistant
            transaction.delete(staffRef);
          }
        }

        const settingsRef = db
          .collection('bakeries')
          .doc(bakeryId)
          .collection('settings')
          .doc('default');

        // Handle category changes if category is changing
        if (data.category && data.category !== currentUser.category) {

          // Handle removal from old category collections
          if (currentUser.category === 'B2B') {
            const oldB2bRef = settingsRef.collection('b2b_clients').doc(id);
            transaction.delete(oldB2bRef);
          }

          // Record category change in history
          const categoryHistoryRef = docRef.collection('category_history').doc();
          transaction.set(categoryHistoryRef, {
            previous_category: currentUser.category || 'none',
            new_category: data.category,
            changed_at: new Date(),
            changed_by: {
              userId: editor?.uid || 'system',
              name: editor?.name || 'system',
              role: editor?.role || 'system',
            },
            reason: data.categoryChangeReason || 'Manual update',
          });
        }

        // Handle update in b2b clients list
        if (data.category === 'B2B') {
          const newB2bRef = settingsRef.collection('b2b_clients').doc(id);
          transaction.set(newB2bRef, {
            name: updatedUser.name,
            id: updatedUser.id,
            email: updatedUser.email,
            phone: updatedUser.phone,
            address: updatedUser.address,
          });
        }

        // Record changes in history
        const changes = baseService.diffObjects(currentUser, updatedUser);
        await baseService.recordHistory(transaction, docRef, changes, currentUser, editor);

        // Update main document
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
      // Delete from Firebase Auth
      await admin.auth().deleteUser(id);
      // Delete from Firestore using base service
      return await baseService.remove(id, bakeryId);
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  };

  return {
    ...baseService,
    create,
    update,
    delete: remove,
  };
};

// Export a singleton instance
module.exports = createBakeryUserService();
