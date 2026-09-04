const { initializeFirebase, clearFirestoreData } = require('../setup/firebase');

// Phase 0.1: the deletion guard must read the ingredient's own usedInRecipes
// array (the previous array-contains query never matched, so in-use ingredients
// were deletable).
describe('Ingredient Service — deletion guard', () => {
  let db;
  let ingredientService;
  const bakeryId = 'test-bakery';

  const ingredientRef = (id) =>
    db.collection('bakeries').doc(bakeryId).collection('ingredients').doc(id);

  const recipeRef = (id) =>
    db.collection('bakeries').doc(bakeryId).collection('recipes').doc(id);

  const seedIngredient = (id, usedInRecipes = []) =>
    ingredientRef(id).set({
      name: 'harina',
      isResale: false,
      unit: 'g',
      costPerUnit: 5,
      usedInRecipes,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  beforeAll(() => {
    ({ db } = initializeFirebase());
    ingredientService = require('../../services/ingredientService');
  });

  beforeEach(async () => {
    await clearFirestoreData(db);
  });

  it('blocks deletion and names the blocking recipes', async () => {
    await seedIngredient('ing1', ['r1', 'r2']);
    await recipeRef('r1').set({ name: 'Torta 500g' });
    await recipeRef('r2').set({ name: 'Croissant' });

    await expect(ingredientService.remove('ing1', bakeryId)).rejects.toThrow(
      /Torta 500g.*Croissant/,
    );

    const doc = await ingredientRef('ing1').get();
    expect(doc.exists).toBe(true);
  });

  it('allows deletion when the ingredient is used nowhere', async () => {
    await seedIngredient('ing1', []);

    await expect(ingredientService.remove('ing1', bakeryId)).resolves.not.toThrow();
  });

  it('allows deletion when the back-reference is stale (recipe no longer exists)', async () => {
    await seedIngredient('ing1', ['deleted-recipe']);

    await expect(ingredientService.remove('ing1', bakeryId)).resolves.not.toThrow();
  });
});
