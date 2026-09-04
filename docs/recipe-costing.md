# Recipe costing

How a recipe's cost is computed, cached, and kept honest. Backend:
`bake-ry/functions`.

## Storage shape

`bakeries/{bakeryId}/recipes/{id}` — one doc per recipe. `ingredients[]` holds
`RecipeComponent` rows (the field is named `ingredients` but a row can be an
ingredient *or* another product):

```
{ type, id, combinationId, quantity, unit, notes }
```

A row is pure structure — how much of an ingredient or product this recipe
uses. It carries no cost and no denormalized name; nothing in it has to be kept
in sync with anything else.

A recipe has **exactly one owner**, one of three shapes:

| Owner | Fields on the recipe | Cached cost lives on |
| --- | --- | --- |
| Product, no variations | `productId` | `product.costPrice` |
| A sellable combination | `productId` + `combinationId` | `product.variations.combinations[i].costPrice` |
| A manufactured ingredient | `ingredientId` + `yield` | `ingredient.costPerUnit` |

A recipe with no owner yet is legal — the editor creates the recipe first and
links it from the product/ingredient afterwards, in the same transaction
(`planOwnerLink`).

## Cost is computed, never stored on the recipe

`recipeGraph.computeRecipeCost(transaction, bakeryId, components, plan)` is the
single place the question "what does this recipe cost right now" is answered.
For each component it reads the component's own source doc
(`ingredient.costPerUnit`, or `product.costPrice` / `combination.costPrice`) and
sums `quantity × cost`.

It is not recursive: a recipe's component list is flat. Nesting (a recipe uses a
product that has its own recipe, or a manufactured ingredient that has one) is
handled by the propagation walk below, which calls `computeRecipeCost` once per
level.

## The owner cache

The owner's cached cost (`product.costPrice`, a combination's `costPrice`, an
ingredient's `costPerUnit`) is the **only** stored cost value.

It exists because order creation, the POS screen, and reports read a product's
cost constantly, and Firestore has no joins. A product's cost can depend on a
nested chain of recipes, so recomputing it live on every read would mean a
recursive read fan-out on the hottest screens in the app. The final number is
cached on the owner; the propagation walk keeps that cache honest.

`costPriceSource` on the owner is `'recipe'` or `'manual'`. Propagation only
ever writes a cache whose source is `'recipe'` — a manually typed cost is never
silently overwritten.

Costs are compared with a cent-level epsilon (`sameCost`) so float noise never
triggers a cascade of pointless writes.

## The propagation walk

One walk, entered from two places (`recipeGraph.js`):

- **A recipe is created, or its quantities change** (`recipeService.create` /
  `update`) → recompute that recipe's cost → push to its owner. If the owner is
  a manufactured ingredient, that ingredient's cost just changed too — continue
  outward to *its* consumers.
- **An ingredient's cost changes directly** (`ingredientService.update`) → for
  every recipe that uses it (via the `usedInRecipes` reverse-index) → recompute
  that recipe's cost → push to its owner → continue outward.

`planRecipeCostPropagation` and `planIngredientCostPropagation` call each other,
one hop at a time.

### The plan object

`createPlan()` returns `{ visited, writesByPath, costOverrides, history }`,
threaded through the whole walk:

- **`writesByPath`** — planned owner-doc writes, keyed by path so one run that
  reaches the same document twice (a product with two recipe-costed
  combinations) merges instead of clobbering. `stage()` / `stagedData()` are the
  merge primitives.
- **`costOverrides`** — `nodeKey → the node's recomputed cost`.
  `computeRecipeCost` reads this before hitting Firestore, so a value changed
  earlier in the walk — and not yet committed — is seen by everything
  downstream. (Within one transaction, `transaction.get` still returns the
  pre-write value, so the override is how the new number propagates.)
- **`history`** — one entry per owner whose cached cost actually moved.

Everything is *planned* during the reads phase; `applyPlan(transaction, plan,
{ editor, reason })` does every write at the end, keeping the transaction's
reads-before-writes rule.

### Guardrails

`assertGraphIsSane` runs before the save transaction (it reads an unbounded
number of docs). It rejects a recipe whose component graph contains a cycle or
nests deeper than `MAX_DEPTH` (5). Because it refuses to save anything deeper,
the `MAX_DEPTH` check inside the walk is a belt-and-braces backstop, not a limit
a valid graph reaches during propagation.

### A known limit

A recipe fed by two ingredients that *both* move in one walk is re-costed only
on its first reach (the `visited` guard), so the second mover isn't reflected
until the next cost change or a reconciliation run. This is a diamond in the
cost graph — rare enough at bakery scale that widening the walk isn't worth it.
`reconcileOwnerCost` is the backstop.

## History

Every owner-cache move the walk makes is recorded in that document's
`updateHistory` subcollection (the same mechanism and shape as every other model
edit — `services/base/recordHistory.js`). The record carries the old value, the
new value, the editor, and a timestamp; an optional `reason` field tags
non-ordinary changes (`'reconciliation'`).

`recipeService.update` and `ingredientService.update` run their own transactions
(for the graph reads) instead of going through `baseService.update`, so they
write the edited doc's own `updateHistory` entry directly, via the same shared
function.

## Dry-run preview

`GET /bakeries/:bakeryId/ingredients/:id/cost-impact?newCost=X` runs the
propagation walk inside a transaction and returns the planned owner-cost moves
(`{ path, changes }[]`) **without** applying them —
`recipeGraph.previewIngredientCostImpact`.

The same preview for recipe *quantity* edits ("if I set this to 100g, here's
what happens to torta's price before I save") is not built yet — same walk,
different trigger, a natural fit for the Recipe Manager editor once it exists.
Tracked in `bake-td.md`.

## Reconciliation

The `usedInRecipes` reverse-index is denormalized. If it ever drifts from what a
recipe's `ingredients[]` actually contains, propagation silently stops finding
that recipe, and the owner cache goes quietly wrong with nothing to signal it.

`recipeGraph.reconcileOwnerCost(bakeryId, owner)` — where `owner` is
`{ type: 'product' | 'ingredient', id, combinationId? }` — recomputes that
owner's recipe cost live via `computeRecipeCost`, compares it to the cached
value, and on mismatch corrects the cache and writes an `updateHistory` entry
tagged `reason: 'reconciliation'`. It targets the owner's recipe directly, so it
catches drift regardless of cause, including a broken reverse-index that normal
propagation would skip.

Exposed as `POST /bakeries/:bakeryId/recipes/reconcile-costs` (admin only),
on-demand. No scheduled job — if reconciliation ever finds real drift in
practice, that's the signal to add one, and to hunt the upstream bug.

## Design decisions

- **List views use the owner's cached total, not live per-line cost.** A recipe
  list showing live per-component cost would be an N+1 read across the whole
  list. Live per-line detail is fetched only when a single recipe is opened.
- **History reuses `updateHistory` / `recordHistory`.** It is already a
  per-document subcollection, so "cost history for this ingredient" is a direct
  read either way; a `reason` field covers the one thing the generic changelog
  didn't (tagging a reconciliation fix). One history mechanism, not two.
- **Reconciliation is on-demand only** for now (see above).
