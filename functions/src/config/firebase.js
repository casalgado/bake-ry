require('dotenv').config();
const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Import the service account key JSON file
const serviceAccount = require('./serviceAccountKey.json');

// Check if any Firebase apps are already initialized
if (!admin.apps.length) {
// Initialize the app with a service account, granting admin privileges
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://bake-ry.firebaseio.com',
  // If you're using other Firebase services, include their configs here
  // For example: databaseURL: "https://your-database-name.firebaseio.com"
  });

}

const db = admin.firestore();

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('🔧 Using Auth Emulator');
}

// Replace 'user-id' with the UID of your test user
// comment out when testing

module.exports = { admin, functions, db };
