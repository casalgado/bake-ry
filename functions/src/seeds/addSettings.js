const settings = {
  'id': 'default',
  'updatedAt': '2024-11-09T10:54:43.737Z',

  'productCategories': [
    {
      'name': 'Café',
      'description': 'Cafe de la sierra nevada',
      'displayType': null,
      'suggestedVariations': [],
      'isActive': true,
    },
    {
      'name': 'Masa Madre',
      'description': 'Panes artesanales fermentados naturalmente',
      'displayType': 'weight',
      'suggestedVariations': [
        {
          'name': 'Mini',
          'value': 100,
          'recipeMultiplier': 0.5,
        },
        {
          'name': 'Pequeño',
          'value': 500,
          'recipeMultiplier': 1,
        },
        {
          'name': 'Mediano',
          'value': 950,
          'recipeMultiplier': 2,
        },
        {
          'name': 'Grande',
          'value': 1700,
          'recipeMultiplier': 3.5,
        },
      ],
      'isActive': true,
    },
    {
      'name': 'Productos Congelados',
      'description': 'Para hornear en casa cuando quieras',
      'displayType': 'quantity',
      'suggestedVariations': [
        {
          'name': 'Media Docena',
          'value': 6,
          'recipeMultiplier': 1,
        },
        {
          'name': 'Docena',
          'value': 12,
          'recipeMultiplier': 2,
        },
        {
          'name': 'Docena y Media',
          'value': 18,
          'recipeMultiplier': 3,
        },
      ],
      'isActive': true,
    },
  ],

  'ingredientCategories': [
    {
      'name': 'Harinas y Almidones',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Líquidos Base',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Sazonadores Básicos',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Fermentos',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Lácteos y Proteínas',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Semillas y Granos',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Frutas y Vegetales',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Especias y Aromáticos',
      'description': '',
      'isActive': true,
    },
    {
      'name': 'Chocolates y Cocoa',
      'description': '',
      'isActive': true,
    },
  ],
  'orderStatuses': [
    'Recibida',
    'En Produccion',
    'Preparada',
    'En Camino',
    'Entregada',
    'Cancelada',
  ],
  'theme': {},
};

module.exports = settings;
