const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    // Try to get existing app
    return {
      db: admin.firestore(),
      auth: admin.auth(),
      admin,
    };
  } catch {
    // Initialize if no app exists
    admin.initializeApp({
      projectId: 'bake-ry',
    });

    const db = admin.firestore();

    // Connect to emulators
    db.settings({
      host: 'localhost:8080',
      ssl: false,
    });

    // Set Auth emulator host
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

    return {
      db: admin.firestore(),
      auth: admin.auth(),
      admin,
    };
  }
};

module.exports = {
  initializeFirebase,
};
