const { admin } = require('../config/firebase');
const BaseService = require('./base/BaseService');
const User = require('../models/User');
const AdminUserService = require('./AdminUserService');
const {  NotFoundError, AuthenticationError } = require('../utils/errors');

class AuthService extends BaseService {
  constructor() {
    // Pass users collection and User model to BaseService
    super('users', User);
    this.adminUserService = new AdminUserService();
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user data
   */
  async register(userData) {
    let userRecord = null;

    try {
      // If role is bakery_admin, delegate to AdminUserService
      if (userData.role === 'bakery_admin') {
        return await this.adminUserService.create(userData);
      }
      return null;
    } catch (error) {
      // Cleanup if necessary
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
   * Login user
   * @param {string} idToken - Firebase ID token
   * @param {string} email - User email
   * @returns {Promise<Object>} User data
   */
  async login(idToken, email) {
    try {
      // 1. Verify token
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // 2. Get user document
      const userSnapshot = await this.getCollectionRef()
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        throw new NotFoundError('User not found');
      }

      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();

      // 3. Verify UID
      if (decodedToken.uid !== userDoc.id) {
        throw new AuthenticationError('User authentication failed');
      }

      return {
        uid: userDoc.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        bakeryId: userData.bakeryId,
      };
    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        throw new AuthenticationError('Session expired. Please login again.');
      } else if (error.code === 'auth/invalid-id-token') {
        throw new AuthenticationError('Invalid authentication token.');
      }
      throw error;
    }
  }

  /**
   * Verify Firebase ID token
   * @param {string} idToken - Firebase ID token
   * @returns {Promise<Object>} Decoded token
   */
  async verifyToken(idToken) {
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      if (error) {
        throw new AuthenticationError('Invalid token');
      }
    }
  }

}

// Export a single instance
module.exports = AuthService;
