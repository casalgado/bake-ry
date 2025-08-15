const { db, timestamp } = require('../seedConfig');
const SystemSettings = require('../../models/SystemSettings');

async function seedSystemSettings() {
  try {
    console.log('Creating default system settings...');

    const defaultSettings = new SystemSettings({
      id: 'default',
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    await db.collection('systemSettings').doc('default').set(defaultSettings.toFirestore());

    console.log('Default system settings created successfully');

    return {
      id: 'default',
      settings: defaultSettings,
    };
  } catch (error) {
    console.error('Error seeding system settings:', error);
    throw error;
  }
}

async function runSeed() {
  try {
    const result = await seedSystemSettings();
    console.log('System settings seeded successfully');
    console.log(result);
  } catch (error) {
    console.error('Error seeding system settings:', error);
  }
}

// Export the function so it can be used by other seeders
module.exports = seedSystemSettings;

// Only run if this is the main file being executed
if (require.main === module) {
  runSeed();
}
