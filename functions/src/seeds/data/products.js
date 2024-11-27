const masa_madre_collections = ['sourdough', 'baguette', 'tortillas'];
const flavors = ['original', 'integral', 'zaatar', 'queso costeño', '5 semillas', 'chocolate', 'arandanos & chocolate'];
// const other_collections = ['untables', 'congelados', 'panaderia tradicional', 'cafe el diario'];

const sourdough_variations = [
  {
    name: 'pequeño',
    value: 550,
    basePrice: 12000,
    recipeId: 2,
  },
  {
    name: 'mediano',
    value: 750,
    basePrice: 20000,
    recipeId: 3,
  },
  {
    name: 'grande',
    value: 1000,
    basePrice: 30000,
    recipeId: 4,
  },

];

const baguette_variations = [
  {
    name: 'x5',
    value: 5,
    basePrice: 10000,
    recipeId: 5,
  },
];

const tortillas_variations = [
  {
    name: 'x6',
    value: 6,
    basePrice: 10000,
    recipeId: 6,
  },
  {
    name: 'x10',
    value: 10,
    basePrice: 15000,
    recipeId: 7,
  },
];

const untable_products = [
  {
    name: 'mermelada de fresa',
    basePrice: 18000,
    recipeId: 8,
  },
  {
    name: 'cebolla caramelizada',
    basePrice: 18500,
    recipeId: 9,
  },
];

const panaderia_tradicional_products = [
  {
    name: 'pan de molde',
    basePrice: 14000,
    recipeId: 10,
  },
  {
    name: 'focaccia',
    basePrice: 15000,
    recipeId: 11,
  },
];

const congelados_products = [
  {
    name: 'pan de bono',
    variations: [
      {
        name: 'x6',
        value: 6,
        basePrice: 15000,
        recipeId: 12,
      },
      {
        name: 'x12',
        value: 12,
        basePrice: 25000,
        recipeId: 13,
      },
    ],
  },
  {
    name: 'deditos de olaya',
    variations: [
      {
        name: 'x16',
        value: 16,
        basePrice: 20000,
        recipeId: 14,
      },
    ],
  },
];

const cafe_el_diario_products = [
  {
    name: 'beatriz',
    basePrice: 34500,
    recipeId: 15,
  },
  {
    name: 'margarita',
    basePrice: 34500,
    recipeId: 16,
  },
  { name: 'coldBrew',
    variations: [
      {
        name: 'x 250ml',
        value: 1,
        basePrice: 6000,
      },
      {
        name: '4 unid',
        value: 4,
        basePrice: 20000,
      },
    ],
  },
];

function generateProducts() {
  const products = [];

  // 1. Generate products for masa madre collections (with flavors and their variations)
  masa_madre_collections.forEach(collection => {
    // For each flavor in the collection
    flavors.forEach(flavor => {
      let variations;

      switch (collection) {
      case 'sourdough':
        variations = sourdough_variations;
        break;
      case 'baguette':
        variations = baguette_variations;
        break;
      case 'tortillas':
        variations = tortillas_variations;
        break;
      }

      products.push({
        name: flavor,
        collectionName: collection,
        variations: [...variations.map(v => ({
          name: v.name,
          value: v.value,
          basePrice: v.basePrice,
          recipeId: v.recipeId,
        })), ...variations.map(v => ({
          name: `${v.name} integral`,
          value: v.value,
          basePrice: v.basePrice,
          recipeId: v.recipeId,
          isWholeGrain: true,
        })),   {
          name: 'otra',
          value: 500,
          basePrice: 5000,
          recipeId: 1,
        }],
        isActive: true,
      });
    });
  });

  // 2. Add untables products
  untable_products.forEach(product => {
    products.push({
      name: product.name,
      collectionName: 'untables',
      basePrice: product.basePrice,
      currentPrice: product.basePrice,
      recipeId: product.recipeId,
      isActive: true,
    });
  });

  // 3. Add panaderia tradicional products
  panaderia_tradicional_products.forEach(product => {
    products.push({
      name: product.name,
      collectionName: 'panaderia tradicional',
      basePrice: product.basePrice,
      currentPrice: product.basePrice,
      recipeId: product.recipeId,
      isActive: true,
    });
  });

  // 4. Add congelados products
  congelados_products.forEach(product => {
    products.push({
      name: product.name,
      collectionName: 'congelados',
      variations: product.variations.map(v => ({
        name: v.name,
        value: v.value,
        basePrice: v.basePrice,
        recipeId: v.recipeId,
      })),
      isActive: true,
    });
  });

  // 5. Add cafe products
  cafe_el_diario_products.forEach(product => {
    if (product.variations) {
      products.push({
        name: product.name,
        collectionName: 'cafe el diario',
        variations: product.variations.map(v => ({
          name: v.name,
          value: v.value,
          basePrice: v.basePrice,
          recipeId: v.recipeId,
        })),
        isActive: true,
      });
    } else {
      products.push({
        name: product.name,
        collectionName: 'cafe el diario',
        basePrice: product.basePrice,
        currentPrice: product.basePrice,
        recipeId: product.recipeId,
        isActive: true,
      });
    }
  });

  return products;
}

// Export both the data arrays and the generator function
module.exports = generateProducts;
