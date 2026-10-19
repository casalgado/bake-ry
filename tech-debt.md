# Tech debt

Deliberate shortcuts, tagged `ponytail:` in code. One line each, backstop noted.

- **`functions/src/services/recipeGraph.js:411`** — a recipe fed by two ingredients that both move cost in the *same* propagation walk is only re-costed on the first hit (the `visited` guard skips the second). A "diamond" in the cost graph — one ingredient's change fans out through two paths into the same downstream recipe. Silent, not a crash: that recipe's cached cost quietly reflects only one of the two moves.
  **Backstop:** `reconcileOwnerCost` — run it on the affected product/ingredient to force a fresh recompute.
  **Revisit if:** diamonds turn out to be common rather than rare at real bakery scale.

- **`functions/src/services/recipeGraph.js:364`** — a product's cost change is never carried on to the recipes that consume that product. The ingredient branch of `planRecipeCostPropagation` recurses into `planIngredientCostPropagation`; the product branch stages its write and returns. `product.usedInRecipes` is maintained by `updateComponentRelationships` but nothing reads it on this path, so a combo containing a torta keeps its stale cached cost when the torta's cost moves. Only bites products used as components of other recipes.
  **Backstop:** `reconcileOwnerCost` on the consuming product/ingredient forces a fresh recompute.
  **Revisit if:** products-inside-recipes become common — the symmetric `planProductCostPropagation` is maybe 20 lines, mirroring the ingredient one.

- **`functions/src/services/recipeGraph.js:207`** — money is meant to be whole pesos only, but `computeRecipeCost` returns quantity × rate unrounded and it is stored as the product/combination `costPrice` (also `purchaseService.js:83` for resale products). Recipes with fractional rates or yields store costs like 1234.5678, and every new order line copies them. Nothing at the API boundary rejects a fractional amount.
  **Backstop:** the order form's line editor shows `Math.round(costPrice)`; order totals, taxes and discounts are already rounded in `models/Order.js`.
  **Revisit if:** fixing it for real, in this order: `Math.round` where amounts are derived → one-time script rounding stored `costPrice` → reject non-integer amounts with a 400. Ingredient `costPerUnit` is a rate ($/g) and stays exact.

- **Front `src/components/forms/OrderItemsManager.vue:75`** — editing a saved order, the line's "N disponibles" reads one more than Existencias (shows 10, inventory 9). `availableFor` adds the order's own saved lines back (`savedLines`, via `heldOnServer` in `OrderForm.vue`), so the number means "free for this order", not "in the bodega". The math is right and deliberate (it avoids a false shortfall on the order's own units); the label is what misleads. New orders are unaffected.
  **Backstop:** none needed for correctness; shortfall (`shortByFor`) is right either way.
  **Revisit if:** fixing the label. Options, ranked: (C) show "quedan N" = what's left after this order, matching Existencias after saving, and the shortfall becomes the same number below zero (breaks the deliberate "figure doesn't move", e2e O1); (D+A) no number on the line, only in the editor's Origen pill, showing the bodega figure; (A) show the raw server figure, keeping the giveback only for `shortByFor`. Rejected: label the giveback inline (too wordy), move it to the server (same number, still mismatched). e2e `inventory.order-form.e2e.js` ~150-189 encodes the current number.

- **`functions/src/services/recipeGraph.js:81`** — cycle check and commit aren't atomic; a concurrent save elsewhere could sneak a cycle in between them.
  **Backstop:** `MAX_DEPTH` guard in the propagation walk bounds the damage.
  **Revisit if:** ever worth a transactional graph lock — not expected at bakery scale.
