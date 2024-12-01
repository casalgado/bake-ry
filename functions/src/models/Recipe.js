const BaseModel = require('./base/BaseModel');

class RecipeIngredient {
  constructor({
    ingredientId,
    type,
    name,
    quantity,
    unit,
    costPerUnit,
    notes = '',

  }) {
    this.ingredientId = ingredientId;
    this.type = type;
    this.name = name;
    this.quantity = quantity;
    this.unit = unit;
    this.costPerUnit = costPerUnit;
    this.notes = notes;
  }

  toPlainObject() {
    const data = { ...this };
    // Remove undefined values
    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }
}

class Recipe extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    productId = null,
    name,
    description,
    version = 1,
    createdAt,
    updatedAt,

    // Core Recipe Details
    ingredients = [],
    steps = [],

    // Time Management
    preparationTime = 0,
    bakingTime = 0,

    // Status
    isActive = true,
    isDeleted = false,

    // Notes
    notes,
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Information
    this.bakeryId = bakeryId;
    this.productId = productId;
    this.name = name;
    this.description = description;
    this.version = version;

    // Core Recipe Details
    this.ingredients = ingredients.map(ingredient =>
      ingredient instanceof RecipeIngredient
        ? ingredient
        : new RecipeIngredient(ingredient),
    );
    this.steps = steps;

    // Time Management
    this.preparationTime = preparationTime;
    this.bakingTime = bakingTime;

    // Status
    this.isActive = isActive;
    this.isDeleted = isDeleted;
    // Notes
    this.notes = notes;
  }

  get totalTime() {
    return this.preparationTime + this.bakingTime;
  }

  get totalCost() {
    return this.ingredients.reduce((sum, ingredient) =>
      sum + (ingredient.quantity * ingredient.costPerUnit), 0);
  }

  toFirestore() {
    const data = super.toFirestore();
    data.ingredients = this.ingredients.map(ingredient => ingredient.toPlainObject());
    return data;
  }

  static fromFirestore(doc) {
    // First, let BaseModel handle the basic conversion including dates
    const baseInstance = super.fromFirestore(doc);
    if (!baseInstance) return null;

    // Now add Recipe-specific conversions (like ingredients)
    return new Recipe({
      ...baseInstance,
      ingredients: baseInstance.ingredients.map(ing => new RecipeIngredient(ing)),
    });
  }
}

module.exports = { Recipe, RecipeIngredient };
