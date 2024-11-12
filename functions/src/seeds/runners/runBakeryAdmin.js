const bakery = require('../data/bakery');
const { initializeFirebase } = require('../utils/seedUtils');
const seedBakeryAndAdmin = require('../methods/seedBakeryAndAdmin');

async function runBakeryAdminSeed() {
  try {
    console.log('Initializing Firebase...');
    const { db, auth } = initializeFirebase();

    console.log('Starting bakery and admin seed...');
    const environment = await seedBakeryAndAdmin(bakery, { db, auth });

    console.log('\nBakery and admin created successfully!');
    console.log('Environment details:');
    console.log(environment);

    return environment;
  } catch (error) {
    console.error('Failed to seed bakery and admin:', error);
    process.exit(1);
  }
}

// Allow this to be run directly or imported
if (require.main === module) {
  runBakeryAdminSeed();
} else {
  module.exports = runBakeryAdminSeed;
}
