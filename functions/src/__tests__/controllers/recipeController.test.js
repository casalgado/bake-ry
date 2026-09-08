// tests/controllers/recipeController.test.js
const recipeController = require('../../controllers/recipeController');
const recipeService = require('../../services/recipeService');

jest.mock('../../services/recipeService');
jest.mock('../../services/recipeGraph');

describe('Recipe Controller — create validation', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('accepts a recipe with no components (empty preparación)', async () => {
    const req = {
      params: { bakeryId: 'bakery123' },
      body: { name: 'masa madre', ingredientId: 'harina', yield: 100 },
    };
    recipeService.create.mockResolvedValue({ id: 'recipe123', ...req.body });

    await recipeController.create(req, res);

    expect(recipeService.create).toHaveBeenCalledWith(req.body, 'bakery123');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a component missing an id or quantity', async () => {
    const req = {
      params: { bakeryId: 'bakery123' },
      body: { name: 'brownie', ingredients: [{ id: 'harina' }] },
    };

    await recipeController.create(req, res);

    expect(recipeService.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
