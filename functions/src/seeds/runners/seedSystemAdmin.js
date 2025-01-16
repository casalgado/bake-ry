const { db, auth, BAKERY_ID, timestamp } = require('../seedConfig');

const SYSTEM_ADMIN_USER_ID = 'system-admin';
const SYSTEM_ADMIN_EMAIL = 'dev@carsalhaz.com';
const SYSTEM_ADMIN_PASSWORD = 'aoeuaoeu';

async function seedSystemAdmin() {
  try {
    console.log('Creating system admin user...');
    await auth.createUser({
      uid: SYSTEM_ADMIN_USER_ID,
      email: SYSTEM_ADMIN_EMAIL,
      password: SYSTEM_ADMIN_PASSWORD,
    });

    // Set custom claims
    await auth.setCustomUserClaims(SYSTEM_ADMIN_USER_ID, {
      role: 'system_admin',
      bakeryId: BAKERY_ID,
    });

    // Create admin user document
    console.log('Creating system admin user document...');
    await db.collection('users').doc(SYSTEM_ADMIN_USER_ID).set({
      email: SYSTEM_ADMIN_EMAIL,
      name: 'System Admin',
      role: 'system_admin',
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    return {
      bakeryId: BAKERY_ID,
      userId: SYSTEM_ADMIN_USER_ID,
      email: SYSTEM_ADMIN_EMAIL,
      password: SYSTEM_ADMIN_PASSWORD,
    };
  } catch (error) {
    console.error('Error seeding bakery:', error);
    throw error;
  }
}

async function runSeed() {
  try {
    const credentials = await seedSystemAdmin();
    console.log('System admin seeded successfully');
    console.log(credentials);
  } catch (error) {
    console.error('Error seeding system admin:', error);
  }
}

// Export the function so it can be used by other seeders
module.exports = seedSystemAdmin;

// Only run if this is the main file being executed
if (require.main === module) {
  runSeed();
}
