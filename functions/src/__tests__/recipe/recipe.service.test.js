const { db } = require("../../config/firebase");
const recipeService = require("../../services/recipeService");
const { Recipe, RecipeIngredient } = require("../../models/Recipe");
const { BadRequestError, NotFoundError } = require("../../utils/errors");
const {
  requiresNewVersion,
  recipeVersioningService,
  ingredientsChanged,
} = require("../../services/versioning/recipeVersioning");

// Mock Firebase Admin SDK
jest.mock("../../config/firebase", () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

// Mock versioning service
jest.mock("../../services/versioning/recipeVersioning", () => ({
  requiresNewVersion: jest.fn(),
  ingredientsChanged: jest.fn(),
  recipeVersioningService: {
    createVersion: jest.fn(),
  },
}));

// Mock error classes
jest.mock("../../utils/errors", () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = "BadRequestError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = "NotFoundError";
    }
  },
}));

describe("recipeService", () => {
  let mockTransaction;
  const bakeryId = "bakery123";
  const recipeId = "recipe123";

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock transaction
    mockTransaction = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    // Setup db.runTransaction to use our mock transaction
    db.runTransaction.mockImplementation(async (callback) => {
      return callback(mockTransaction);
    });
  });

  describe("createRecipe", () => {
    const mockIngredient = {
      ingredientId: "ing123",
      quantity: 100,
      notes: "Test notes",
    };

    const mockIngredientDoc = {
      exists: true,
      data: () => ({
        name: "Test Ingredient",
        unit: "g",
        costPerUnit: 0.1,
        allergens: ["gluten"],
        usedInRecipes: [],
      }),
      ref: {
        id: "ing123",
      },
    };

    beforeEach(() => {
      const mockIngredientRef = {
        get: () => Promise.resolve(mockIngredientDoc),
      };

      // Setup collection references with proper chaining
      const mockDoc = {
        id: "newRecipeId",
        collection: jest.fn().mockReturnValue({
          doc: jest.fn().mockReturnValue(mockIngredientRef),
        }),
      };

      db.collection.mockImplementation(() => ({
        doc: jest.fn().mockReturnValue(mockDoc),
      }));

      mockTransaction.get.mockResolvedValue(mockIngredientDoc);
    });

    it("should create a recipe and update ingredient references", async () => {
      const recipeData = {
        bakeryId,
        name: "Test Recipe",
        ingredients: [mockIngredient],
        preparationTime: 30,
        bakingTime: 45,
        laborCost: 10,
        overheadCost: 5,
      };

      const result = await recipeService.createRecipe(recipeData);

      expect(mockTransaction.set).toHaveBeenCalled();
      const setCall = mockTransaction.set.mock.calls[0];
      expect(setCall[1]).toMatchObject({
        name: "Test Recipe",
        ingredients: expect.arrayContaining([
          expect.objectContaining({
            ingredientId: "ing123",
            quantity: 100,
          }),
        ]),
      });

      expect(mockTransaction.update).toHaveBeenCalled();
      const updateCall = mockTransaction.update.mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        usedInRecipes: expect.arrayContaining(["newRecipeId"]),
        updatedAt: expect.any(Date),
      });

      expect(result).toMatchObject({
        name: "Test Recipe",
        ingredients: expect.arrayContaining([
          expect.objectContaining({
            ingredientId: "ing123",
          }),
        ]),
      });
    });

    it("should throw BadRequestError if ingredient not found", async () => {
      mockTransaction.get.mockResolvedValue({ exists: false });

      const recipeData = {
        bakeryId,
        name: "Test Recipe",
        ingredients: [mockIngredient],
      };

      await expect(recipeService.createRecipe(recipeData)).rejects.toThrow(
        BadRequestError
      );
    });
  });

  describe("getRecipeById", () => {
    it("should return null if recipe not found", async () => {
      const mockRecipeDoc = { exists: false };

      db.collection.mockReturnValue({
        doc: () => ({
          get: () => Promise.resolve(mockRecipeDoc),
        }),
      });

      const result = await recipeService.getRecipeById(bakeryId, recipeId);
      expect(result).toBeNull();
    });

    it("should return recipe with properly instantiated ingredients", async () => {
      const mockRecipeData = {
        exists: true,
        id: recipeId,
        data: () => ({
          name: "Test Recipe",
          ingredients: [
            {
              ingredientId: "ing123",
              quantity: 100,
              unit: "g",
            },
          ],
          createdAt: { toDate: () => new Date() },
          updatedAt: { toDate: () => new Date() },
          preparationTime: 30,
          bakingTime: 45,
          totalTime: 75,
          laborCost: 10,
          overheadCost: 5,
          isActive: true,
          steps: [],
          productIds: [],
        }),
      };

      db.collection.mockReturnValue({
        doc: () => ({
          get: () => Promise.resolve(mockRecipeData),
        }),
      });

      const result = await recipeService.getRecipeById(bakeryId, recipeId);

      expect(result).toBeInstanceOf(Recipe);
      expect(result.ingredients[0]).toBeInstanceOf(RecipeIngredient);
      expect(result).toMatchObject({
        id: recipeId,
        name: "Test Recipe",
        ingredients: expect.arrayContaining([
          expect.objectContaining({
            ingredientId: "ing123",
            quantity: 100,
          }),
        ]),
      });
    });
  });

  describe("updateRecipe", () => {
    const mockCurrentRecipe = {
      exists: true,
      id: recipeId,
      data: () => ({
        name: "Original Recipe",
        ingredients: [
          { ingredientId: "ing1", quantity: 100 },
          { ingredientId: "ing2", quantity: 200 },
        ],
        preparationTime: 0,
        bakingTime: 0,
        totalTime: 0,
        laborCost: 0,
        overheadCost: 0,
        isActive: true,
        steps: [],
        productIds: [],
      }),
      ref: {
        id: recipeId,
      },
    };

    beforeEach(() => {
      // Reset mocks
      mockTransaction.get.mockReset();
      mockTransaction.update.mockReset();
      requiresNewVersion.mockReturnValue(true);
      ingredientsChanged.mockReturnValue(true);
      recipeVersioningService.createVersion.mockResolvedValue(2);

      // Setup collection mocking with proper chaining
      const mockDocRef = {
        id: recipeId,
      };

      db.collection.mockReturnValue({
        doc: () => mockDocRef,
        where: () => ({
          where: () => ({
            get: () => Promise.resolve({ empty: true }),
          }),
        }),
      });
    });

    it("should update recipe and handle ingredient changes", async () => {
      const updateData = {
        name: "Updated Recipe",
        ingredients: [
          { ingredientId: "ing1", quantity: 150 },
          { ingredientId: "ing3", quantity: 300 },
        ],
      };

      // Setup mock responses
      const mockResponses = [
        mockCurrentRecipe,
        {
          exists: true,
          ref: { id: "ing2" },
          data: () => ({ usedInRecipes: [recipeId] }),
        },
        {
          exists: true,
          ref: { id: "ing3" },
          data: () => ({ usedInRecipes: [] }),
        },
      ];

      mockTransaction.get.mockImplementation(() =>
        Promise.resolve(mockResponses[0])
      );

      const result = await recipeService.updateRecipe(
        bakeryId,
        recipeId,
        updateData
      );

      expect(result.version).toBe(2);
      expect(result.name).toBe("Updated Recipe");
    });

    it("should throw NotFoundError if recipe not found", async () => {
      mockTransaction.get.mockResolvedValue({ exists: false });

      await expect(
        recipeService.updateRecipe(bakeryId, recipeId, {})
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteRecipe", () => {
    beforeEach(() => {
      const mockRecipeRef = {
        id: recipeId,
      };

      db.collection.mockReturnValue({
        doc: () => mockRecipeRef,
        where: () => ({
          where: () => ({
            get: () => Promise.resolve({ empty: true }),
          }),
        }),
      });
    });

    it("should delete recipe if no active products use it", async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          name: "Recipe to Delete",
          ingredients: [],
        }),
      });

      await recipeService.deleteRecipe(bakeryId, recipeId);

      expect(mockTransaction.delete).toHaveBeenCalled();
    });

    it("should throw BadRequestError if recipe is used by active products", async () => {
      mockTransaction.get.mockResolvedValue({
        exists: true,
        data: () => ({
          name: "Recipe to Delete",
          ingredients: [],
        }),
      });

      // Mock products query to return non-empty result
      db.collection.mockReturnValueOnce({
        doc: () => ({
          get: () => Promise.resolve({ exists: true }),
        }),
        where: () => ({
          where: () => ({
            get: () => Promise.resolve({ empty: false }),
          }),
        }),
      });

      await expect(
        recipeService.deleteRecipe(bakeryId, recipeId)
      ).rejects.toThrow(BadRequestError);
    });

    it("should throw NotFoundError if recipe does not exist", async () => {
      mockTransaction.get.mockResolvedValue({ exists: false });

      await expect(
        recipeService.deleteRecipe(bakeryId, recipeId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("scaleRecipe", () => {
    it("should scale recipe ingredients correctly", async () => {
      const mockRecipe = new Recipe({
        id: recipeId,
        name: "Test Recipe",
        ingredients: [
          new RecipeIngredient({
            ingredientId: "ing1",
            quantity: 100,
          }),
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        preparationTime: 30,
        bakingTime: 45,
        totalTime: 75,
        laborCost: 10,
        overheadCost: 5,
        isActive: true,
        steps: [],
        productIds: [],
      });

      jest.spyOn(recipeService, "getRecipeById").mockResolvedValue(mockRecipe);

      const result = await recipeService.scaleRecipe(bakeryId, recipeId, 2);

      expect(result.ingredients[0].quantity).toBe(200);
    });

    it("should return null if recipe not found", async () => {
      jest.spyOn(recipeService, "getRecipeById").mockResolvedValue(null);

      const result = await recipeService.scaleRecipe(bakeryId, recipeId, 2);

      expect(result).toBeNull();
    });
  });
});
