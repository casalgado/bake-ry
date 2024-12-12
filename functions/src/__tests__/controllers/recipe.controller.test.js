const RecipeService = require('../../services/RecipeService');
const recipeController = require('../../controllers/recipeController');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Mock Recipe Service
jest.mock('../../services/RecipeService');

describe('Recipe Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      params: {
        bakeryId: 'test-bakery-id',
        id: 'test-recipe-id',
      },
      body: {},
      user: {
        uid: 'test-user-id',
        role: 'bakery_staff',
      },
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a recipe with valid data', async () => {
      const validRecipe = {
        name: 'Test Recipe',
        ingredients: [{
          ingredientId: 'ing-1',
          quantity: 100,
          type: 'manufactured',
        }],
      };

      mockReq.body = validRecipe;

      const createdRecipe = { ...validRecipe, id: 'new-recipe-id' };
      RecipeService.prototype.create.mockResolvedValue(createdRecipe);

      await recipeController.create(mockReq, mockRes);

      expect(RecipeService.prototype.create).toHaveBeenCalledWith(
        validRecipe,
        'test-bakery-id',
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdRecipe);
    });

    it('should return error for invalid recipe data', async () => {
      const invalidRecipe = {
        name: 'Test Recipe',
        ingredients: [], // Empty ingredients array
      };

      mockReq.body = invalidRecipe;

      await recipeController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Recipe must have at least one ingredient',
      });
    });
  });

  describe('update', () => {
    it('should update recipe with valid data', async () => {
      const updateData = {
        name: 'Updated Recipe',
        ingredients: [{
          ingredientId: 'ing-1',
          quantity: 150,
          type: 'manufactured',
        }],
      };

      mockReq.body = updateData;

      const updatedRecipe = {
        id: 'test-recipe-id',
        ...updateData,
      };

      RecipeService.prototype.update.mockResolvedValue(updatedRecipe);

      await recipeController.update(mockReq, mockRes);

      expect(RecipeService.prototype.update).toHaveBeenCalledWith(
        'test-recipe-id',
        updateData,
        'test-bakery-id',
        mockReq.user,
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedRecipe);
    });
  });

});
