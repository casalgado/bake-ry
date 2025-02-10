// jest.setup.js
console.log('Setup file is running!');
process.env.NODE_ENV = 'test';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9199';

jest.mock('../../config/firebase', () => {
  console.log('Mock is being executed!');
  const { initializeFirebase } = require('./firebase');
  const { admin, db } = initializeFirebase();
  console.log('Emulator DB created:', db.toString().slice(0, 50));
  return { admin, db };  // Return both admin and db
});
