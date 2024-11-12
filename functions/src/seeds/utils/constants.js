const admin = require('firebase-admin');
const BAKERY_ID = 'bakery-betos-001';
const ADMIN_USER_ID = 'admin-betos-001';

// Helper function to create Firestore timestamp
const timestamp = () => admin.firestore.Timestamp.now();

module.exports = {
  BAKERY_ID,
  ADMIN_USER_ID,
  timestamp,
};
