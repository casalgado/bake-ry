# Tech debt

Deliberate shortcuts, tagged `ponytail:` in code. One line each, backstop noted.

- **`functions/src/services/recipeGraph.js:411`** — a recipe fed by two ingredients that both move cost in the *same* propagation walk is only re-costed on the first hit (the `visited` guard skips the second). A "diamond" in the cost graph — one ingredient's change fans out through two paths into the same downstream recipe. Silent, not a crash: that recipe's cached cost quietly reflects only one of the two moves.
  **Backstop:** `reconcileOwnerCost` — run it on the affected product/ingredient to force a fresh recompute.
  **Revisit if:** diamonds turn out to be common rather than rare at real bakery scale.

- **`functions/src/services/recipeGraph.js:364`** — a product's cost change is never carried on to the recipes that consume that product. The ingredient branch of `planRecipeCostPropagation` recurses into `planIngredientCostPropagation`; the product branch stages its write and returns. `product.usedInRecipes` is maintained by `updateComponentRelationships` but nothing reads it on this path, so a combo containing a torta keeps its stale cached cost when the torta's cost moves. Only bites products used as components of other recipes.
  **Backstop:** `reconcileOwnerCost` on the consuming product/ingredient forces a fresh recompute.
  **Revisit if:** products-inside-recipes become common — the symmetric `planProductCostPropagation` is maybe 20 lines, mirroring the ingredient one.

- **`functions/src/services/recipeGraph.js:81`** — cycle check and commit aren't atomic; a concurrent save elsewhere could sneak a cycle in between them.
  **Backstop:** `MAX_DEPTH` guard in the propagation walk bounds the damage.
  **Revisit if:** ever worth a transactional graph lock — not expected at bakery scale.
