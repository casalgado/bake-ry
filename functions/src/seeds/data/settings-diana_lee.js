const { BAKERY_ID } = require('../seedConfig-diana_lee');
const settings = {
  'id': 'default',
  'bakeryId': BAKERY_ID,

  'orderStatuses': [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Completada',
  ],
  'theme': {},
  'suggestedProductVariations': {
    SIZE: {
      label: 'Weight',
      unit: 'g',
      defaults: [
        { name: 'tiny', value: 2, basePrice: 34000, recipeId: '' },
        { name: 'medio', value: 6, basePrice: 15000, recipeId: '' },
        { name: 'completo', value: 12, basePrice: 230000, recipeId: '' },
      ],
    },
    QUANTITY: {
      label: 'Quantity',
      prefix: 'x',
      defaults: [
        { name: 'x4', value: 4, basePrice: 70000, recipeId: '' },
        { name: 'x6', value: 6, basePrice: 99000, recipeId: '' },
        { name: 'x8', value: 8, basePrice: 136000, recipeId: '' },
        { name: 'x12', value: 12, basePrice: 192000, recipeId: '' },

      ],
    },
  },
  'features': {
    'order': {
      timeOfDay: true,
      allowPartialPayment: false,
      defaultDate: 'delivery',
    },
  },
};

module.exports = settings;
