// utils/itemKey.js
//
// THE itemKey builder. Lives apart from stockService because recipeGraph needs
// it and stockService already imports recipeGraph. Never concatenate a key at
// a call site.
const { BadRequestError } = require('./errors');

const ITEM_TYPES = {
  INGREDIENT: 'ingredient',
  PRODUCT: 'product',
};

/**
 * A combination is the sellable unit, so a product with variations gets one
 * stocks doc per combination (bake-ry-front zplanning/inventory/INVENTORY.md §1).
 */
const buildItemKey = (item = {}) => {
  const { itemType, ingredientId, productId, combinationId } = item;

  if (itemType === ITEM_TYPES.INGREDIENT) {
    if (!ingredientId) throw new BadRequestError('itemKey requires ingredientId');
    return `ingredient_${ingredientId}`;
  }

  if (itemType === ITEM_TYPES.PRODUCT) {
    if (!productId) throw new BadRequestError('itemKey requires productId');
    return combinationId
      ? `product_${productId}_${combinationId}`
      : `product_${productId}`;
  }

  throw new BadRequestError(`Unknown stock item type: ${itemType}`);
};

module.exports = { ITEM_TYPES, buildItemKey };
