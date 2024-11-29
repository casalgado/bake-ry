const { ForbiddenError, NotFoundError, BadRequestError } = require('../../utils/errors');
const QueryParser = require('../../utils/queryParser');

class BaseController {
  constructor(service, validateData = null) {
    if (!service) {
      throw new Error('Service is required');
    }
    this.service = service;
    this.validateData = validateData;
  }

  /**
   * Validate data and throw BadRequestError if validation fails
   */
  validateRequestData(data) {
    if (!this.validateData) return;

    const errors = this.validateData(data);
    if (errors && errors.length > 0) {
      throw new BadRequestError(errors.join('. '));
    }
  }

  /**
   * Handle API Response
   */
  handleResponse(res, data, status = 200) {
    res.status(status).json(data);
  }

  /**
   * Handle API Error
   */
  handleError(res, error) {
    console.error('Operation error:', error);

    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }

    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: error.message });
    }

    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create resource
   */
  async create(req, res) {
    try {
      const { bakeryId } = req.params;
      const data = req.body;

      if (!data) {
        throw new BadRequestError('Request body is required');
      }

      // Validate data if validation function exists
      this.validateRequestData(data);

      const result = await this.service.create(data, bakeryId);
      this.handleResponse(res, result, 201);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get resource by ID
   */
  async getById(req, res) {
    try {
      const { id, bakeryId } = req.params;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      const result = await this.service.getById(id, bakeryId);
      this.handleResponse(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;

      // Parse the request into a standardized query object
      const queryParser = new QueryParser(req);
      const query = queryParser.getQuery();

      // Pass the structured query to the service
      const results = await this.service.getAll(bakeryId, query);

      this.handleResponse(res, results);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Update resource (PUT)
   */
  async update(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const { createdAt, ...updateData } = req.body;
      void createdAt;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      if (!updateData) {
        throw new BadRequestError('Update data is required');
      }

      // Validate update data if validation function exists
      this.validateRequestData(updateData);

      const result = await this.service.update(id, updateData, bakeryId, req.user);
      this.handleResponse(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Partially update resource (PATCH)
   */
  async patch(req, res) {
    try {
      const { id, bakeryId } = req.params;
      const patchData = req.body;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      if (!patchData || Object.keys(patchData).length === 0) {
        throw new BadRequestError('Patch data is required');
      }

      // Prevent updates to immutable fields
      const immutableFields = ['id', 'createdAt'];
      const attemptedImmutableUpdate = immutableFields.find(field =>
        Object.prototype.hasOwnProperty.call(patchData, field),
      );

      if (attemptedImmutableUpdate) {
        throw new BadRequestError(`Cannot update immutable field: ${attemptedImmutableUpdate}`);
      }

      // Validate patch data if validation function exists
      this.validateRequestData(patchData);

      const result = await this.service.patch(id, patchData, bakeryId, req.user);
      this.handleResponse(res, result);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Delete resource
   */
  async delete(req, res) {
    try {
      const { id, bakeryId } = req.params;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      await this.service.delete(id, bakeryId);
      res.status(204).send();
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = BaseController;
