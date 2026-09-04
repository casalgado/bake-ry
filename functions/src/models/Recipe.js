const BaseModel = require('./base/BaseModel');

/**
 * A recipe line: either an ingredient or another product's sellable unit.
 * See docs/recipe-costing.md.
 */
class RecipeComponent {
  static TYPES = {
    INGREDIENT: 'ingredient',
    PRODUCT: 'product',
  };

  constructor({
    type,
    id,
    combinationId = null,
    quantity,
    unit,
    notes = '',
  }) {
    // Only an explicit 'product' is a product; anything else is an ingredient.
    // A component's `type` says what KIND OF ROW this is — never confuse it with
    // an ingredient's own `isResale` flag, which is a different question about
    // a different document.
    this.type =
      type === RecipeComponent.TYPES.PRODUCT
        ? RecipeComponent.TYPES.PRODUCT
        : RecipeComponent.TYPES.INGREDIENT;

    this.id = id;
    this.combinationId = this.isProduct() ? combinationId || null : null;

    // Pure structure — how much of this ingredient/product the recipe uses.
    // Cost is never stored here; recipeGraph.computeRecipeCost reads it live
    // from the component's own source doc.
    this.quantity = quantity;
    this.unit = unit;
    this.notes = notes;
  }

  isProduct() {
    return this.type === RecipeComponent.TYPES.PRODUCT;
  }

  isIngredient() {
    return this.type === RecipeComponent.TYPES.INGREDIENT;
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
    // Owner — exactly one of these three shapes:
    //   productId alone            → product without variations
    //   productId + combinationId  → a specific sellable combination
    //   ingredientId alone         → a production ingredient (crema pastelera)
    productId = null,
    combinationId = null,
    ingredientId = null,
    // Required iff ingredient-owned: how much this recipe produces, in the
    // owning ingredient's base unit. `yield` is a reserved word in the
    // strict-mode class body, hence the rename.
    yield: recipeYield = null,
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
    this.combinationId = combinationId;
    this.ingredientId = ingredientId;
    this.yield = recipeYield;
    this.name = name;
    this.description = description;
    this.version = version;

    // Core Recipe Details — the rows are RecipeComponents (ingredients or
    // products), though the field is named `ingredients`.
    this.ingredients = ingredients.map(ingredient =>
      ingredient instanceof RecipeComponent
        ? ingredient
        : new RecipeComponent(ingredient),
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
      ingredients: baseInstance.ingredients.map(ing => new RecipeComponent(ing)),
    });
  }
}

module.exports = { Recipe, RecipeComponent };
