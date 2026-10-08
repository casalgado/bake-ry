// Written by name: seedRecipes resolves every name against what the earlier
// seeders created and fails if one is missing. Quantities are in the
// component's own unit (ingredients.js; products count in uds).
//
// Owner, exactly one shape:
//   { ingredient }                 a preparación (also needs `yield`, in its unit)
//   { product: [collection, name] }                  a product without variations
//   { product: [collection, name], combination }     one of its combinations
//
// Order matters: preparaciones first, so the products that use them are costed
// with their real cost, and the caja last, since it is made of other products.
const ing = (name, quantity) => ({ ingredient: name, quantity });
const prod = (collection, name, quantity, combination = null) => ({
  product: [collection, name],
  combination,
  quantity,
});

const recipes = [
  {
    owner: { ingredient: 'Masa Madre' },
    yield: 1000,
    name: 'Masa Madre',
    description: 'Fermento de harina y agua, sin stock propio',
    ingredients: [ing('Harina de Trigo', 500), ing('Agua', 500)],
  },
  {
    owner: { ingredient: 'Masa Base' },
    yield: 5000,
    name: 'Masa Base',
    description: 'Masa blanca de la que salen las baguettes y la focaccia',
    preparationTime: 30,
    ingredients: [
      ing('Harina de Trigo', 3000),
      ing('Agua', 1900),
      ing('Sal', 60),
      ing('Levadura Fresca', 40),
    ],
  },
  {
    owner: { product: ['panaderia tradicional', 'focaccia'] },
    name: 'Focaccia',
    preparationTime: 20,
    bakingTime: 25,
    ingredients: [ing('Masa Base', 800), ing('Aceite de Oliva', 60), ing('Sal', 10)],
  },
  {
    owner: { product: ['baguette', 'original'], combination: 'x5' },
    name: 'Baguette original x5',
    preparationTime: 20,
    bakingTime: 20,
    ingredients: [ing('Masa Base', 600)],
  },
  {
    owner: { product: ['baguette', 'original'], combination: 'x5 integral' },
    name: 'Baguette original x5 integral',
    preparationTime: 25,
    bakingTime: 20,
    ingredients: [
      ing('Harina Integral', 360),
      ing('Masa Madre', 120),
      ing('Agua', 220),
      ing('Sal', 7),
    ],
  },
  {
    owner: { product: ['sourdough', 'original'], combination: 'pequeño' },
    name: 'Sourdough original pequeño',
    preparationTime: 40,
    bakingTime: 35,
    ingredients: [
      ing('Masa Madre', 250),
      ing('Harina de Trigo', 300),
      ing('Agua', 190),
      ing('Sal', 8),
    ],
  },
  {
    owner: { product: ['sourdough', 'original'], combination: 'mediano' },
    name: 'Sourdough original mediano',
    preparationTime: 40,
    bakingTime: 45,
    ingredients: [
      ing('Masa Madre', 475),
      ing('Harina de Trigo', 570),
      ing('Agua', 360),
      ing('Sal', 15),
    ],
  },
  {
    owner: { product: ['panaderia tradicional', 'caja degustación'] },
    name: 'Caja degustación',
    description: 'Se arma con producto ya hecho: descuenta baguettes y focaccia, no sus insumos',
    ingredients: [
      prod('baguette', 'original', 2, 'x5'),
      prod('panaderia tradicional', 'focaccia', 1),
    ],
  },
];

module.exports = recipes;
