const { BadRequestError, NotFoundError, ForbiddenError } = require('../../utils/errors');
const QueryParser = require('../../utils/queryParser');

const createBaseController = (service, validateData = null) => {
  const handleResponse = (res, data, status = 200) => {
    res.status(status).json(data);
  };

  const handleError = (res, error) => {
    console.error('Operation error:', error);

    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    if (error instanceof BadRequestError) return res.status(400).json({ error: error.message });
    if (error instanceof ForbiddenError) return res.status(403).json({ error: error.message });

    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  };

  const validateRequestData = (data) => {
    if (!validateData) return;
    const errors = validateData(data);
    if (errors && errors.length > 0) {
      throw new BadRequestError(errors.join('. '));
    }
  };

  return {
    handleResponse,
    handleError,
    validateRequestData,

    async getAll(req, res) {
      try {
        const { bakeryId } = req.params;
        const queryParser = new QueryParser(req);
        const query = queryParser.getQuery();

        const results = await service.getAll(bakeryId, query);
        handleResponse(res, results);
      } catch (error) {
        handleError(res, error);
      }
    },

    async getById(req, res) {
      try {
        const { id, bakeryId } = req.params;
        if (!id) throw new BadRequestError('ID parameter is required');

        const result = await service.getById(id, bakeryId);
        handleResponse(res, result);
      } catch (error) {
        handleError(res, error);
      }
    },

    async create(req, res) {
      try {
        const { bakeryId } = req.params;
        const data = req.body;

        if (!data) throw new BadRequestError('Request body is required');
        validateRequestData(data);

        const result = await service.create(data, bakeryId);
        handleResponse(res, result, 201);
      } catch (error) {
        handleError(res, error);
      }
    },

    async update(req, res) {
      try {
        const { id, bakeryId } = req.params;
        const { createdAt, ...updateData } = req.body;
        void createdAt;

        if (!id) throw new BadRequestError('ID parameter is required');
        if (!updateData) throw new BadRequestError('Update data is required');

        validateRequestData(updateData);

        const result = await service.update(id, updateData, bakeryId, req.user);
        handleResponse(res, result);
      } catch (error) {
        handleError(res, error);
      }
    },

    async patch(req, res) {
      try {
        const { id, bakeryId } = req.params;
        const patchData = req.body;

        if (!id) throw new BadRequestError('ID parameter is required');
        if (!patchData || Object.keys(patchData).length === 0) {
          throw new BadRequestError('Patch data is required');
        }

        const immutableFields = ['id', 'createdAt'];
        const attemptedImmutableUpdate = immutableFields.find(field =>
          Object.prototype.hasOwnProperty.call(patchData, field),
        );

        if (attemptedImmutableUpdate) {
          throw new BadRequestError(`Cannot update immutable field: ${attemptedImmutableUpdate}`);
        }

        validateRequestData(patchData);

        const result = await service.patch(id, patchData, bakeryId, req.user);
        handleResponse(res, result);
      } catch (error) {
        handleError(res, error);
      }
    },

    async remove(req, res) {
      try {
        const { id, bakeryId } = req.params;
        if (!id) throw new BadRequestError('ID parameter is required');

        await service.remove(id, bakeryId, req.user);
        handleResponse(res, null, 204);
      } catch (error) {
        handleError(res, error);
      }
    },
  };
};

module.exports = createBaseController;
