const BaseController = require('./base/BaseController');
const { BadRequestError, ValidationError } = require('../utils/errors');

class ProductController extends BaseController {
  constructor(productService) {
    if (!productService) {
      throw new Error('ProductService is required');
    }
    super(productService);
  }

  async create(req, res) {
    try {
      const { bakeryId } = req.params;
      const productData = req.body;

      const validationErrors = this.validateProductData(productData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const newProduct = await this.service.create(productData, bakeryId);
      this.handleResponse(res, newProduct, 201);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const { category, name } = req.query;

      // If search parameters are provided, use filters
      if (category || name) {
        const filters = {
          ...(category && { category }),
          ...(name && { name }),
        };
        const products = await this.service.getAll(bakeryId, filters);
        return this.handleResponse(res, products);
      }

      // Otherwise, get all products
      return super.getAll(req, res);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getById(req, res) {
    try {
      const { bakeryId, id } = req.params;

      if (!id) {
        throw new BadRequestError('Product ID is required');
      }

      const product = await this.service.getById(id, bakeryId);
      this.handleResponse(res, product);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { bakeryId, id } = req.params;
      const updateData = req.body;

      const validationErrors = this.validateProductData(updateData);
      if (validationErrors.length > 0) {
        throw new ValidationError(validationErrors.join(', '));
      }

      const updatedProduct = await this.service.update(id, updateData, bakeryId);
      this.handleResponse(res, updatedProduct);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async delete(req, res) {
    try {
      const { bakeryId, id } = req.params;
      await this.service.delete(id, bakeryId);
      this.handleResponse(res, null, 204);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  // Validation helper method
  validateProductData(productData) {
    const errors = [];

    // Basic required fields that all products need
    const basicRequiredFields = ['name', 'category', 'recipeId'];

    // Check basic required fields
    basicRequiredFields.forEach((field) => {
      if (!productData[field]) {
        errors.push(`${field} is required`);
      }
    });

    // Validate based on whether the product has variations
    if (productData.variations && productData.variations.length > 0) {
      // Products with variations should not have a base price
      if (productData.basePrice != 0) {
        errors.push(
          'Products with variations should not have a base price. Price should be set per variation',
        );
      }

      // Validate variations
      productData.variations.forEach((variation, index) => {
        // Required fields for each variation
        if (!variation.name) {
          errors.push(`Variation at index ${index} is missing a name`);
        }

        if (variation.basePrice === undefined || variation.basePrice === null) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" is missing a base price`,
          );
        } else if (variation.basePrice <= 0) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" must have a base price greater than 0`,
          );
        }

        if (!variation.recipeMultiplier) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" must have a recipe multiplier`,
          );
        } else if (variation.recipeMultiplier <= 0) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" must have a recipe multiplier greater than 0`,
          );
        }

        if (!variation.value) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" must have a value`,
          );
        } else if (variation.value <= 0) {
          errors.push(
            `Variation "${
              variation.name || `at index ${index}`
            }" must have a value greater than 0`,
          );
        }
      });
    } else {
      // For products without variations, validate base price
      if (productData.basePrice === undefined || productData.basePrice === null) {
        errors.push('Products without variations must have a base price');
      } else if (productData.basePrice <= 0) {
        errors.push('basePrice must be greater than 0');
      }

      // For products without variations, validate recipe multiplier
      if (!productData.recipeMultiplier) {
        errors.push('Recipe multiplier is required for products without variations');
      } else if (productData.recipeMultiplier <= 0) {
        errors.push('Recipe multiplier must be greater than 0');
      }
    }

    return errors;
  }
}

module.exports = ProductController;
