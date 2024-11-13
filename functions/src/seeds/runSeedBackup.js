const admin = require('firebase-admin');
const testData = require('./testData');

const BAKERY_ID = 'bakery-betos-001';
const ADMIN_USER_ID = 'admin-betos-001';

// Initialize Firebase Admin with a project ID
admin.initializeApp({
  projectId: 'bake-ry',
});

// Get Firestore and Auth instances
const db = admin.firestore();
const auth = admin.auth();

// Connect to emulators
db.settings({
  host: 'localhost:8080',
  ssl: false,
});

// Set Auth emulator host through environment variable
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Helper function to create Firestore timestamp
const timestamp = () => admin.firestore.Timestamp.now();

async function setupTestEnvironment() {
  try {
    // 1. Create bakery admin user in Firebase Auth with hardcoded UID
    console.log('Creating bakery admin user...');
    await auth.createUser({
      uid: ADMIN_USER_ID,
      email: testData.bakery.email,
      password: testData.bakery.password,
    });

    // Set custom claims with bakeryId
    await auth.setCustomUserClaims(ADMIN_USER_ID, {
      role: testData.bakery.role,
      bakeryId: BAKERY_ID,
    });

    // 2. Create bakery document with hardcoded ID
    console.log('Creating bakery document...');
    const bakeryRef = db.collection('bakeries').doc(BAKERY_ID);
    await bakeryRef.set({
      name: testData.bakery.name,
      ownerId: ADMIN_USER_ID,
      operatingHours: testData.bakery.openingHours,
      socialMedia: testData.bakery.socialMedia,
      createdAt: timestamp(),
      updatedAt: timestamp(),
      isActive: true,
    });

    // 3. Create admin user document
    console.log('Creating admin user document...');
    await db.collection('users').doc(ADMIN_USER_ID).set({
      email: testData.bakery.email,
      name: testData.bakery.name,
      role: testData.bakery.role,
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    // 4. Build ingredient-recipe relationship map
    const ingredientRecipeMap = new Map();
    testData.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        if (!ingredientRecipeMap.has(ing.ingredientId)) {
          ingredientRecipeMap.set(ing.ingredientId, []);
        }
        ingredientRecipeMap.get(ing.ingredientId).push(recipe.id);
      });
    });

    // 5. Create ingredients
    console.log('Creating ingredients...');
    const ingredientBatch = db.batch();
    testData.ingredients.forEach((ingredient) => {
      const ref = db
        .collection(`bakeries/${BAKERY_ID}/ingredients`)
        .doc(ingredient.id);
      ingredientBatch.set(ref, {
        ...ingredient,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        usedInRecipes: ingredientRecipeMap.get(ingredient.id) || [],
      });
    });
    await ingredientBatch.commit();

    // 6. Create recipes
    console.log('Creating recipes...');
    const recipeBatch = db.batch();
    testData.recipes.forEach((recipe) => {
      const recipeRef = db
        .collection(`bakeries/${BAKERY_ID}/recipes`)
        .doc(recipe.id);
      recipeBatch.set(recipeRef, {
        ...recipe,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        bakeryId: BAKERY_ID,
      });
    });
    await recipeBatch.commit();

    // 7. Create settings
    console.log('Creating settings...');
    await db
      .collection(`bakeries/${BAKERY_ID}/settings`)
      .doc('default')
      .set({
        ...testData.settings,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        bakeryId: BAKERY_ID,
      });

    // 8. Create users
    console.log('Creating users...');
    const userBatch = db.batch();
    testData.users.forEach((user) => {
      const userRef = db
        .collection(`bakeries/${BAKERY_ID}/users`)
        .doc(user.id);
      userBatch.set(userRef, {
        ...user,
        createdAt: timestamp(),
        updatedAt: timestamp(),
        bakeryId: BAKERY_ID,
      });
    });
    await userBatch.commit();

    console.log('Test environment setup complete!');
    console.log('Bakery ID:', BAKERY_ID);
    console.log('Admin User ID:', ADMIN_USER_ID);

    return {
      bakeryId: BAKERY_ID,
      userId: ADMIN_USER_ID,
      email: testData.bakery.email,
      password: testData.bakery.password,
    };
  } catch (error) {
    console.error('Error setting up test environment:', error);
    throw error;
  }
}

async function cleanupTestEnvironment() {
  try {
    console.log('Cleaning up test environment...');

    // Delete all subcollections using batches
    const collections = ['recipes', 'ingredients', 'users', 'settings'];

    for (const collection of collections) {
      const snapshot = await db
        .collection(`bakeries/${BAKERY_ID}/${collection}`)
        .get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Deleted ${collection} collection`);
      }
    }

    // Delete bakery and admin user documents
    await db.collection('bakeries').doc(BAKERY_ID).delete();
    await db.collection('users').doc(ADMIN_USER_ID).delete();

    // Delete admin user from Auth
    await auth.deleteUser(ADMIN_USER_ID);

    console.log('Cleanup complete!');
  } catch (error) {
    console.error('Error cleaning up test environment:', error);
    throw error;
  }
}

async function runTests() {
  let testEnv = null;
  try {
    testEnv = await setupTestEnvironment();
    console.log('Test environment created successfully!');
    console.log('Use these credentials for API testing:');
    console.log(testEnv);

    console.log(
      '\nPress Ctrl+C when you\'re done testing to cleanup the test environment.',
    );

    process.on('SIGINT', async () => {
      console.log('\nReceived SIGINT. Starting cleanup...');
      try {
        await cleanupTestEnvironment();
        console.log('Cleanup successful, exiting...');
        process.exit(0);
      } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
      }
    });

    return new Promise(() => {});
  } catch (error) {
    console.error('Test run failed:', error);
    if (testEnv) {
      await cleanupTestEnvironment();
    }
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
