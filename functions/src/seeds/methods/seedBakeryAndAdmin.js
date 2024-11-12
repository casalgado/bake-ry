const { BakerySettings } = require('../../models/BakerySettings');
const { BAKERY_ID, ADMIN_USER_ID, timestamp } = require('../utils/constants');

const seedBakeryAndAdmin = async (bakery, { db, auth }) => {
  try {
    console.log('Creating bakery admin user and bakery...');

    // 1. Create bakery admin user in Firebase Auth with hardcoded UID
    console.log('Creating bakery admin user...');
    await auth.createUser({
      uid: ADMIN_USER_ID,
      email: bakery.email,
      password: bakery.password,
    });

    // Set custom claims with bakeryId
    await auth.setCustomUserClaims(ADMIN_USER_ID, {
      role: bakery.role,
      bakeryId: BAKERY_ID,
    });

    // 2. Create bakery document with hardcoded ID
    console.log('Creating bakery document...');
    const bakeryRef = db.collection('bakeries').doc(BAKERY_ID);
    await bakeryRef.set({
      name: bakery.name,
      ownerId: ADMIN_USER_ID,
      operatingHours: bakery.openingHours,
      socialMedia: bakery.socialMedia,
      createdAt: timestamp(),
      updatedAt: timestamp(),
      isActive: true,
    });

    // 3. Create settings using BakerySettings model
    console.log('Creating settings...');
    const bakerySettings = new BakerySettings({
      id: 'default',
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    await db
      .collection(`bakeries/${BAKERY_ID}/settings`)
      .doc('default')
      .set(bakerySettings.toFirestore());

    // 4. Create admin user document
    console.log('Creating admin user document...');
    await db.collection('users').doc(ADMIN_USER_ID).set({
      email: bakery.email,
      name: bakery.name,
      role: bakery.role,
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    console.log('Successfully created bakery and admin user');
    return {
      userId: ADMIN_USER_ID,
      bakeryId: BAKERY_ID,
      email: bakery.email,
      password: bakery.password,
    };
  } catch (error) {
    console.error('Error in seedBakeryAndAdmin:', error);
    throw error;
  }
};

module.exports = seedBakeryAndAdmin;
