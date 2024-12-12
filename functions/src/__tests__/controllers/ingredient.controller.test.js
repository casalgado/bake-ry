const IngredientService = require('../../services/IngredientService');
const ingredientController = require('../../controllers/ingredientController');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Mock Ingredient Service
jest.mock('../../services/IngredientService');

describe('Ingredient Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      params: {
        bakeryId: 'test-bakery-id',
        id: 'test-ingredient-id',
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
    it('should create an ingredient with valid data', async () => {
      const validIngredient = {
        name: 'Test Ingredient',
        type: 'manufactured',
        categoryId: 'cat-1',
        categoryName: 'Test Category',
        unit: 'kg',
        costPerUnit: 10,
      };

      mockReq.body = validIngredient;

      const createdIngredient = { ...validIngredient, id: 'new-ingredient-id' };
      IngredientService.prototype.create.mockResolvedValue(createdIngredient);

      await ingredientController.create(mockReq, mockRes);

      expect(IngredientService.prototype.create).toHaveBeenCalledWith(
        validIngredient,
        'test-bakery-id',
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(createdIngredient);
    });

    it('should return error for invalid ingredient data', async () => {
      const invalidIngredient = {
        name: 'Test Ingredient',
        // Missing required fields
      };

      mockReq.body = invalidIngredient;

      await ingredientController.create(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('required'),
      }));
    });
  });

  describe('update', () => {
    it('should update ingredient with valid data', async () => {
      const updateData = {
        name: 'Updated Ingredient',
        costPerUnit: 15,
      };

      mockReq.body = updateData;

      const updatedIngredient = {
        id: 'test-ingredient-id',
        ...updateData,
      };

      IngredientService.prototype.update.mockResolvedValue(updatedIngredient);

      await ingredientController.update(mockReq, mockRes);

      expect(IngredientService.prototype.update).toHaveBeenCalledWith(
        'test-ingredient-id',
        updateData,
        'test-bakery-id',
      );
      expect(mockRes.json).toHaveBeenCalledWith(updatedIngredient);
    });
  });

  describe('delete', () => {
    it('should prevent deletion of ingredient used in recipes', async () => {
      IngredientService.prototype.delete.mockRejectedValue(
        new BadRequestError('Cannot delete ingredient that is used in recipes'),
      );

      await ingredientController.delete(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Cannot delete ingredient that is used in recipes',
      });
    });

    it('should successfully delete unused ingredient', async () => {
      IngredientService.prototype.delete.mockResolvedValue(null);

      await ingredientController.delete(mockReq, mockRes);

      expect(IngredientService.prototype.delete).toHaveBeenCalledWith(
        'test-ingredient-id',
        'test-bakery-id',
        mockReq.user,
      );
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
  });
});
