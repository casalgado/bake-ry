const admin = require('firebase-admin');

const BAKERY_ID = 'es-alimento';
const ADMIN_USER_ID = 'es-alimento-admin';

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

/* PRODUCTION CONFIG
const admin = require('firebase-admin');

const BAKERY_ID = 'bakery-es';
const ADMIN_USER_ID = 'admin-betos-001';

const serviceAccount = require('./../config/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://bake-ry.firebaseio.com',
// If you're using other Firebase services, include their configs here
// For example: databaseURL: "https://your-database-name.firebaseio.com"
});

const db = admin.firestore();
const auth = admin.auth();

const timestamp = () => admin.firestore.Timestamp.now();

module.exports = {
  BAKERY_ID,
  ADMIN_USER_ID,
  db,
  auth,
  timestamp,
};

*/
