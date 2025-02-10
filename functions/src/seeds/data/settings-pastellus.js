const { BAKERY_ID } = require('../seedConfig-pastellus');
const settings = {
  'id': 'default',
  'bakeryId': BAKERY_ID,

  'ingredientCategories': [
    {
      'name': 'Harinas y Almidones',
      'description': '',
      'id': 'harinas-y-almidones',
      'isActive': true,
    },
    {
      'name': 'Líquidos Base',
      'description': '',
      'id': 'liquidos-base',
      'isActive': true,
    },
    {
      'name': 'Sazonadores Básicos',
      'description': '',
      'id': 'sazonadores-basicos',
      'isActive': true,
    },
    {
      'name': 'Fermentos',
      'description': '',
      'id': 'fermentos',
      'isActive': true,
    },
    {
      'name': 'Lácteos y Proteínas',
      'description': '',
      'id': 'lacteos-y-proteinas',
      'isActive': true,
    },
    {
      'name': 'Semillas y Granos',
      'description': '',
      'id': 'semillas-y-granos',
      'isActive': true,
    },
    {
      'name': 'Frutas y Vegetales',
      'description': '',
      'id': 'frutas-y-vegetales',
      'isActive': true,
    },
    {
      'name': 'Especias y Aromáticos',
      'description': '',
      'id': 'especias-y-aromaticos',
      'isActive': true,
    },
    {
      'name': 'Chocolates y Cocoa',
      'description': '',
      'id': 'chocolates-y-cocoa',
      'isActive': true,
    },
  ],
  'orderStatuses': [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Completada',
  ],
  'theme': {},
  'suggestedProductVariations': {
    WEIGHT: {
      label: 'Weight',
      unit: 'g',
      defaults: [
        { name: 'cuarto', value: 550, basePrice: 16000, recipeId: '' },
        { name: 'media', value: 950, basePrice: 25000, recipeId: '' },
        { name: 'libra', value: 1700, basePrice: 34000, recipeId: '' },
      ],
    },
    QUANTITY: {
      label: 'Quantity',
      prefix: 'x',
      defaults: [
        { name: 'x4', value: 1, basePrice: 9000, recipeId: '' },
        { name: 'x5', value: 5, basePrice: 9000, recipeId: '' },
        { name: 'x6', value: 6, basePrice: 15000, recipeId: '' },
        { name: 'x8', value: 8, basePrice: 18000, recipeId: '' },
        { name: 'x10', value: 10, basePrice: 12000, recipeId: '' },
        { name: 'x12', value: 12, basePrice: 18000, recipeId: '' },
        { name: 'x16', value: 16, basePrice: 20000, recipeId: '' },
      ],
    },
  },
  'features': {
    'order': {
      timeOfDay: true,
      allowPartialPayment: true,
    },
  },
};

module.exports = settings;
