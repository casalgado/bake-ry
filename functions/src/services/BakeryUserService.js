const BaseService = require('./base/BaseService');
const User = require('../models/User');
const { admin, db } = require('../config/firebase');
const { BadRequestError } = require('../utils/errors');

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

  async update(id, updateData, bakeryId) {
    // Update Firebase Auth if email is being changed
    if (updateData.email) {
      await admin.auth().updateUser(id, { email: updateData.email });
    }

    return super.update(id, updateData, bakeryId);
  }

  async delete(id, bakeryId) {
    // Delete from Firebase Auth
    await admin.auth().deleteUser(id);

    // Delete from Firestore
    await super.delete(id, bakeryId);
  }
}

module.exports = BakeryUserService;
