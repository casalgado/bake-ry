// __tests__/models/product.model.test.js

const { Product, ProductVariation } = require('../../models/Product');

describe('Product Models', () => {
  describe('ProductVariation', () => {
    let variationData;

    beforeEach(() => {
      variationData = {
        name: 'Large',
        size: '20cm',
        weight: 500,
        basePrice: 25000,
        recipeMultiplier: 1.5,
      };
    });

    it('should create a variation with all provided values', () => {
      const variation = new ProductVariation(variationData);

      expect(variation).toMatchObject(variationData);
      expect(variation.currentPrice).toBe(variation.basePrice);
    });

    it('should handle custom current price', () => {
      const variation = new ProductVariation({
        ...variationData,
        currentPrice: 20000,
      });

      expect(variation.currentPrice).toBe(20000);
      expect(variation.basePrice).toBe(25000);
    });

    it('should use default recipe multiplier', () => {
      const { recipeMultiplier, ...dataWithoutMultiplier } = variationData;
      void recipeMultiplier;
      const variation = new ProductVariation(dataWithoutMultiplier);

      expect(variation.recipeMultiplier).toBe(1);
    });

    it('should handle toPlainObject conversion', () => {
      const variation = new ProductVariation(variationData);
      const plainObject = variation.toPlainObject();

      expect(plainObject).toEqual({
        ...variationData,
        currentPrice: variationData.basePrice,
      });
      expect(plainObject).not.toHaveProperty('undefined');
    });
  });

  describe('Product', () => {
    let testDate;
    let productData;
    let variationData;

    beforeEach(() => {
      testDate = new Date();
      variationData = {
        name: 'Large',
        size: '20cm',
        weight: 500,
        basePrice: 25000,
        recipeMultiplier: 1.5,
      };

      productData = {
        id: 'product-1',
        bakeryId: 'bakery-1',
        name: 'Chocolate Cake',
        description: 'Delicious chocolate cake',
        categoryId: 'category-1',
        recipeId: 'recipe-1',
        variations: [variationData],
        basePrice: 20000,
        displayOrder: 1,
        tags: ['chocolate', 'cake'],
        createdAt: testDate,
        updatedAt: testDate,
      };
    });

    it('should create a product with all provided values', () => {
      const product = new Product(productData);

      expect(product).toMatchObject({
        id: 'product-1',
        bakeryId: 'bakery-1',
        name: 'Chocolate Cake',
        description: 'Delicious chocolate cake',
        categoryId: 'category-1',
        recipeId: 'recipe-1',
        basePrice: 20000,
        currentPrice: 20000,
        displayOrder: 1,
        featured: false,
        tags: ['chocolate', 'cake'],
        isActive: true,
        customAttributes: {},
      });

      expect(product.variations[0]).toBeInstanceOf(ProductVariation);
      expect(product.createdAt).toEqual(testDate);
      expect(product.updatedAt).toEqual(testDate);
    });

    it('should create a product with minimum required values and defaults', () => {
      const minimalData = {
        id: 'product-1',
        bakeryId: 'bakery-1',
        name: 'Chocolate Cake',
      };

      const product = new Product(minimalData);

      expect(product.id).toBe('product-1');
      expect(product.bakeryId).toBe('bakery-1');
      expect(product.name).toBe('Chocolate Cake');
      expect(product.recipeMultiplier).toBe(1);
      expect(product.variations).toEqual([]);
      expect(product.tags).toEqual([]);
      expect(product.featured).toBe(false);
      expect(product.isActive).toBe(true);
      expect(product.customAttributes).toEqual({});
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
    });

    describe('Firestore Conversion', () => {
      it('should convert to Firestore format correctly', () => {
        const product = new Product(productData);
        const firestoreData = product.toFirestore();

        expect(firestoreData.id).toBeUndefined();
        expect(firestoreData.variations[0]).not.toBeInstanceOf(ProductVariation);
        expect(firestoreData.variations[0]).toEqual(expect.objectContaining({
          name: 'Large',
          size: '20cm',
          weight: 500,
          basePrice: 25000,
          currentPrice: 25000,
          recipeMultiplier: 1.5,
        }));
        expect(firestoreData.createdAt).toEqual(testDate);
        expect(firestoreData.updatedAt).toEqual(testDate);
      });

      it('should convert from Firestore format correctly', () => {
        const doc = {
          id: 'product-1',
          exists: true,
          data: () => {
            const { id, ...data } = productData;
            void id;
            return data;
          },
        };

        const product = Product.fromFirestore(doc);

        expect(product).toBeInstanceOf(Product);
        expect(product.id).toBe('product-1');
        expect(product.variations[0]).toBeInstanceOf(ProductVariation);
        expect(product.variations[0].name).toBe(variationData.name);
      });
    });
  });
});
