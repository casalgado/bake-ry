const admin = require('firebase-admin');

const initializeFirebase = () => {
  // Initialize app
  admin.initializeApp({
    projectId: 'bake-ry',
  });

  // Get Firestore instance
  const db = admin.firestore();
  const auth = admin.auth();

  // Connect to emulators
  db.settings({
    host: 'localhost:8080',
    ssl: false,
  });

  // Set Auth emulator host
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

  return { db, auth, admin };
};

module.exports = {
  initializeFirebase,
};
