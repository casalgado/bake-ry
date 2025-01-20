const { db, auth, BAKERY_ID, ADMIN_USER_ID, timestamp } = require('../seedConfig');
const bakery = require('../data/bakery');
const settings = require('../data/settings');
const { BakerySettings } = require('../../models/BakerySettings');
const productCollections = require('../data/productCollections');
const productCollectionService = require('../../services/productCollectionService');
const fs = require('fs');
const path = require('path');

async function seedBakery() {
  try {
    console.log('Creating bakery admin user...');
    await auth.createUser({
      uid: ADMIN_USER_ID,
      email: bakery.email,
      password: bakery.password,
    });

    // Set custom claims
    await auth.setCustomUserClaims(ADMIN_USER_ID, {
      role: bakery.role,
      bakeryId: BAKERY_ID,
    });

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

    // Create admin user document
    console.log('Creating admin user document...');
    await db.collection('users').doc(ADMIN_USER_ID).set({
      email: bakery.email,
      name: bakery.name,
      firstName: bakery.firstName,
      lastName: bakery.lastName,
      role: bakery.role,
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    // Create settings
    console.log('Creating settings...');
    await db
      .collection(`bakeries/${BAKERY_ID}/settings`)
      .doc('default')
      .set(new BakerySettings(settings).toFirestore());

    // Create product collections and store created ones
    console.log('Creating product collections...');
    const createdCollections = [];

    for (const collection of productCollections) {
      const createdCollection = await productCollectionService.create(collection, BAKERY_ID);
      createdCollections.push({
        id: createdCollection.id,
        ...createdCollection,
      });
      console.log(`Created collection: ${createdCollection.name}`);
    }

    // Write created collections to a file for reference
    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededProductCollections.json'),
      JSON.stringify(createdCollections, null, 2),
    );

    console.log('Product collections saved to seededProductCollections.json');

    return {
      bakeryId: BAKERY_ID,
      userId: ADMIN_USER_ID,
      email: bakery.email,
      password: bakery.password,
    };
  } catch (error) {
    console.error('Error seeding bakery:', error);
    throw error;
  }
}

async function runSeed() {
  try {
    const credentials = await seedBakery();
    console.log('Bakery seeded successfully');
    console.log(credentials);
  } catch (error) {
    console.error('Error seeding bakery:', error);
  }
}

// Export the function so it can be used by other seeders
module.exports = seedBakery;

// Only run if this is the main file being executed
if (require.main === module) {
  runSeed();
}
