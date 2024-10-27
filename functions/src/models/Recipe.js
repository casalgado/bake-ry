class RecipeIngredient {
  constructor({
    ingredientId,
    name, // Keep for quick reference without fetching ingredient
    quantity,
    unit,
    costPerUnit, // Keep for cost calculations
    notes, // Basic preparation notes
    allergens, // Important for safety
  }) {
    this.ingredientId = ingredientId;
    this.name = name;
    this.quantity = quantity;
    this.baseQuantity = quantity; // Keep for scaling
    this.unit = unit;
    this.costPerUnit = costPerUnit || 0;
    this.notes = notes;
    this.allergens = allergens || [];
  }

  calculateCost() {
    return this.quantity * this.costPerUnit;
  }

  scaleQuantity(factor) {
    this.quantity = this.baseQuantity * factor;
    return this.quantity;
  }
}

class Recipe {
  constructor({
    // Basic Information
    id,
    bakeryId,
    productIds, // Array of product IDs
    name,
    description,
    category, // e.g., "Bread", "Cake", "Pastry"
    version, // Keep for recipe management

    // Core Recipe Details
    ingredients, // Array of RecipeIngredient objects
    steps, // Array of preparation steps
    yield, // {quantity: number, unit: string}

    // Time Management
    preparationTime, // in minutes
    bakingTime, // in minutes

    // Cost Information
    laborCost, // Per batch
    overheadCost, // Per batch

    // Essential Production Info
    bakingTemp, // {value: number, unit: "C" | "F"}

    // Status and Timestamps
    isActive,
    createdAt,
    updatedAt,

    // Basic Quality Control
    notes, // General notes and tips
  }) {
    // Basic Information
    this.id = id;
    this.bakeryId = bakeryId;
    this.productIds = productIds || [];
    this.name = name;
    this.description = description;
    this.category = category;
    this.version = version || 1;

    // Core Recipe Details
    this.ingredients = ingredients || [];
    this.steps = steps || [];
    this.yield = yield;

    // Time Management
    this.preparationTime = preparationTime || 0;
    this.bakingTime = bakingTime || 0;
    this.totalTime = (preparationTime || 0) + (bakingTime || 0);

    // Cost Information
    this.laborCost = laborCost || 0;
    this.overheadCost = overheadCost || 0;
    this.totalCost = 0; // Will be calculated

    // Essential Production Info
    this.bakingTemp = bakingTemp;

    // Status and Timestamps
    this.isActive = isActive ?? true;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();

    // Basic Quality Control
    this.notes = notes;

    // Calculate initial costs
    this.updateCosts();
  }

  // Firestore Data Conversion
  toFirestore() {
    const data = { ...this };
    delete data.id;

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Recipe({
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
  }

  // Core Methods
  addIngredient(ingredient) {
    this.ingredients.push(new RecipeIngredient(ingredient));
    this.updateCosts();
  }

  removeIngredient(ingredientId) {
    this.ingredients = this.ingredients.filter(
      (i) => i.ingredientId !== ingredientId
    );
    this.updateCosts();
  }

  updateCosts() {
    // Calculate ingredients cost
    const ingredientsCost = this.ingredients.reduce((total, ingredient) => {
      return total + ingredient.calculateCost();
    }, 0);

    // Add labor and overhead
    this.totalCost = ingredientsCost + this.laborCost + this.overheadCost;
    this.updatedAt = new Date();
  }

  scale(factor) {
    if (factor <= 0) throw new Error("Scaling factor must be positive");

    this.ingredients.forEach((ingredient) => {
      ingredient.scaleQuantity(factor);
    });

    this.updateCosts();
  }

  getAllergens() {
    const allergens = new Set();
    this.ingredients.forEach((ingredient) => {
      ingredient.allergens.forEach((allergen) => allergens.add(allergen));
    });
    return Array.from(allergens);
  }
}

module.exports = { Recipe, RecipeIngredient };

// Example Usage:
const chocolateCakeRecipe = new Recipe({
  name: "Classic Chocolate Cake",
  description: "Rich, moist chocolate cake",
  category: "Cake",
  bakeryId: "bakery_123",
  productId: "product_choc_cake_001",

  ingredients: [
    new RecipeIngredient({
      ingredientId: "ing_flour_001",
      name: "All-Purpose Flour",
      quantity: 210,
      unit: "g",
      costPerUnit: 0.002,
      notes: "Sifted",
      allergens: ["gluten"],
    }),
    new RecipeIngredient({
      ingredientId: "ing_sugar_001",
      name: "Granulated Sugar",
      quantity: 200,
      unit: "g",
      costPerUnit: 0.001,
    }),
  ],

  steps: [
    {
      stepNumber: 1,
      description: "Preheat oven to 180°C. Grease cake pan.",
    },
    {
      stepNumber: 2,
      description: "Mix dry ingredients.",
    },
  ],

  yield: {
    quantity: 1,
    unit: "cake",
    servings: 12,
  },

  preparationTime: 30,
  bakingTime: 35,

  bakingTemp: {
    value: 180,
    unit: "C",
  },

  laborCost: 10.0,
  overheadCost: 5.0,

  notes: "Ensure all ingredients are at room temperature.",
});
