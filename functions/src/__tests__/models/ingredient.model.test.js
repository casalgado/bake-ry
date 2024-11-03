// __tests__/models/ingredient.model.test.js

const Ingredient = require('../../models/Ingredient');

describe('Ingredient Model', () => {
  let testDate;
  let ingredientData;

  beforeEach(() => {
    testDate = new Date();
    ingredientData = {
      id: 'test-id',
      bakeryId: 'bakery-123',
      name: 'Flour',
      description: 'All-purpose flour',
      category: 'Dry Goods',
      costPerUnit: 2000,
      unit: 'kg',
      currentStock: 50,
      createdAt: testDate,
      updatedAt: testDate,
      suppliers: ['supplier-1', 'supplier-2'],
      preferredSupplierId: 'supplier-1',
      storageTemp: 'room',
      notes: 'Handle with care',
    };
  });

  describe('Constructor', () => {
    it('should create an ingredient with all provided values', () => {
      const ingredient = new Ingredient(ingredientData);

      expect(ingredient).toMatchObject({
        id: 'test-id',
        bakeryId: 'bakery-123',
        name: 'Flour',
        description: 'All-purpose flour',
        category: 'Dry Goods',
        costPerUnit: 2000,
        unit: 'kg',
        currentStock: 50,
        createdAt: testDate,
        updatedAt: testDate,
        suppliers: ['supplier-1', 'supplier-2'],
        preferredSupplierId: 'supplier-1',
        storageTemp: 'room',
        notes: 'Handle with care',
        usedInRecipes: [],
        isResaleProduct: false,
        currency: 'COP',
        isActive: true,
        isDiscontinued: false,
        customAttributes: {},
      });
    });

    it('should create an ingredient with minimum required values and defaults', () => {
      const minimalData = {
        id: 'test-id',
        bakeryId: 'bakery-123',
        name: 'Flour',
        unit: 'kg',
      };

      const ingredient = new Ingredient(minimalData);

      // Check required values
      expect(ingredient.id).toBe('test-id');
      expect(ingredient.bakeryId).toBe('bakery-123');
      expect(ingredient.name).toBe('Flour');
      expect(ingredient.unit).toBe('kg');

      // Check default values
      expect(ingredient.usedInRecipes).toEqual([]);
      expect(ingredient.isResaleProduct).toBe(false);
      expect(ingredient.currency).toBe('COP');
      expect(ingredient.costPerUnit).toBe(0);
      expect(ingredient.currentStock).toBe(0);
      expect(ingredient.isActive).toBe(true);
      expect(ingredient.isDiscontinued).toBe(false);
      expect(ingredient.customAttributes).toEqual({});

      // Check date fields
      expect(ingredient.createdAt).toBeInstanceOf(Date);
      expect(ingredient.updatedAt).toBeInstanceOf(Date);
      expect(ingredient.createdAt.getTime()).toBeLessThanOrEqual(new Date().getTime());
      expect(ingredient.updatedAt.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe('BaseModel Integration', () => {
    it('should properly handle Firestore conversion', () => {
      const ingredient = new Ingredient(ingredientData);
      const firestoreData = ingredient.toFirestore();

      // Check that id and _dateFields are removed
      expect(firestoreData.id).toBeUndefined();
      expect(firestoreData._dateFields).toBeUndefined();

      // Check that all other properties are preserved
      expect(firestoreData).toEqual(expect.objectContaining({
        bakeryId: 'bakery-123',
        name: 'Flour',
        description: 'All-purpose flour',
        category: 'Dry Goods',
        costPerUnit: 2000,
        unit: 'kg',
        currentStock: 50,
        createdAt: testDate,
        updatedAt: testDate,
      }));
    });
  });
});
