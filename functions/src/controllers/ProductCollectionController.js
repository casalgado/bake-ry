const BaseController = require('./base/BaseController');

class ProductCollectionController extends BaseController {
  constructor(productCollectionService) {
    if (!productCollectionService) {
      throw new Error('ProductCollectionService is required');
    }
    super(productCollectionService, validateCollectionData);
  }
}

function validateCollectionData(data) {
  const errors = [];

  // Validate required fields
  if (!data.name) {
    errors.push('Name is required');
  }

  // Validate display type if provided
  if (data.displayType) {
    if (!['weight', 'quantity'].includes(data.displayType.toLowerCase())) {
      errors.push('Invalid display type');
    }
  }

  // Validate display order
  if (data.displayOrder !== undefined && typeof data.displayOrder !== 'number') {
    errors.push('Display order must be a number');
  }

  // Validate suggested variations if provided
  if (data.suggestedVariations) {
    if (!Array.isArray(data.suggestedVariations)) {
      errors.push('Suggested variations must be an array');
    } else {
      // If collection has no display type, it shouldn't have variations
      if (!data.displayType && data.suggestedVariations.length > 0) {
        errors.push('Collection without display type cannot have variations');
      }

      // Validate each variation
      data.suggestedVariations.forEach((variation, index) => {
        if (!variation.name) {
          errors.push(`Variation at index ${index} is missing a name`);
        }

        if (variation.value === undefined || variation.value === null) {
          errors.push(`Variation "${variation.name || `at index ${index}`}" is missing a value`);
        }

        if (data.displayType === 'weight') {
          if (typeof variation.value !== 'number' || variation.value <= 0) {
            errors.push(`Variation "${variation.name || `at index ${index}`}" must have a positive number value`);
          }
        }

        if (data.displayType === 'quantity') {
          if (!Number.isInteger(variation.value) || variation.value <= 0) {
            errors.push(`Variation "${variation.name || `at index ${index}`}" must have a positive integer value`);
          }
        }

        if (variation.recipeMultiplier === undefined || variation.recipeMultiplier === null) {
          errors.push(`Variation "${variation.name || `at index ${index}`}" is missing a recipe multiplier`);
        } else if (typeof variation.recipeMultiplier !== 'number' || variation.recipeMultiplier <= 0) {
          errors.push(`Variation "${variation.name || `at index ${index}`}" must have a positive recipe multiplier`);
        }
      });
    }
  }

  return errors;
}

module.exports = ProductCollectionController;
