// __tests__/models/recipe.model.test.js

const { Recipe, RecipeIngredient } = require('../../models/Recipe');

describe('Recipe Models', () => {
  describe('RecipeIngredient', () => {
    let ingredientData;

    beforeEach(() => {
      ingredientData = {
        ingredientId: 'ing-1',
        name: 'Flour',
        quantity: 1000,
        unit: 'g',
        costPerUnit: 2.5,
        notes: 'Sifted',
      };
    });

    it('should create a recipe ingredient with all provided values', () => {
      const ingredient = new RecipeIngredient(ingredientData);

      expect(ingredient).toMatchObject(ingredientData);
    });

    it('should handle empty notes', () => {
      const { notes, ...dataWithoutNotes } = ingredientData;
      void notes;
      const ingredient = new RecipeIngredient(dataWithoutNotes);

      expect(ingredient.notes).toBe('');
    });

    it('should handle toPlainObject conversion', () => {
      const ingredient = new RecipeIngredient(ingredientData);
      const plainObject = ingredient.toPlainObject();

      expect(plainObject).toEqual(ingredientData);
      expect(plainObject).not.toHaveProperty('undefined');
    });
  });

  describe('Recipe', () => {
    let testDate;
    let recipeData;
    let ingredientData;

    beforeEach(() => {
      testDate = new Date();
      ingredientData = {
        ingredientId: 'ing-1',
        name: 'Flour',
        quantity: 1000,
        unit: 'g',
        costPerUnit: 2.5,
        notes: 'Sifted',
      };

      recipeData = {
        id: 'recipe-1',
        bakeryId: 'bakery-1',
        productId: 'product-1',
        name: 'Basic Bread',
        description: 'Simple bread recipe',
        category: 'Bread',
        version: 2,
        ingredients: [ingredientData],
        steps: ['Mix', 'Knead', 'Bake'],
        preparationTime: 30,
        bakingTime: 45,
        notes: 'Handle with care',
        createdAt: testDate,
        updatedAt: testDate,
      };
    });

    it('should create a recipe with all provided values', () => {
      const recipe = new Recipe(recipeData);

      expect(recipe).toMatchObject({
        id: 'recipe-1',
        bakeryId: 'bakery-1',
        productId: 'product-1',
        name: 'Basic Bread',
        description: 'Simple bread recipe',
        category: 'Bread',
        version: 2,
        steps: ['Mix', 'Knead', 'Bake'],
        preparationTime: 30,
        bakingTime: 45,
        isActive: true,
        notes: 'Handle with care',
      });

      expect(recipe.ingredients[0]).toBeInstanceOf(RecipeIngredient);
      expect(recipe.createdAt).toEqual(testDate);
      expect(recipe.updatedAt).toEqual(testDate);
    });

    it('should create a recipe with minimum required values and defaults', () => {
      const minimalData = {
        id: 'recipe-1',
        bakeryId: 'bakery-1',
        name: 'Basic Bread',
      };

      const recipe = new Recipe(minimalData);

      expect(recipe.id).toBe('recipe-1');
      expect(recipe.bakeryId).toBe('bakery-1');
      expect(recipe.name).toBe('Basic Bread');
      expect(recipe.version).toBe(1);
      expect(recipe.ingredients).toEqual([]);
      expect(recipe.steps).toEqual([]);
      expect(recipe.preparationTime).toBe(0);
      expect(recipe.bakingTime).toBe(0);
      expect(recipe.isActive).toBe(true);
      expect(recipe.createdAt).toBeInstanceOf(Date);
      expect(recipe.updatedAt).toBeInstanceOf(Date);
    });

    describe('Computed Properties', () => {
      it('should calculate total time correctly', () => {
        const recipe = new Recipe(recipeData);
        expect(recipe.totalTime).toBe(75); // 30 + 45
      });

      it('should calculate total cost correctly', () => {
        const recipe = new Recipe(recipeData);
        expect(recipe.totalCost).toBe(2500); // 1000 * 2.5
      });

      it('should handle total cost with multiple ingredients', () => {
        const multiIngredientData = {
          ...recipeData,
          ingredients: [
            ingredientData,
            { ...ingredientData, ingredientId: 'ing-2', quantity: 500, costPerUnit: 3 },
          ],
        };
        const recipe = new Recipe(multiIngredientData);
        expect(recipe.totalCost).toBe(4000); // (1000 * 2.5) + (500 * 3)
      });
    });

    describe('Firestore Conversion', () => {
      it('should convert to Firestore format correctly', () => {
        const recipe = new Recipe(recipeData);
        const firestoreData = recipe.toFirestore();

        expect(firestoreData.id).toBeUndefined();
        expect(firestoreData.ingredients[0]).not.toBeInstanceOf(RecipeIngredient);
        expect(firestoreData.ingredients[0]).toEqual(recipe.ingredients[0].toPlainObject());
        expect(firestoreData.createdAt).toEqual(testDate);
        expect(firestoreData.updatedAt).toEqual(testDate);
      });

      it('should convert from Firestore format correctly', () => {
        const doc = {
          id: 'recipe-1',
          exists: true,
          data: () => {
            const { id, ...data } = recipeData;
            void id;
            return data;
          },
        };

        const recipe = Recipe.fromFirestore(doc);

        expect(recipe).toBeInstanceOf(Recipe);
        expect(recipe.id).toBe('recipe-1');
        expect(recipe.ingredients[0]).toBeInstanceOf(RecipeIngredient);
        expect(recipe.ingredients[0].ingredientId).toBe(ingredientData.ingredientId);
      });
    });
  });
});
