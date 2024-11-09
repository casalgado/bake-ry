const recipes = [
  {
    id: 'pan-integral-especial-001',
    createdAt: new Date('2024-11-04T01:51:12.733Z'),
    updatedAt: new Date('2024-11-04T01:51:45.922Z'),
    name: 'Pan Integral Especial',
    description: 'Pan integral con semillas y especias',
    version: 1,
    ingredients: [
      {
        ingredientId: 'harina-integral-002',
        name: 'Harina Integral',
        quantity: 500,
        unit: 'g',
        costPerUnit: 14,
        notes: 'Tamizada',
      },
      {
        ingredientId: 'cardamomo-003',
        name: 'Cardamomo Molido',
        quantity: 5,
        unit: 'g',
        costPerUnit: 120,
        notes: 'Al gusto',
      },
    ],
    steps: [
      'Mezclar harina integral con cardamomo',
      'Agregar agua gradualmente mientras se amasa',
      'Dejar reposar por 1 hora',
      'Formar el pan y hornear a 180°C por 35 minutos',
    ],
    preparationTime: 75,
    bakingTime: 35,
    isActive: true,
    notes: 'Mantener la masa con 70% de hidratación',
  },
  {
    id: 'galletas-arandanos-001',
    createdAt: new Date('2024-11-04T01:51:12.733Z'),
    updatedAt: new Date('2024-11-04T01:51:45.922Z'),
    name: 'Galletas de Arándanos',
    description: 'Galletas suaves con arándanos deshidratados',
    version: 1,
    ingredients: [
      {
        ingredientId: 'harina-trigo-001',
        name: 'Harina de Trigo',
        quantity: 250,
        unit: 'g',
        costPerUnit: 12,
        notes: 'Tamizada',
      },
      {
        ingredientId: 'mantequilla-003',
        name: 'Mantequilla Sin Sal',
        quantity: 150,
        unit: 'g',
        costPerUnit: 18,
        notes: 'Temperatura ambiente',
      },
      {
        ingredientId: 'arandanos-002',
        name: 'Arándanos Deshidratados',
        quantity: 100,
        unit: 'g',
        costPerUnit: 45,
        notes: 'Picados gruesamente',
      },
      {
        ingredientId: 'vainilla-002',
        name: 'Extracto de Vainilla',
        quantity: 5,
        unit: 'ml',
        costPerUnit: 45,
        notes: 'Al gusto',
      },
    ],
    steps: [
      'Cremar mantequilla',
      'Agregar extracto de vainilla',
      'Incorporar harina gradualmente',
      'Agregar arándanos',
      'Formar galletas y hornear a 170°C por 15 minutos',
    ],
    preparationTime: 30,
    bakingTime: 15,
    isActive: true,
    notes: 'Las galletas deben quedar doradas en los bordes',
  },
  {
    id: 'pan-avena-jengibre-001',
    createdAt: new Date('2024-11-04T01:51:12.733Z'),
    updatedAt: new Date('2024-11-04T01:51:45.922Z'),
    name: 'Pan de Avena y Jengibre',
    description: 'Pan especiado con avena y jengibre',
    version: 1,
    ingredients: [
      {
        ingredientId: 'harina-avena-005',
        name: 'Harina de Avena',
        quantity: 300,
        unit: 'g',
        costPerUnit: 20,
        notes: 'Tamizada',
      },
      {
        ingredientId: 'jengibre-004',
        name: 'Jengibre Molido',
        quantity: 10,
        unit: 'g',
        costPerUnit: 85,
        notes: 'Al gusto',
      },
      {
        ingredientId: 'leche-entera-002',
        name: 'Leche Entera',
        quantity: 200,
        unit: 'ml',
        costPerUnit: 3,
        notes: 'Temperatura ambiente',
      },
    ],
    steps: [
      'Mezclar harina de avena con jengibre',
      'Agregar leche tibia gradualmente',
      'Amasar hasta obtener consistencia suave',
      'Dejar leudar por 45 minutos',
      'Hornear a 180°C por 30 minutos',
    ],
    preparationTime: 60,
    bakingTime: 30,
    isActive: true,
    notes: 'Pan especiado perfecto para el desayuno',
  },
  {
    id: 'pastel-almendra-001',
    createdAt: new Date('2024-11-04T01:51:12.733Z'),
    updatedAt: new Date('2024-11-04T01:51:45.922Z'),
    name: 'Pastel de Almendra',
    description: 'Pastel húmedo de almendra',
    version: 1,
    ingredients: [
      {
        ingredientId: 'harina-almendra-004',
        name: 'Harina de Almendra',
        quantity: 250,
        unit: 'g',
        costPerUnit: 45,
        notes: 'Tamizada',
      },
      {
        ingredientId: 'mantequilla-003',
        name: 'Mantequilla Sin Sal',
        quantity: 200,
        unit: 'g',
        costPerUnit: 18,
        notes: 'Derretida',
      },
      {
        ingredientId: 'vainilla-002',
        name: 'Extracto de Vainilla',
        quantity: 10,
        unit: 'ml',
        costPerUnit: 45,
        notes: 'Al gusto',
      },
    ],
    steps: [
      'Mezclar harina de almendra con mantequilla derretida',
      'Agregar extracto de vainilla',
      'Hornear a 160°C por 45 minutos',
    ],
    preparationTime: 20,
    bakingTime: 45,
    isActive: true,
    notes: 'Mantener en refrigeración',
  },
];

module.exports = recipes;