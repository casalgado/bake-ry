// productCatalog.js
const PRICES = {
  sourdough: {
    original: {
      pequeño: { weight: 500, price: 12000 },
      mediano: { weight: 950, price: 18000 },
      grande: { weight: 1700, price: 29000 },
    },
    integral: {
      pequeño: { weight: 500, price: 12000 },
      mediano: { weight: 950, price: 18000 },
      grande: { weight: 1700, price: 29000 },
    },
    zaatar: {
      pequeño: { weight: 500, price: 13000 },
      mediano: { weight: 950, price: 20000 },
      grande: { weight: 1700, price: 34000 },
    },
    'queso costeño': {
      pequeño: { weight: 500, price: 16000 },
      mediano: { weight: 950, price: 25000 },
      grande: { weight: 1700, price: 39000 },
    },
    semillas: {
      pequeño: { weight: 500, price: 18000 },
      mediano: { weight: 950, price: 27000 },
      grande: { weight: 1700, price: 40000 },
    },
    chocolate: {
      pequeño: { weight: 500, price: 29000 },
      mediano: { weight: 950, price: 38000 },
    },
    'arandanos & chocolate': {
      unico: { weight: 650, price: 33000 },
    },
  },
  baguette: {
    original: { weight: 130, price: 9000 },
    integral: { weight: 130, price: 9000 },
    zaatar: { weight: 130, price: 9500 },
    'queso costeño': { weight: 130, price: 14000 },
    semillas: { weight: 130, price: 15000 },
    chocolate: { weight: 130, price: 24000 },
    'arandanos & chocolate': { weight: 130, price: 26000 },
  },
  tortillas: {
    original: {
      x6: { quantity: 6, price: 8500 },
      x10: { quantity: 10, price: 11500 },
    },
    integral: {
      x6: { quantity: 6, price: 8500 },
      x10: { quantity: 10, price: 11500 },
    },
    zaatar: {
      x6: { quantity: 6, price: 9000 },
      x10: { quantity: 10, price: 12500 },
    },
    'queso costeño': {
      x6: { quantity: 6, price: 10500 },
      x10: { quantity: 10, price: 15000 },
    },
    semillas: {
      x6: { quantity: 6, price: 10500 },
      x10: { quantity: 10, price: 15000 },
    },
    chocolate: {
      x6: { quantity: 6, price: 13000 },
      x10: { quantity: 10, price: 18000 },
    },
  },
  untables: {
    'mermelada de fresa': { weight: 230, price: 18000 },
    'cebolla caramelizada': { price: 18500 },
  },
  congelados: {
    'pan de bono': {
      x6: { quantity: 6, price: 15000 },
      x12: { quantity: 12, price: 28000 },
    },
    'deditos olaya': {
      x16: { quantity: 16, price: 18500 },
    },
  },
  'panaderia tradicional': {
    'pan de molde': { price: 14000 },
    'focaccia': { price: 18000 },
  },
  'cafe el diario': {
    'beatriz': {
      weight: 340,
      price: 34500,
      description: 'Resalta los dulces como el caramelo y la panela del perfil de nuestro café de la Sierra Nevada',
      intensity: 'ALTA',
      variations: [
        { name: 'entero', value: 1 },
        { name: 'grueso', value: 1 },
        { name: 'semigrueso', value: 2 },
        { name: 'medio alto', value: 3 },
        { name: 'medio bajo', value: 4 },
        { name: 'semifino', value: 5 },
        { name: 'fino', value: 6 },
      ],
    },
    'margarita': {
      weight: 340,
      price: 34500,
      description: 'Resalta los tonos frutales del perfil. En esta tostión somos capaces de percibir la naranja y el limoncillo',
      intensity: 'MEDIA',
      variations: [
        { name: 'entero', value: 1 },
        { name: 'grueso', value: 1 },
        { name: 'semigrueso', value: 2 },
        { name: 'medio alto', value: 3 },
        { name: 'medio bajo', value: 4 },
        { name: 'semifino', value: 5 },
        { name: 'fino', value: 6 },
      ],
    },
    'cold brew': {
      x1: { volume: 250, price: 6000 },
      x4: { volume: 1000, price: 20000, note: 'IVA incluido' },
    },
  },
};

function generateProducts() {
  const products = [];

  // 1. Generate masa madre products (sourdough, baguette, tortillas)
  ['sourdough', 'baguette', 'tortillas'].forEach(collection => {
    const availableFlavors = Object.keys(PRICES[collection]);

    availableFlavors.forEach(flavor => {
      const variations = [];
      const flavorPrices = PRICES[collection][flavor];

      Object.entries(flavorPrices).forEach(([size, details]) => {
        variations.push({
          name: size,
          value: details.weight || details.quantity,
          basePrice: details.price,
        });
      });

      products.push({
        name: flavor,
        collectionName: collection,
        variations,
        isActive: true,
      });
    });
  });

  // 2. Generate simple products (untables, panaderia tradicional)
  ['untables', 'panaderia tradicional'].forEach(collection => {
    Object.entries(PRICES[collection]).forEach(([productName, details]) => {
      products.push({
        name: productName,
        collectionName: collection,
        basePrice: details.price,
        currentPrice: details.price,
        weight: details.weight,
        isActive: true,
      });
    });
  });

  // 3. Generate congelados products
  Object.entries(PRICES.congelados).forEach(([productName, variations]) => {
    const productVariations = Object.entries(variations).map(([size, details]) => ({
      name: size,
      value: details.quantity,
      basePrice: details.price,
    }));

    products.push({
      name: productName,
      collectionName: 'congelados',
      variations: productVariations,
      isActive: true,
    });
  });

  // 4. Generate cafe products
  Object.entries(PRICES['cafe el diario']).forEach(([productName, details]) => {
    if (productName === 'cold brew') {
      // Handle cold brew variations
      const variations = Object.entries(details).map(([size, sizeDetails]) => ({
        name: size,
        value: sizeDetails.volume,
        basePrice: sizeDetails.price,
        note: sizeDetails.note,
      }));

      products.push({
        name: productName,
        collectionName: 'cafe el diario',
        variations,
        isActive: true,
      });
    } else {
      // Handle regular coffee products with grinding variations
      const variations = details.variations.map(variation => ({
        ...variation,
        basePrice: details.price,
      }));

      products.push({
        name: productName,
        collectionName: 'cafe el diario',
        variations,
        weight: details.weight,
        description: details.description,
        intensity: details.intensity,
        isActive: true,
      });
    }
  });

  return products;
}

module.exports = generateProducts;
