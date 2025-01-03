const ingredients = [
  {
    id: 'cafe-beatriz-001',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Cafe Beatriz',
    description: 'Cafe',
    categoryName: 'Café',
    categoryId: 'cafe',
    usedInRecipes: [], // Will be populated based on recipes
    isResaleProduct: false,
    costPerUnit: 14,
    currency: 'COP',
    currentStock: 25,
    unit: 'unidades',
    suppliers: [
      {
        name: 'Molinos del Norte',
        contact: '3155484849',
        address: 'Calle 123 #45-67',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'harina-integral-002',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Harina Integral',
    description: 'Harina de trigo integral rica en fibra',
    categoryName: 'Harinas y Almidones',
    categoryId: 'harinas-y-almidones',
    usedInRecipes: [], // Will be populated based on recipes
    isResaleProduct: false,
    costPerUnit: 14,
    currency: 'COP',
    currentStock: 25,
    unit: 'g',
    suppliers: [
      {
        name: 'Molinos del Norte',
        contact: '3155484849',
        address: 'Calle 123 #45-67',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'harina-centeno-003',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Harina de Centeno',
    description: 'Harina de centeno para panes especiales',
    categoryName: 'Harinas y Almidones',
    categoryId: 'harinas-y-almidones',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 16,
    currency: 'COP',
    currentStock: 15,
    unit: 'g',
    suppliers: [
      {
        name: 'Granos Premium',
        contact: '3155484850',
        address: 'Av Principal #78-90',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },

  // Lácteos y Proteínas
  {
    id: 'leche-entera-002',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Leche Entera',
    description: 'Leche entera pasteurizada',
    categoryName: 'Lácteos y Proteínas',
    categoryId: 'lacteos-y-proteinas',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 3,
    currency: 'COP',
    currentStock: 50,
    unit: 'ml',
    suppliers: [
      {
        name: 'Lácteos del Valle',
        contact: '3155484851',
        address: 'Carrera 34 #56-78',
      },
    ],
    storageTemp: 'Refrigeracion',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'mantequilla-003',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Mantequilla Sin Sal',
    description: 'Mantequilla sin sal para repostería',
    categoryName: 'Lácteos y Proteínas',
    categoryId: 'lacteos-y-proteinas',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 18,
    currency: 'COP',
    currentStock: 20,
    unit: 'g',
    suppliers: [
      {
        name: 'Lácteos Premium',
        contact: '3155484852',
        address: 'Calle 90 #12-34',
      },
    ],
    storageTemp: 'Refrigeracion',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },

  // Especias y Aromáticos
  {
    id: 'vainilla-002',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Extracto de Vainilla',
    description: 'Extracto natural de vainilla',
    categoryName: 'Especias y Aromáticos',
    categoryId: 'especias-y-aromaticos',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 45,
    currency: 'COP',
    currentStock: 10,
    unit: 'ml',
    suppliers: [
      {
        name: 'Esencias del Mundo',
        contact: '3155484853',
        address: 'Av Central #45-67',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'cardamomo-003',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Cardamomo Molido',
    description: 'Cardamomo molido para especiados',
    categoryName: 'Especias y Aromáticos',
    categoryId: 'especias-y-aromaticos',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 120,
    currency: 'COP',
    currentStock: 5,
    unit: 'g',
    suppliers: [
      {
        name: 'Especias Orientales',
        contact: '3155484854',
        address: 'Calle 67 #89-12',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },

  // Frutas y Vegetales
  {
    id: 'arandanos-002',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Arándanos Deshidratados',
    description: 'Arándanos deshidratados sin azúcar',
    categoryName: 'Frutas y Vegetales',
    categoryId: 'frutas-y-vegetales',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 45,
    currency: 'COP',
    currentStock: 15,
    unit: 'g',
    suppliers: [
      {
        name: 'Frutos Secos del Valle',
        contact: '3155484855',
        address: 'Carrera 78 #90-12',
      },
    ],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  // More Harinas y Almidones
  {
    id: 'harina-almendra-004',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Harina de Almendra',
    description: 'Harina de almendra finamente molida',
    categoryName: 'Harinas y Almidones',
    categoryId: 'harinas-y-almidones',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 45,
    currency: 'COP',
    currentStock: 10,
    unit: 'g',
    suppliers: [{
      name: 'Frutos Secos Premium',
      contact: '3155484856',
      address: 'Calle 45 #12-34',
    }],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'harina-avena-005',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Harina de Avena',
    description: 'Avena molida fina',
    categoryName: 'Harinas y Almidones',
    categoryId: 'harinas-y-almidones',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 20,
    currency: 'COP',
    currentStock: 15,
    unit: 'g',
    suppliers: [{
      name: 'Cereales del Valle',
      contact: '3155484857',
      address: 'Av 23 #45-67',
    }],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },

  // More Lácteos y Proteínas
  {
    id: 'crema-leche-004',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Crema de Leche',
    description: 'Crema de leche 35% grasa',
    categoryName: 'Lácteos y Proteínas',
    categoryId: 'lacteos-y-proteinas',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 12,
    currency: 'COP',
    currentStock: 20,
    unit: 'ml',
    suppliers: [{
      name: 'Lácteos Premium',
      contact: '3155484858',
      address: 'Cra 67 #89-12',
    }],
    storageTemp: 'Refrigeracion',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
  {
    id: 'queso-crema-005',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Queso Crema',
    description: 'Queso crema para repostería',
    categoryName: 'Lácteos y Proteínas',
    categoryId: 'lacteos-y-proteinas',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 25,
    currency: 'COP',
    currentStock: 15,
    unit: 'g',
    suppliers: [{
      name: 'Lácteos Premium',
      contact: '3155484858',
      address: 'Cra 67 #89-12',
    }],
    storageTemp: 'Refrigeracion',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },

  // More Especias y Aromáticos
  {
    id: 'jengibre-004',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
    name: 'Jengibre Molido',
    description: 'Jengibre en polvo',
    categoryName: 'Especias y Aromáticos',
    categoryId: 'especias-y-aromaticos',
    usedInRecipes: [],
    isResaleProduct: false,
    costPerUnit: 85,
    currency: 'COP',
    currentStock: 5,
    unit: 'g',
    suppliers: [{
      name: 'Especias Orientales',
      contact: '3155484859',
      address: 'Calle 78 #90-12',
    }],
    storageTemp: 'Ambiente',
    isActive: true,
    isDiscontinued: false,
    customAttributes: {},
  },
];

module.exports = ingredients;
