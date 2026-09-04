// functions/tests/setup/firebase.js

const admin = require('firebase-admin');

function setupEmulators() {
  // Set emulator host environment variables
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';
}

function initializeFirebase() {
  // Set up emulators first
  setupEmulators();

  // Initialize Firebase Admin if not already initialized
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'bake-ry',
    });
  }

  // Get Firestore instance
  const db = admin.firestore();

  return { admin, db };
}

async function clearFirestoreData(db) {
  try {
    // recursiveDelete walks the whole tree under each root collection —
    // arbitrarily deep subcollections included (e.g. products/{id}/updateHistory).
    // The old hand-rolled version only reached two levels, so deep subcollections
    // on fixed-id docs leaked across tests.
    const collections = await db.listCollections();
    await Promise.all(collections.map((collection) => db.recursiveDelete(collection)));
  } catch (error) {
    console.error('Error clearing Firestore data:', error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  clearFirestoreData,
};
