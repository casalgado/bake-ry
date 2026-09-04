# Inventory epic — status

## Done (Phase A, backend, bake-ry/functions)

- Warehouse dimension: stock per (item, warehouse), `buildStockDocId(itemKey, warehouseId)`. `warehouseId` required on every movement.
- Settings: `features.inventory.warehouses` (default `main`) + `orderDefault: 'produce'`. Auto-provisions, no migration.
- Transfers: `POST /stocks/:itemKey/transfer`, one transaction, shared `transferId`.
- Bajas: `POST /stocks/:itemKey/waste`, enum-only reason, separate from adjustment.
- Warehouse validation: unknown `warehouseId` rejected ("Bodega desconocida").
- Idempotency keys: `adjust`/`waste`/`transfer` accept `idempotencyKey` → becomes doc id. Backend done, **frontend still needs it (B4)**.
- New unused-yet fields: `OrderItem.fulfillmentSource/sourceWarehouseId`, `Ingredient.preferredSupplier`.
- Frontend: `ShowStock.vue` sends warehouseId on adjust. Fixed bug: `systemAdminStore` was wiping `features.inventory` on save.
- Decisions locked in (can't retag ledger later): waste reasons stored in English, enum-only; waste note is its own field, not appended to reason.
- 31 tests green.

## Done (recipe costing, backend, bake-ry/functions)

- Recipe rows are pure structure `{ type, id, combinationId, quantity, unit, notes }` — no stored cost, no denormalized name.
- Cost is a live compute (`recipeGraph.computeRecipeCost`); the owner cache (`product.costPrice` / combination `costPrice` / `ingredient.costPerUnit`) is the only stored cost, refreshed by one propagation walk entered from recipe save or ingredient-cost edit.
- Every owner-cache move is recorded in that doc's `updateHistory` (shared `recordHistory`, optional `reason` tag).
- `GET /ingredients/:id/cost-impact?newCost=X` — read-only preview of a cost change's fan-out.
- `POST /recipes/reconcile-costs` (admin) — recompute-and-correct one owner, for `usedInRecipes` drift.
- Full reference: `docs/recipe-costing.md`.

Docs: `inventory-next-steps.md` A1–A8 checked (front repo).

## Next (Phase B — frontend only, backend exists)

**Before any code:** settle recipe-per-combination vs copy-and-scale (my idea vs documented decision, IMPLEMENTATION §2/§11.3). Decides B3's shape.

- B1 — ProductForm mode selector (Sin control / Compro y vendo / Lo produzco). None-products never show inventory UI.
- B2 — IngredientForm: optional recipe + mandatory yield for non-resale ingredients, pass-through/stocked toggle, preferredSupplier.
- B3 — Recipe Manager rewrite (ShowRecipes.vue): directory, keyboard-first editor, live cost/margin, typed components, inline ingredient creation, coverage matrix.
- B4 — **MUST NOT SKIP**: idempotency keys on stock mutation forms. Generate key on form *open* (not submit), `crypto.randomUUID()` minus dashes, send as `idempotencyKey`. Without it, a retry on a flaky connection double-moves stock permanently (ledger is append-only).

Nothing in B is blocked.

**Later (not now):** cost-impact dry-run preview for recipe quantity edits ("if I set this to 100g, here's what happens to torta's price before I save"). Same underlying walk as the ingredient-price preview (`GET /ingredients/:id/cost-impact`, already built), different trigger. Natural fit for B3's editor once it exists.

## Kickoff prompt (Phase B)

> Phase B of `zplanning/inventory-next-steps.md`, frontend only, backend already exists. Don't touch backend — flag missing endpoints instead of improvising.
> Read first: `inventory-next-steps.md` (Phase B), `inventory-ux-plan.md`, `strategy/INVENTORY-IMPLEMENTATION.md` §2–§5, §11.
> Before B3: discuss recipe-per-combination vs the documented copy-and-scale decision (§2, §11.3 — rejected base-recipe-with-multiplier because icing doesn't scale with sponge). Be critical of the existing decision. B1/B2 can start first.
