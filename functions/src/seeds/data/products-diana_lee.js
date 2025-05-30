// productCatalog.js
const PRICES = {
  'cheesecakes': {
    'Guayaba': {
      completo: { portions: 12, price: 232000 },
      medio: { portions: 6, price: 145000 },
      tiny: { portions: 2, price: 34000 },
    },
    'Pistachio': {
      completo: { portions: 12, price: 227000 },
      medio: { portions: 6, price: 142000 },
      tiny: { portions: 2, price: 34000 },
    },
    'Naranja': {
      completo: { portions: 12, price: 246000 },
      medio: { portions: 6, price: 153000 },
    },
    'Plain': {
      completo: { portions: 12, price: 184000 },
      medio: { portions: 6, price: 115000 },
      tiny: { portions: 2, price: 28000 },
    },
    'Biscoff': {
      completo: { portions: 12, price: 257000 },
      medio: { portions: 6, price: 161000 },
      tiny: { portions: 2, price: 39000 },
    },
    'Key Lime Fantasy': {
      completo: { portions: 12, price: 166000 },
    },

  },
  'nudos y otros': {
    'Pistachio Knots': {
      'x 8': { quantity: 8, price: 136000 },
    },
    'Pistachio Con Helado': {
      '32 oz': { weight: '32 oz', price: 99000 },
    },
  },
  'cakes': {
    'Blackout Chocolate Cake': {
      completo: { portions: 12, price: 195000 },
      medio: { portions: 6, price: 135000 },
      tiny: { portions: 2, price: 30000 },
    },
    'Orange Cake With Chocolate Pecan Streusel': {
      completo: { portions: 12, price: 212000 },
    },
    'Pistachio Paradise cake': {
      completo: { portions: 12, price: 225000 },
      medio: { portions: 6, price: 140000 },
      tiny: { portions: 2, price: 34000 },
    },
    'Apple Crumble Pie': {
      completo: { portions: 12, price: 145000 },
      tiny: { portions: 2, price: 28000 },
    },
    '7 Layer Vanilla Pound Cake With Flaky Salt': {
      completo: { portions: 12, price: 232000 },
      medio: { portions: 6, price: 145000 },
      tiny: { portions: 2, price: 35000 },
    },
    'Royal Lava Cake': {
      xl: { portions: 15, price: 246000 },
      medio: { portions: 6, price: 154000 },
      tiny: { portions: 2, price: 25000 },
    },
    'Velvet Coconut Cream Cake': {
      completo: { portions: 12, price: 246000 },
      medio: { portions: 6, price: 154000 },
      tiny: { portions: 2, price: 37000 },
    },
    'Sticky Walnut Caramel Cake': {
      completo: { portions: 14, price: 190000 },
    },
    'Molten Lava Pistachio Crumble': {
      completo: { portions: 12, price: 279000 },
      medio: { portions: 6, price: 174000 },
    },
    'Orchard Cake': {
      completo: { portions: 12, price: 145000 },
    },
    'Orange Blossom Labneh Dream': {
      completo: { portions: 12, price: 144000 },
    },
    'Dubai Chocolate Tart': {
      completo: { portions: 12, price: 209000 },
    },
    'Biscoff Creamy Cake': {
      completo: { portions: 12, price: 243000 },
      medio: { portions: 6, price: 152000 },
    },
    'Grandma June Chocolate Cake': {
      completo: { portions: 12, price: 144000 },
      medio: { portions: 6, price: 92000 },
    },
    'Grandma June Vanilla Cake': {
      completo: { portions: 12, price: 132000 },
      medio: { portions: 6, price: 84000 },
    },
    'Cake de Almendra': {
      completo: { portions: 12, price: 163000 },
    },
  },
};

function generateProducts() {
  const products = [];

  // Generate Cheesecakes
  Object.entries(PRICES.cheesecakes).forEach(([flavor, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.portions || details.weight || details.quantity,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: flavor.toLowerCase(),
      collectionName: 'cheesecakes',
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // Generate Nudos y otros
  Object.entries(PRICES['nudos y otros']).forEach(([productName, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.portions || details.weight || details.quantity,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: productName.toLowerCase(),
      collectionName: 'nudos y otros',
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  // Generate Cakes
  Object.entries(PRICES.cakes).forEach(([cakeName, sizes]) => {
    const variations = Object.entries(sizes).map(([size, details]) => ({
      name: size,
      value: details.portions,
      basePrice: details.price,
      currentPrice: details.price,
    }));

    products.push({
      name: cakeName.toLowerCase(),
      collectionName: 'cakes',
      variations,
      isActive: true,
      isDeleted: false,
      customAttributes: {},
    });
  });

  return products;
}

module.exports = generateProducts;
