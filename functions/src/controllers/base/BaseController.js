const { ForbiddenError, NotFoundError, BadRequestError } = require('../../utils/errors');

class BaseController {
  constructor(service) {
    if (!service) {
      throw new Error('Service is required');
    }
    this.service = service;
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

    // Add more error type checks as needed
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

  /**
   * Get all resources
   */
  async getAll(req, res) {
    try {
      const { bakeryId } = req.params;
      const query = req.query || {};

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
      const updateData = req.body;

      if (!id) {
        throw new BadRequestError('ID parameter is required');
      }

      if (!updateData) {
        throw new BadRequestError('Update data is required');
      }

      const result = await this.service.update(id, updateData, bakeryId);
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

      const result = await this.service.patch(id, patchData, bakeryId);
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
