const BaseModel = require('./base/BaseModel');

/**
 * A recipe line: either an ingredient or another product's sellable unit.
 * See INVENTORY-IMPLEMENTATION.md §3.
 */
class RecipeComponent {
  static TYPES = {
    INGREDIENT: 'ingredient',
    PRODUCT: 'product',
  };

  constructor({
    type,
    id,
    ingredientId, // legacy field name, still accepted on read and on write
    combinationId = null,
    name,
    quantity,
    unit,
    costPerUnit,
    notes = '',
  }) {
    // Backward compatibility on read (§1A.4): rows stored before typed components
    // have no `type` (or carry the ingredient's own 'manufactured'/'resale' type)
    // and keep their id in `ingredientId`. Anything that is not explicitly a
    // product is an ingredient. Stored docs are never rewritten in bulk.
    this.type =
      type === RecipeComponent.TYPES.PRODUCT
        ? RecipeComponent.TYPES.PRODUCT
        : RecipeComponent.TYPES.INGREDIENT;

    this.id = id || ingredientId;
    this.combinationId = this.isProduct() ? combinationId || null : null;

    this.name = name;
    this.quantity = quantity;
    this.unit = unit;
    this.costPerUnit = costPerUnit;
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

    // COMPAT SHIM: the frontend's Recipe model still reads `ingredientId` only,
    // so an ingredient row keeps a mirrored copy. `id` is the source of truth —
    // nothing new reads this field. Remove once the recipe editor (plan 1C.2)
    // ships and no stored row predates it.
    if (this.isIngredient()) {
      data.ingredientId = this.id;
    }

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
    // Owner — exactly one of these three shapes (§1A.3, §2):
    //   productId alone            → product without variations
    //   productId + combinationId  → a specific sellable combination
    //   ingredientId alone         → a manufactured ingredient (crema pastelera)
    productId = null,
    combinationId = null,
    ingredientId = null,
    // Required iff ingredient-owned: how much this recipe produces, in the
    // owning ingredient's base unit (§4). `yield` is a reserved word in the
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

    // Core Recipe Details — the field keeps its name for compatibility, but the
    // rows are RecipeComponents (ingredients or products).
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
      ingredients: baseInstance.ingredients.map(ing => new RecipeComponent(ing)),
    });
  }
}

module.exports = { Recipe, RecipeComponent };
