// One product per kind of inventory behavior, nothing more. Collection ids are
// the ones in productCollections.json. Recipes (and the costs they set) come
// from data/recipes.js, which finds these products by collection + name.
//
//   baguette / original      'recipe', variations: x5 and x5 integral have a
//                            recipe, "otra" does not (a missing-recipe gap)
//   sourdough / original     'recipe', variations by size, each with a recipe
//   panaderia tradicional /
//     focaccia               'recipe', no variations
//     caja degustación       'recipe', made of other tracked products
//   tortillas / original     'none': not tracked until it is first produced
//   cafe el diario /
//     cold brew              'unit': bought and resold as it comes
const COLLECTIONS = {
  sourdough: { collectionId: 'GRzDxeAWOj2HBhmlObSy', collectionName: 'sourdough' },
  baguette: { collectionId: 'jSuTNbAyUtHSVbMIcfXq', collectionName: 'baguette' },
  tortillas: { collectionId: 'plqaB0ytl2XC1vmw8kNJ', collectionName: 'tortillas' },
  panaderia: { collectionId: 'y4koQ0pzabULphKDyb7E', collectionName: 'panaderia tradicional' },
  cafe: { collectionId: '6XyBqTCgL8U7uavYACuq', collectionName: 'cafe el diario' },
};

const size = (id, name, value, basePrice, displayOrder, isWholeGrain = false) => ({
  id,
  name,
  value,
  basePrice,
  isWholeGrain,
  unit: '',
  type: 'SIZE',
  displayOrder,
});

const product = (collection, name, fields) => ({
  ...COLLECTIONS[collection],
  name,
  taxPercentage: 0,
  isActive: true,
  isDeleted: false,
  customAttributes: {},
  ...fields,
});

const products = [
  product('baguette', 'original', {
    inventoryMode: 'recipe',
    variations: [
      size('baguette-x5', 'x5', 5, 9900, 1),
      size('baguette-x5-integral', 'x5 integral', 5, 9900, 2, true),
      size('baguette-otra', 'otra', 1000, 10000, 999),
    ],
  }),
  product('sourdough', 'original', {
    inventoryMode: 'recipe',
    variations: [
      size('sourdough-pequeno', 'pequeño', 500, 13200, 1),
      size('sourdough-mediano', 'mediano', 950, 19800, 2),
    ],
  }),
  product('panaderia', 'focaccia', { inventoryMode: 'recipe', basePrice: 18000, variations: [] }),
  product('panaderia', 'caja degustación', { inventoryMode: 'recipe', basePrice: 45000, variations: [] }),
  product('tortillas', 'original', { inventoryMode: 'none', basePrice: 12000, variations: [] }),
  product('cafe', 'cold brew', { inventoryMode: 'unit', basePrice: 8000, variations: [] }),
];

module.exports = products;
