const { db, auth, BAKERY_ID, ADMIN_USER_ID, timestamp } = require('../seedConfig');
const bakery = require('../data/bakery');
const settings = require('../data/settings');

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
      .set({
        settings,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        bakeryId: BAKERY_ID,
      });

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

runSeed();
