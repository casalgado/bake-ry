// services/authService.js
const { admin } = require('../config/firebase');
const createBaseService = require('./base/serviceFactory');
const User = require('../models/User');
const adminUserService = require('./adminUserService');
const { NotFoundError, AuthenticationError } = require('../utils/errors');

const createAuthService = () => {
  // Initialize base service
  const baseService = createBaseService('users', User, 'bakeries/{bakeryId}');

  // Custom methods
  const register = async (userData) => {
    let userRecord = null;

    try {
      // If role is bakery_admin, delegate to AdminUserService
      if (userData.role === 'bakery_admin') {
        return await adminUserService.create(userData);
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
  };

  const login = async (idToken, email) => {
    try {
      // 1. Verify token
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      // 2. Get user document by uid (doc id === auth uid)
      const isAdmin = decodedToken.role === 'bakery_admin' || decodedToken.role === 'system_admin';
      const userRef = isAdmin
        ? baseService.getRootRef().doc(decodedToken.uid)
        : baseService.getCollectionRef(decodedToken.bakeryId).doc(decodedToken.uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new NotFoundError('User not found');
      }

      const userData = userDoc.data();

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
  };

  const verifyToken = async (idToken) => {
    try {
      return await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      if (error) {
        throw new AuthenticationError('Invalid token');
      }
    }
  };

  // Return the service object combining base service and custom methods
  return {
    ...baseService,
    register,
    login,
    verifyToken,
  };
};

// Export a singleton instance
module.exports = createAuthService();
