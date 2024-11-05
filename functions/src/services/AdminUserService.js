const BaseService = require('./base/BaseService');
const User = require('../models/User');
const { admin, db } = require('../config/firebase');
const { BadRequestError } = require('../utils/errors');

class AdminUserService extends BaseService {
  constructor() {
    super('users', User);
  }

  /**
   * Create an admin user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user data
   */
  async create(userData) {
    let userRecord = null;

    try {
      const newUser = new User(userData);

      // Check for existing user with same email
      const existingUser = await this.getCollectionRef()
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
        const userRef = this.getCollectionRef().doc(userRecord.uid);
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
  }
  /**
   * Get all admin users
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of admin users
   */
  async getAll(filters = {}) {
    return super.getAll(null, filters);
  }

  /**
   * Get admin user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User data
   */
  async getById(id) {
    return super.getById(id);
  }

  /**
   * Update admin user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user data
   */
  async update(id, updateData) {
    return super.update(id, updateData);
  }

  /**
   * Delete admin user
   * @param {string} id - User ID
   */
  async delete(id) {
    // Delete from Firebase Auth
    await admin.auth().deleteUser(id);

    // Delete from Firestore
    await super.delete(id);
  }
}

module.exports = AdminUserService;
