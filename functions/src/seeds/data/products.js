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
      mediano: { weight: 650, price: 33000 },
    },
  },
  baguette: {
    original: {
      x5: { quantity: 5, price: 9000 },
    },
    integral: {
      x5: { quantity: 5, price: 9000 },
    },
    zaatar: {
      x5: { quantity: 5, price: 9500 },
    },
    'queso costeño': {
      x5: { quantity: 5, price: 14000 },
    },
    semillas: {
      x5: { quantity: 5, price: 15000 },
    },
    chocolate: {
      x5: { quantity: 5, price: 24000 },
    },
    'arandanos & chocolate': {
      x5: { quantity: 5, price: 26000 },
    },
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
    'mermelada de fresa': {  price: 18000 },
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
        { name: '1 grueso', value: 1 },
        { name: '2 semigrueso', value: 1 },
        { name: '3 medio alto', value: 1 },
        { name: '4 medio bajo', value: 1 },
        { name: '5 semifino', value: 1 },
        { name: '6 fino', value: 1 },
      ],
    },
    'margarita': {
      weight: 340,
      price: 34500,
      description: 'Resalta los tonos frutales del perfil. En esta tostión somos capaces de percibir la naranja y el limoncillo',
      intensity: 'MEDIA',
      variations: [
        { name: 'entero', value: 1 },
        { name: '1 grueso', value: 1 },
        { name: '2 semigrueso', value: 1 },
        { name: '3 medio alto', value: 1 },
        { name: '4 medio bajo', value: 1 },
        { name: '5 semifino', value: 1 },
        { name: '6 fino', value: 1 },
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
        // Add regular variation
        variations.push({
          name: size.toLowerCase(),
          value: details.weight || details.quantity,
          basePrice: details.price,
          currentPrice: details.price,
          isWholeGrain: false,
        });

        // Add wholegrain variation if not already integral product
        if (!['integral', 'arandanos & chocolate'].includes(flavor)) {
          variations.push({
            name: `${size.toLowerCase()} integral`,
            value: details.weight || details.quantity,
            basePrice: details.price,
            currentPrice: details.price,
            isWholeGrain: true,
          });
        }
      });

      variations.push({
        name: 'otra',
        value: 1000,
        basePrice: 10000,
        currentPrice: 10000,
        isWholeGrain: false,
      });

      products.push({
        name: flavor.toLowerCase(),
        collectionName: collection,
        variations,
        isActive: true,
        isDeleted: false,
        customAttributes: {},
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
