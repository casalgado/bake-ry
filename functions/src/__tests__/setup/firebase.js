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
      projectId: 'tres-fuegos-en-casa',
    });
  }

  // Get Firestore instance
  const db = admin.firestore();

  return { admin, db };
}

async function deleteCollection(db, collectionRef) {
  const batchSize = 500;
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve();
    return;
  }

  // Create a new batch
  const batch = db.batch();

  // Delete documents in a batch
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  // Recurse on the next process tick
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}

async function clearFirestoreData(db) {
  try {
    const collections = await db.listCollections();
    const promises = collections.map(async (collection) => {
      // First, recursively delete all subcollections
      const docs = await collection.listDocuments();
      const subCollectionPromises = docs.map(async (doc) => {
        const subCollections = await doc.listCollections();
        return Promise.all(subCollections.map(sub => deleteCollection(db, sub)));
      });
      await Promise.all(subCollectionPromises);

      // Then delete the main collection
      return deleteCollection(db, collection);
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error clearing Firestore data:', error);
    throw error;
  }
}

module.exports = {
  initializeFirebase,
  clearFirestoreData,
};
