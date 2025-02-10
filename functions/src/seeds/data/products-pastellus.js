// productCatalog.js
const PRICES = {
  tortas: {
    'red velvet': {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
    zanahoria: {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
    'ganache chocolate': {
      cuarto: { weight: 250, price: 40000 },  // Slightly higher for chocolate variants
      media: { weight: 500, price: 59000 },
      libra: { weight: 1000, price: 85000 },
    },
    'perla chocolate': {
      cuarto: { weight: 250, price: 40000 },
      media: { weight: 500, price: 59000 },
      libra: { weight: 1000, price: 85000 },
    },
    arequipe: {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
    piña: {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
    ciruela: {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
    limon: {
      cuarto: { weight: 250, price: 38000 },
      media: { weight: 500, price: 57000 },
      libra: { weight: 1000, price: 83000 },
    },
  },
  brownies: {
    tradicional: {
      x4: { quantity: 4, price: 16000 },
      x6: { quantity: 6, price: 24000 },
      x12: { quantity: 12, price: 48000 },
      'x16 mini': { quantity: 16, price: 64000 },
    },
    blondies: {
      x4: { quantity: 4, price: 16000 },
      x6: { quantity: 6, price: 24000 },
      x12: { quantity: 12, price: 48000 },
      'x16 mini': { quantity: 16, price: 64000 },
    },
    milo: {
      x4: { quantity: 4, price: 17000 },  // Slightly higher for special flavor
      x6: { quantity: 6, price: 25500 },
      x12: { quantity: 12, price: 51000 },
      'x16 mini': { quantity: 16, price: 68000 },
    },
    'red velvet': {
      x4: { quantity: 4, price: 17000 },
      x6: { quantity: 6, price: 25500 },
      x12: { quantity: 12, price: 51000 },
      'x16 mini': { quantity: 16, price: 68000 },
    },
  },
  galletas: {
    tradicional: { price: 15000 },  // Price per package
    blondies: { price: 15000 },
    milo: { price: 16500 },
    'red velvet': { price: 16500 },
  },
  postres: {
    chocoflan: { price: 45000 },
    'tres leches': { price: 42000 },
    cheesecake: { price: 48000 },
  },
};

function generateProducts() {
  const products = [];

  // 1. Generate tortas products
  Object.entries(PRICES.tortas).forEach(([flavor, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.weight,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: flavor.toLowerCase(),
      collectionName: 'tortas',
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // 2. Generate brownies products
  Object.entries(PRICES.brownies).forEach(([flavor, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.quantity,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: flavor.toLowerCase(),
      collectionName: 'brownies',
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // 3. Generate simple products (galletas, postres)
  ['galletas', 'postres'].forEach(collection => {
    Object.entries(PRICES[collection]).forEach(([productName, details]) => {
      products.push({
        name: productName.toLowerCase(),
        collectionName: collection,
        basePrice: details.price,
        currentPrice: details.price,
        isActive: true,
        isDeleted: false,
        customAttributes: {},
      });
    });
  });

  return products;
}

module.exports = generateProducts;
