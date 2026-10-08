// Two providers, each with the one purchase that gives the bodega its opening
// stock (seedStock sends it through purchaseService, so the stock has ledger
// history and Ingreso can prefill the provider's last basket).
//
// Ingredient lines are priced at the ingredient's current cost, so the seed
// never moves a cost. Resale lines carry their own `unitCost`. Masa Base gets
// no stock on purpose: producing it is the first thing to try.
//
// The NITs and phones are made up.
const providers = [
  {
    name: 'Molinos del Norte',
    nationalId: '900000001-1',
    phone: '3000000001',
    purchase: [
      { ingredient: 'Harina de Trigo', qty: 50000 },
      { ingredient: 'Harina Integral', qty: 10000 },
      { ingredient: 'Sal', qty: 2000 },
      { ingredient: 'Levadura Fresca', qty: 1000 },
      { ingredient: 'Aceite de Oliva', qty: 5000 },
    ],
  },
  {
    name: 'Café El Diario',
    nationalId: '900000002-2',
    phone: '3000000002',
    purchase: [{ product: ['cafe el diario', 'cold brew'], qty: 24, unitCost: 4500 }],
  },
];

module.exports = providers;
