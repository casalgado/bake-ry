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

    return errors;
  }
}

module.exports = ProductController;
