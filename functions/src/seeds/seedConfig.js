const admin = require('firebase-admin');

const BAKERY_ID = 'bakery-betos-001';
const ADMIN_USER_ID = 'admin-betos-001';

admin.initializeApp({
  projectId: 'bake-ry',
});

const db = admin.firestore();
const auth = admin.auth();

// Configure emulators
db.settings({
  host: 'localhost:8080',
  ssl: false,
});

process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const timestamp = () => admin.firestore.Timestamp.now();

module.exports = {
  BAKERY_ID,
  ADMIN_USER_ID,
  db,
  auth,
  timestamp,
};
