// Only what data/recipes.js uses. Category ids match seeds/data/settings.js.
//
// `stockBehavior` defaults to `stocked` (bought and held, deduction stops
// there). `passThrough` holds no stock: deduction goes through to the
// ingredient's own recipe, or deducts nothing when it has none (Agua).
//
// Masa Madre and Masa Base are preparaciones: they are created here without a
// recipe, and seedRecipes attaches theirs. Resale items (cold brew) are
// products with inventoryMode 'unit', in data/products.js — not ingredients.
const ingredients = [
  {
    name: 'Harina de Trigo',
    categoryId: 'harinas-y-almidones',
    categoryName: 'Harinas y Almidones',
    unit: 'g',
    costPerUnit: 5,
    storageTemp: 'Ambiente',
  },
  {
    name: 'Harina Integral',
    categoryId: 'harinas-y-almidones',
    categoryName: 'Harinas y Almidones',
    unit: 'g',
    costPerUnit: 8,
    storageTemp: 'Ambiente',
  },
  {
    name: 'Agua',
    categoryId: 'liquidos-base',
    categoryName: 'Líquidos Base',
    unit: 'ml',
    costPerUnit: 0.01,
    storageTemp: 'Ambiente',
    stockBehavior: 'passThrough',
  },
  {
    name: 'Aceite de Oliva',
    categoryId: 'liquidos-base',
    categoryName: 'Líquidos Base',
    unit: 'ml',
    costPerUnit: 30,
    storageTemp: 'Ambiente',
  },
  {
    name: 'Sal',
    categoryId: 'sazonadores-basicos',
    categoryName: 'Sazonadores Básicos',
    unit: 'g',
    costPerUnit: 2,
    storageTemp: 'Ambiente',
  },
  {
    name: 'Levadura Fresca',
    categoryId: 'fermentos',
    categoryName: 'Fermentos',
    unit: 'g',
    costPerUnit: 22,
    storageTemp: 'Refrigeracion',
  },
  {
    name: 'Masa Madre',
    categoryId: 'fermentos',
    categoryName: 'Fermentos',
    unit: 'g',
    costPerUnit: 0,
    storageTemp: 'Refrigeracion',
    stockBehavior: 'passThrough',
  },
  {
    name: 'Masa Base',
    categoryId: 'fermentos',
    categoryName: 'Fermentos',
    unit: 'g',
    costPerUnit: 0,
    storageTemp: 'Refrigeracion',
  },
];

module.exports = ingredients;
