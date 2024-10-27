const admin = require("firebase-admin");

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

const testData = {
  bakery: {
    email: "test@bakery.com",
    password: "password123",
    name: "Test Bakery",
    role: "bakery_admin",
  },
  ingredients: [
    {
      id: "flour-001",
      name: "Bread Flour",
      unit: "g",
      costPerUnit: 0.002,
      allergens: ["gluten"],
      category: "Dry Goods",
      minimumStock: 1000,
      currentStock: 5000,
    },
    {
      id: "water-001",
      name: "Water",
      unit: "ml",
      costPerUnit: 0.001,
      category: "Liquids",
      minimumStock: 1000,
      currentStock: 5000,
    },
    {
      id: "salt-001",
      name: "Salt",
      unit: "g",
      costPerUnit: 0.001,
      category: "Dry Goods",
      minimumStock: 100,
      currentStock: 1000,
    },
    {
      id: "yeast-001",
      name: "Active Dry Yeast",
      unit: "g",
      costPerUnit: 0.05,
      category: "Dry Goods",
      minimumStock: 100,
      currentStock: 500,
    },
  ],
  products: [
    {
      id: "baguette-001",
      name: "Classic Baguette",
      description: "Traditional French baguette",
      category: "Bread",
      isActive: true,
    },
    {
      id: "baguette-mini-001",
      name: "Mini Baguette",
      description: "Small version of our classic baguette",
      category: "Bread",
      isActive: true,
    },
  ],
  recipe: {
    name: "Classic French Baguette",
    description:
      "Traditional French baguette with crispy crust and chewy interior",
    category: "Bread",
    ingredients: [
      {
        ingredientId: "flour-001",
        quantity: 1000,
        notes: "High protein bread flour",
      },
      {
        ingredientId: "water-001",
        quantity: 650,
        notes: "Room temperature",
      },
      {
        ingredientId: "salt-001",
        quantity: 20,
      },
      {
        ingredientId: "yeast-001",
        quantity: 7,
        notes: "Active dry yeast",
      },
    ],
    steps: [
      {
        stepNumber: 1,
        description: "Mix flour and water for autolyse. Rest 30 minutes.",
      },
      {
        stepNumber: 2,
        description: "Add salt and yeast. Mix until developed.",
      },
    ],
    yield: {
      quantity: 3,
      unit: "baguettes",
      servings: 12,
    },
    preparationTime: 180,
    bakingTime: 30,
    bakingTemp: {
      value: 240,
      unit: "C",
    },
    laborCost: 12.0,
    overheadCost: 5.0,
    productIds: ["baguette-001", "baguette-mini-001"],
  },
};

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

    // 3. Create ingredients
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
      });
    });
    await ingredientBatch.commit();

    // 4. Create products
    console.log("Creating products...");
    const productBatch = db.batch();
    testData.products.forEach((product) => {
      const ref = db
        .collection(`bakeries/${bakeryId}/products`)
        .doc(product.id);
      productBatch.set(ref, {
        ...product,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    await productBatch.commit();

    // 5. Create recipe
    console.log("Creating recipe...");
    await testRecipeEndpoints(bakeryId);

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

async function testRecipeEndpoints(bakeryId) {
  try {
    console.log("Testing recipe endpoints...");

    // 1. Create Recipe
    console.log("Testing create recipe...");
    const recipeRef = db.collection(`bakeries/${bakeryId}/recipes`).doc();
    await recipeRef.set({
      ...testData.recipe,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    });

    // 2. Get Recipe
    console.log("Testing get recipe...");
    const recipeDoc = await recipeRef.get();
    console.log("Recipe created:", recipeDoc.exists);

    // 3. Update Recipe
    console.log("Testing update recipe...");
    await recipeRef.update({
      description: "Updated description",
      updatedAt: new Date(),
    });

    // 4. Scale Recipe (this would normally be done through the API)
    console.log("Note: Scale recipe can be tested through the API endpoint");

    return recipeRef.id;
  } catch (error) {
    console.error("Error testing recipe endpoints:", error);
    throw error;
  }
}

async function cleanupTestEnvironment(userId, bakeryId) {
  try {
    console.log("Cleaning up test environment...");

    // Delete all subcollections
    const collections = ["ingredients", "products", "recipes"];
    for (const collection of collections) {
      const snapshot = await db
        .collection(`bakeries/${bakeryId}/${collection}`)
        .get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // Delete bakery
    await db.collection("bakeries").doc(bakeryId).delete();

    // Delete user document
    await db.collection("users").doc(userId).delete();

    // Delete Firebase Auth user
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

    // Handle cleanup on process termination
    process.on("SIGINT", async () => {
      if (testEnv) {
        await cleanupTestEnvironment(testEnv.userId, testEnv.bakeryId);
      }
      process.exit();
    });
  } catch (error) {
    console.error("Test run failed:", error);
    if (testEnv) {
      await cleanupTestEnvironment(testEnv.userId, testEnv.bakeryId);
    }
  }
}

// Run the tests
runTests();
