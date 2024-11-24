const { BAKERY_ID } = require('../seedConfig');
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
};

module.exports = settings;
