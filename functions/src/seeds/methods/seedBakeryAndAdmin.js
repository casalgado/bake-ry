const AuthService = require('../../services/AuthService');
const BakeryService = require('../../services/BakeryService');

const seedBakeryAndAdmin = async (bakery) => {
  try {
    console.log('Creating bakery admin user and bakery...');

    const authService = new AuthService();
    const bakeryService = new BakeryService();

    // 1. Register admin user
    console.log('Creating bakery admin user...');
    const adminData = {
      email: bakery.email,
      password: bakery.password,
      name: bakery.name,
      role: 'bakery_admin',
    };

    const userData = await authService.register(adminData);

    // 2. Create bakery
    console.log('Creating bakery document...');
    const bakeryData = {
      name: bakery.name,
      ownerId: userData.uid,
      operatingHours: bakery.openingHours,
      socialMedia: bakery.socialMedia,
      isActive: true,
    };

    const createdBakery = await bakeryService.create(bakeryData);

    console.log('Successfully created bakery and admin user');
    return {
      userId: userData.uid,
      bakeryId: createdBakery.id,
      email: bakery.email,
      password: bakery.password,
    };
  } catch (error) {
    console.error('Error in seedBakeryAndAdmin:', error);
    throw error;
  }
};

module.exports = seedBakeryAndAdmin;
