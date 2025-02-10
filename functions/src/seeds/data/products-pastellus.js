// productCatalog.js
const PRICES = {
  'tortas clasicas': {
    'red velvet': {
      cuarto: { weight: 250, price: 54000 },  // Updated from 38000
      media: { weight: 500, price: 90000 },   // Updated from 57000
      libra: { weight: 1000, price: 125000 }, // Updated from 83000
    },
    zanahoria: {
      cuarto: { weight: 250, price: 40000 },
      media: { weight: 500, price: 59000 },
      libra: { weight: 1000, price: 89000 },
    },
    'chocolate sencilla': {                    // New entry
      cuarto: { weight: 250, price: 40000 },
      media: { weight: 500, price: 62000 },
      libra: { weight: 1000, price: 85000 },
    },
    'perla chocolate': {
      cuarto: { weight: 250, price: 52000 },
      media: { weight: 500, price: 83000 },
      libra: { weight: 1000, price: 112000 },
    },
    'ganache arequipe': {                      // New entry
      cuarto: { weight: 250, price: 55000 },
      media: { weight: 500, price: 89000 },
      libra: { weight: 1000, price: 121000 },
    },
    'naranja': {                               // New entry
      cuarto: { weight: 250, price: 54000 },
      media: { weight: 500, price: 78000 },
      libra: { weight: 1000, price: 108000 },
    },
    'limon y amapola': {                       // New entry
      cuarto: { weight: 250, price: 75000 },
      media: { weight: 500, price: 135000 },
      libra: { weight: 1000, price: 188000 },
    },
    'ciruela': {
      cuarto: { weight: 250, price: 59000 },
      media: { weight: 500, price: 92000 },
      libra: { weight: 1000, price: 131000 },
    },
    'vainilla': {                              // New entry
      cuarto: { weight: 250, price: 50000 },
      media: { weight: 500, price: 75000 },
      libra: { weight: 1000, price: 120000 },
    },
  },
  'tortas especiales': {
    'piña volteada': {
      cuarto: { weight: 250, price: 48000 },
      media: { weight: 500, price: 69000 },
    },
    'red velvet black': {
      cuarto: { weight: 250, price: 63000 },
      media: { weight: 500, price: 105000 },
      libra: { weight: 1000, price: 155000 },
    },
    'red velvet zanahoria': {
      cuarto: { weight: 250, price: 65000 },
      media: { weight: 500, price: 99000 },
      libra: { weight: 1000, price: 145000 },
    },
    'red velvet naked': {
      cuarto: { weight: 250, price: 61000 },
      media: { weight: 500, price: 97000 },
      libra: { weight: 1000, price: 142000 },
    },
    'cookies and cream': {
      cuarto: { weight: 250, price: 76000 },
      media: { weight: 500, price: 113000 },
      libra: { weight: 1000, price: 171000 },
    },
    'banano chocolate': {
      cuarto: { weight: 250, price: 59000 },
      media: { weight: 500, price: 93000 },
      libra: { weight: 1000, price: 134000 },
    },
    'selva negra': {
      cuarto: { weight: 250, price: 74000 },
      media: { weight: 500, price: 119000 },
      libra: { weight: 1000, price: 175000 },
    },
    'frutos rojos': {
      cuarto: { weight: 250, price: 56000 },
      media: { weight: 500, price: 92000 },
      libra: { weight: 1000, price: 128000 },
    },
  },
  postres: {
    'flan del cielo': { price: 61000 },        // New entry
    'chocoflan': { price: 65000 },             // Updated from 45000
    'cheesecake frutos rojos': { price: 63000 },  // New entry
    'cheesecake arequipe': { price: 60000 },   // New entry
    'cheesecake nutella': { price: 68000 },    // New entry
    'cheesecake piña colada': { price: 67000 }, // New entry
  },
};

function generateProducts() {
  const products = [];

  // 1. Generate tortas clasicas products
  Object.entries(PRICES['tortas clasicas']).forEach(([flavor, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.weight,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: flavor.toLowerCase(),
      collectionName: 'tortas clasicas', // Updated from 'tortas'
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // 2. Generate tortas especiales products
  Object.entries(PRICES['tortas especiales']).forEach(([flavor, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.weight,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: flavor.toLowerCase(),
      collectionName: 'tortas especiales', // Updated from 'tortas'
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // // 2. Generate brownies products
  // Object.entries(PRICES.brownies).forEach(([flavor, sizes]) => {
  //   const variations = Object.entries(sizes).map(([size, details]) => ({
  //     name: size,
  //     value: details.quantity,
  //     basePrice: details.price,
  //     currentPrice: details.price,
  //   }));

  //   products.push({
  //     name: flavor.toLowerCase(),
  //     collectionName: 'brownies',
  //     variations,
  //     isActive: true,
  //     isDeleted: false,
  //     customAttributes: {},
  //   });
  // });
  // 3. Generate simple products (postres)
  Object.entries(PRICES.postres).forEach(([productName, details]) => {
    products.push({
      name: productName.toLowerCase(),
      collectionName: 'postres',
      basePrice: details.price,
      currentPrice: details.price,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  return products;
}

module.exports = generateProducts;
