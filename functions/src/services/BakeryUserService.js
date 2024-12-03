const BaseService = require('./base/BaseService');
const User = require('../models/User');
const { admin, db } = require('../config/firebase');
const { BadRequestError, NotFoundError } = require('../utils/errors');

class BakeryUserService extends BaseService {
  constructor() {
    // Note the nested collection path pattern
    super('users', User, 'bakeries/{bakeryId}');
  }

  /**
   * Create a bakery user
   * @param {Object} userData - User data
   * @param {string} bakeryId - Bakery ID
   * @returns {Promise<Object>} Created user data
   */
  async create(userData, bakeryId) {
    let userRecord = null;

    try {
      const newUser = new User({
        ...userData,
        bakeryId,
      });

      // Check for existing user in this bakery
      const existingUser = await this.getCollectionRef(bakeryId)
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
        const userRef = this.getCollectionRef(bakeryId).doc(userRecord.uid);
        const userToSave = {
          ...newUser.toFirestore(),
          id: userRecord.uid,
        };
        delete userToSave.password;

        // 4. Add user to bakery's assistant list if they are an assistant
        if (newUser.role === 'delivery_assistant' || newUser.role === 'production_assistant' || newUser.role === 'bakery_staff') {
          const assistantsRef = db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('staff');
          assistantsRef.doc(userRecord.uid).set({
            name: newUser.name,
            first_name: newUser.name.split(' ')[0],
            role: newUser.role,
            id: userRecord.uid,
          });
        }

        transaction.set(userRef, userToSave);

        return userToSave;
      });

      return result;
    } catch (error) {
      if (userRecord) {
        try {
          await admin.auth().deleteUser(userRecord.uid);
        } catch (cleanupError) {
          console.error('Error cleaning up Auth user:', cleanupError);
        }
      }
      throw error;
    }
  }

  async getAll(bakeryId, filters = {}) {
    return super.getAll(bakeryId, filters);
  }

  async getById(id, bakeryId) {
    return super.getById(id, bakeryId);
  }

  async update(id, data, bakeryId, editor = null) {
    try {
      const docRef = this.getCollectionRef(bakeryId).doc(id);

      return await db.runTransaction(async (transaction) => {

        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new NotFoundError(`${this.collectionName} not found`);
        }

        if (data.email) {
          await admin.auth().updateUser(id, { email: data.email });
        }

        const currentUser = this.ModelClass.fromFirestore(doc);
        const updatedUser = new this.ModelClass({
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
              role: data.role,
              id: updatedUser.id,
            });
          } else if (wasAssistant && !willBeAssistant) {
            // Remove from staff collection if no longer an assistant
            transaction.delete(staffRef);
          }
        }

        // Record changes in history
        const changes = this.diffObjects(currentUser, updatedUser);
        await this.recordHistory(transaction, docRef, changes, currentUser, editor);

        // Update main document
        transaction.update(docRef, updatedUser.toFirestore());

        return updatedUser;
      });
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw error;
    }
  }

  async delete(id, bakeryId) {
    // Delete from Firebase Auth
    await admin.auth().deleteUser(id);

    // Delete from Firestore
    await super.delete(id, bakeryId);
  }
}

module.exports = BakeryUserService;
