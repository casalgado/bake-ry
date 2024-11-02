class RecipeIngredient {
  constructor({
    ingredientId,
    name,
    quantity,
    unit,
    costPerUnit,
    notes = "",
    allergens = [],
    baseQuantity,
  }) {
    this.ingredientId = ingredientId;
    this.name = name;
    this.quantity = quantity;
    this.baseQuantity = baseQuantity || quantity;
    this.unit = unit;
    this.costPerUnit = costPerUnit;
    this.notes = notes;
    this.allergens = allergens;
  }

  toPlainObject() {
    return {
      ingredientId: this.ingredientId,
      name: this.name,
      quantity: this.quantity,
      baseQuantity: this.baseQuantity,
      unit: this.unit,
      costPerUnit: this.costPerUnit,
      notes: this.notes,
      allergens: this.allergens,
    };
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
    productIds,
    name,
    description,
    category,
    type,
    version,

    // Core Recipe Details
    ingredients = [],
    steps = [],

    // Time Management
    preparationTime,
    bakingTime,

    // Cost Information
    laborCost,
    overheadCost,

    // Essential Production Info
    bakingTemp,

    // Status and Timestamps
    isActive,
    createdAt,
    updatedAt,

    // Basic Quality Control
    notes,
  }) {
    // Basic Information
    this.id = id;
    this.bakeryId = bakeryId;
    this.productIds = productIds || [];
    this.name = name;
    this.description = description;
    this.category = category;
    this.type = type;
    this.version = version || 1;

    // Convert ingredients to RecipeIngredient instances if they aren't already
    this.ingredients = ingredients.map((ingredient) =>
      ingredient instanceof RecipeIngredient
        ? ingredient
        : new RecipeIngredient(ingredient)
    );

    this.steps = steps || [];

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
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt || new Date();

    // Basic Quality Control
    this.notes = notes;

    // Calculate initial costs
    this.updateCosts();
  }

  toFirestore() {
    const data = { ...this };
    delete data.id;

    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });

    // Convert RecipeIngredient instances to plain objects
    data.ingredients = this.ingredients.map((ingredient) =>
      ingredient instanceof RecipeIngredient
        ? ingredient.toPlainObject()
        : ingredient
    );

    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    // Convert plain ingredient objects back to RecipeIngredient instances
    const ingredients = (data.ingredients || []).map(
      (ing) => new RecipeIngredient(ing)
    );

    return new Recipe({
      id: doc.id,
      ...data,
      ingredients,
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    });
  }

  addIngredient(ingredient) {
    const recipeIngredient =
      ingredient instanceof RecipeIngredient
        ? ingredient
        : new RecipeIngredient(ingredient);

    this.ingredients.push(recipeIngredient);
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
