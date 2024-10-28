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
    password: "aoeuao",
    name: "Test Bakery",
    role: "bakery_admin",
  },
  ingredients: [
    // Harinas y Almidones
    {
      id: "harina-trigo-001",
      name: "Harina de Trigo",
      unit: "kg",
      costPerUnit: 2.5,
      allergens: ["gluten"],
      category: "Harinas y Almidones",
      minimumStock: 10,
      currentStock: 50,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "almidon-maiz-001",
      name: "Almidón de Maíz",
      unit: "kg",
      costPerUnit: 3.0,
      allergens: [],
      category: "Harinas y Almidones",
      minimumStock: 5,
      currentStock: 25,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Líquidos Base
    {
      id: "agua-001",
      name: "Agua Purificada",
      unit: "L",
      costPerUnit: 1.0,
      allergens: [],
      category: "Líquidos Base",
      minimumStock: 20,
      currentStock: 100,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "leche-001",
      name: "Leche Entera",
      unit: "L",
      costPerUnit: 2.5,
      allergens: ["lactosa"],
      category: "Líquidos Base",
      minimumStock: 10,
      currentStock: 40,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },

    // Sazonadores Básicos
    {
      id: "sal-001",
      name: "Sal Refinada",
      unit: "kg",
      costPerUnit: 1.5,
      allergens: [],
      category: "Sazonadores Básicos",
      minimumStock: 5,
      currentStock: 25,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "azucar-001",
      name: "Azúcar Blanca",
      unit: "kg",
      costPerUnit: 2.0,
      allergens: [],
      category: "Sazonadores Básicos",
      minimumStock: 10,
      currentStock: 50,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Fermentos
    {
      id: "levadura-001",
      name: "Levadura Fresca",
      unit: "kg",
      costPerUnit: 8.0,
      allergens: [],
      category: "Fermentos",
      minimumStock: 2,
      currentStock: 10,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },
    {
      id: "levadura-seca-001",
      name: "Levadura Seca",
      unit: "kg",
      costPerUnit: 12.0,
      allergens: [],
      category: "Fermentos",
      minimumStock: 1,
      currentStock: 5,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Lácteos y Proteínas
    {
      id: "huevos-001",
      name: "Huevos",
      unit: "docena",
      costPerUnit: 4.0,
      allergens: ["huevo"],
      category: "Lácteos y Proteínas",
      minimumStock: 10,
      currentStock: 30,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },
    {
      id: "mantequilla-001",
      name: "Mantequilla",
      unit: "kg",
      costPerUnit: 8.0,
      allergens: ["lactosa"],
      category: "Lácteos y Proteínas",
      minimumStock: 5,
      currentStock: 20,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },

    // Semillas y Granos
    {
      id: "semillas-sesamo-001",
      name: "Semillas de Sésamo",
      unit: "kg",
      costPerUnit: 10.0,
      allergens: ["sésamo"],
      category: "Semillas y Granos",
      minimumStock: 2,
      currentStock: 10,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "nueces-001",
      name: "Nueces",
      unit: "kg",
      costPerUnit: 15.0,
      allergens: ["frutos secos"],
      category: "Semillas y Granos",
      minimumStock: 3,
      currentStock: 15,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Frutas y Vegetales
    {
      id: "manzanas-001",
      name: "Manzanas",
      unit: "kg",
      costPerUnit: 3.0,
      allergens: [],
      category: "Frutas y Vegetales",
      minimumStock: 5,
      currentStock: 20,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },
    {
      id: "fresas-001",
      name: "Fresas",
      unit: "kg",
      costPerUnit: 6.0,
      allergens: [],
      category: "Frutas y Vegetales",
      minimumStock: 3,
      currentStock: 10,
      suppliers: [],
      storageTemp: "Refrigeracion",
    },

    // Especias y Aromáticos
    {
      id: "canela-001",
      name: "Canela en Polvo",
      unit: "kg",
      costPerUnit: 20.0,
      allergens: [],
      category: "Especias y Aromáticos",
      minimumStock: 1,
      currentStock: 5,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "vainilla-001",
      name: "Extracto de Vainilla",
      unit: "L",
      costPerUnit: 25.0,
      allergens: [],
      category: "Especias y Aromáticos",
      minimumStock: 1,
      currentStock: 3,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Chocolates y Cocoa
    {
      id: "chocolate-negro-001",
      name: "Chocolate Negro 70%",
      unit: "kg",
      costPerUnit: 18.0,
      allergens: ["soya"],
      category: "Chocolates y Cocoa",
      minimumStock: 5,
      currentStock: 20,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "cocoa-001",
      name: "Cocoa en Polvo",
      unit: "kg",
      costPerUnit: 12.0,
      allergens: [],
      category: "Chocolates y Cocoa",
      minimumStock: 3,
      currentStock: 15,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // Additional ingredients with different units
    {
      id: "colorante-001",
      name: "Colorante Alimentario",
      unit: "ml",
      costPerUnit: 0.5,
      allergens: [],
      category: "Especias y Aromáticos",
      minimumStock: 500,
      currentStock: 2000,
      suppliers: [],
      storageTemp: "Ambiente",
    },
    {
      id: "decoraciones-001",
      name: "Decoraciones Surtidas",
      unit: "paquete",
      costPerUnit: 5.0,
      allergens: [],
      category: "Especias y Aromáticos",
      minimumStock: 10,
      currentStock: 30,
      suppliers: [],
      storageTemp: "Ambiente",
    },

    // More ingredients with Congelacion storage
    {
      id: "pulpa-fruta-001",
      name: "Pulpa de Frutas Congelada",
      unit: "kg",
      costPerUnit: 7.0,
      allergens: [],
      category: "Frutas y Vegetales",
      minimumStock: 5,
      currentStock: 20,
      suppliers: [],
      storageTemp: "Congelacion",
    },
    {
      id: "masa-hojaldre-001",
      name: "Masa de Hojaldre",
      unit: "kg",
      costPerUnit: 9.0,
      allergens: ["gluten"],
      category: "Harinas y Almidones",
      minimumStock: 5,
      currentStock: 15,
      suppliers: [],
      storageTemp: "Congelacion",
    },
  ],
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
        type: "Raw Material",
        customAttributes: {},
        purchaseHistory: [],
        averageMonthlyUsage: 0,
        consumptionRate: 0,
        currency: "USD",
      });
    });
    await ingredientBatch.commit();

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

    // Delete all ingredients
    const snapshot = await db
      .collection(`bakeries/${bakeryId}/ingredients`)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

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
