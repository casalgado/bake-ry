const { db } = require('./seedConfig');

const fs = require('fs');
const path = require('path');

async function getAllCollections() {
  const collections = await db.listCollections();
  return collections.map(col => col.id);
}

async function getCollectionData(collectionRef) {
  const snapshot = await collectionRef.get();
  let data = {};

  for (const doc of snapshot.docs) {
    data[doc.id] = await getDocumentData(doc);
  }

  return data;
}

async function getDocumentData(doc) {
  let data = doc.data();

  // Fetch subcollections
  const subcollections = await doc.ref.listCollections();
  if (subcollections.length > 0) {
    data._subcollections = {};

    const excludedCategories = ['updateHistory', 'category_history', 'orderHistory'];

    for (const subcollection of subcollections) {
      if (excludedCategories.includes(subcollection.id)) {
        continue;
      }
      console.log(`Backing up subcollection: ${subcollection.id}`);
      data._subcollections[subcollection.id] = await getCollectionData(subcollection);
    }
  }

  return data;
}

async function backupFirestore() {
  let backup = {};
  const collections = await getAllCollections();

  for (const collectionName of collections) {
    console.log(`Backing up collection: ${collectionName}`);
    const collectionRef = db.collection(collectionName);
    backup[collectionName] = await getCollectionData(collectionRef);
  }

  const timestamp = new Date().toISOString().replace(/[-:Z]/g, '');

  const dataDir = path.join(__dirname, './firestore');
  fs.writeFileSync(
    path.join(dataDir, `firestore_backup_${timestamp}.json`),
    JSON.stringify(backup, null, 2));
  console.log(`Backup saved as firestore_backup_${timestamp}.json`);
}

backupFirestore();
