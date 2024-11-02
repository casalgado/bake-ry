const admin = require("firebase-admin");
const recipeTestData = require("./recipeTestData");
const testData = require("./testData")
  // Initialize Firebase Admin with a project ID
  admin.initializeApp({
    projectId: "bake-ry",
  });

// Get Firestore and Auth instances
const db = admin.firestore();
const auth = admin.auth();

// Connect to emulators
db.settings({
  host: "localhost:8080",
  ssl: false,
});

// Set Auth emulator host through environment variable
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

async function setupTestEnvironment() {
  try {
    // 1. Create bakery admin user in Firebase Auth
    console.log("Creating bakery admin user...");
    const userRecord = await auth.createUser({
      email: testData.bakery.email,
      password: testData.bakery.password,
    });

    // Initial custom claims with role only
    await auth.setCustomUserClaims(userRecord.uid, {
      role: testData.bakery.role,
    });

    // 2. Create bakery document
    console.log("Creating bakery document...");
    const bakeryRef = db.collection("bakeries").doc();
    const bakeryId = bakeryRef.id;

    // Start a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      // Set bakery document
      transaction.set(bakeryRef, {
        name: testData.bakery.name,
        ownerId: userRecord.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      });

      // Set user document
      const userRef = db.collection("users").doc(userRecord.uid);
      transaction.set(userRef, {
        email: testData.bakery.email,
        name: testData.bakery.name,
        role: testData.bakery.role,
        bakeryId: bakeryId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Update custom claims with bakeryId
    console.log("Updating custom claims with bakeryId...");
    await auth.setCustomUserClaims(userRecord.uid, {
      role: testData.bakery.role,
      bakeryId: bakeryId,
    });

    // Verify the claims were set correctly
    const updatedUser = await auth.getUser(userRecord.uid);
    console.log("Updated custom claims:", updatedUser.customClaims);

    // Build a map of which ingredients are used in which recipes
    const ingredientRecipeMap = new Map();
    recipeTestData.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        if (!ingredientRecipeMap.has(ing.ingredientId)) {
          ingredientRecipeMap.set(ing.ingredientId, []);
        }
        ingredientRecipeMap.get(ing.ingredientId).push(recipe.id);
      });
    });

    // 3. Create ingredients with recipe relationships
    console.log("Creating ingredients...");
    const ingredientBatch = db.batch();
    testData.ingredients.forEach((ingredient) => {
      const ref = db
        .collection(`bakeries/${bakeryId}/ingredients`)
        .doc(ingredient.id);
      ingredientBatch.set(ref, {
        ...ingredient,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        type: "Raw Material",
        customAttributes: {},
        purchaseHistory: [],
        usedInRecipes: ingredientRecipeMap.get(ingredient.id) || [],
        averageMonthlyUsage: 0,
        consumptionRate: 0,
        currency: "USD",
      });
    });
    await ingredientBatch.commit();

    // 4. Create recipes
    console.log("Creating recipes...");
    const recipeBatch = db.batch();
    recipeTestData.recipes.forEach((recipe) => {
      const recipeRef = db
        .collection(`bakeries/${bakeryId}/recipes`)
        .doc(recipe.id);
      recipeBatch.set(recipeRef, {
        ...recipe,
        bakeryId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      });
    });
    await recipeBatch.commit();

    console.log("Test environment setup complete!");
    console.log("Bakery ID:", bakeryId);
    console.log("User ID:", userRecord.uid);

    return {
      bakeryId,
      userId: userRecord.uid,
      email: testData.bakery.email,
      password: testData.bakery.password,
    };
  } catch (error) {
    console.error("Error setting up test environment:", error);
    throw error;
  }
}

async function cleanupTestEnvironment(userId, bakeryId) {
  try {
    console.log("Cleaning up test environment...");

    // Delete all recipes
    const recipesSnapshot = await db
      .collection(`bakeries/${bakeryId}/recipes`)
      .get();
    const recipeBatch = db.batch();
    recipesSnapshot.docs.forEach((doc) => {
      recipeBatch.delete(doc.ref);
    });
    await recipeBatch.commit();

    // Delete all ingredients
    const ingredientsSnapshot = await db
      .collection(`bakeries/${bakeryId}/ingredients`)
      .get();
    const ingredientBatch = db.batch();
    ingredientsSnapshot.docs.forEach((doc) => {
      ingredientBatch.delete(doc.ref);
    });
    await ingredientBatch.commit();

    // Delete bakery and user
    await db.collection("bakeries").doc(bakeryId).delete();
    await db.collection("users").doc(userId).delete();
    await auth.deleteUser(userId);

    console.log("Cleanup complete!");
  } catch (error) {
    console.error("Error cleaning up test environment:", error);
    throw error;
  }
}

// Usage
async function runTests() {
  let testEnv = null;
  try {
    testEnv = await setupTestEnvironment();
    console.log("Test environment created successfully!");
    console.log("Use these credentials for API testing:");
    console.log(testEnv);

    // Wait for user input before cleanup
    console.log(
      "\nPress Ctrl+C when you're done testing to cleanup the test environment."
    );

    // Better cleanup handling
    process.on("SIGINT", async () => {
      console.log("\nReceived SIGINT. Starting cleanup...");
      if (testEnv) {
        try {
          await cleanupTestEnvironment(testEnv.userId, testEnv.bakeryId);
          console.log("Cleanup successful, exiting...");
          process.exit(0);
        } catch (error) {
          console.error("Error during cleanup:", error);
          process.exit(1);
        }
      } else {
        process.exit(0);
      }
    });

    // Return a promise that never resolves, keeping the process alive
    return new Promise(() => {});
  } catch (error) {
    console.error("Test run failed:", error);
    if (testEnv) {
      await cleanupTestEnvironment(testEnv.userId, testEnv.bakeryId);
    }
    process.exit(1);
  }
}

// Run the tests and handle any uncaught errors
runTests().catch((error) => {
  console.error("Uncaught error:", error);
  process.exit(1);
});
