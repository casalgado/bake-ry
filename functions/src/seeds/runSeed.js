const admin = require('firebase-admin');
const testData = require('./testData');
const { BakerySettings } = require('./../models/BakerySettings');

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

    // 3. Create settings using BakerySettings model
    console.log('Creating settings...');
    const bakerySettings = new BakerySettings({
      id: 'default',
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    await db
      .collection(`bakeries/${BAKERY_ID}/settings`)
      .doc('default')
      .set(bakerySettings.toFirestore());

    // 4. Create admin user document
    console.log('Creating admin user document...');
    await db.collection('users').doc(ADMIN_USER_ID).set({
      email: testData.bakery.email,
      name: testData.bakery.name,
      role: testData.bakery.role,
      bakeryId: BAKERY_ID,
      createdAt: timestamp(),
      updatedAt: timestamp(),
    });

    // 5. Build ingredient-recipe relationship map
    const ingredientRecipeMap = new Map();
    testData.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        if (!ingredientRecipeMap.has(ing.ingredientId)) {
          ingredientRecipeMap.set(ing.ingredientId, []);
        }
        ingredientRecipeMap.get(ing.ingredientId).push(recipe.id);
      });
    });

    // 6. Create ingredients
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

    // 7. Create recipes
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

    return new Promise(() => {});
  } catch (error) {
    console.error('Test run failed:', error);
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
