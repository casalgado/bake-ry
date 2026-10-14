# Request performance handoff

Source: analysis of 32 requests in `src/middleware/request_logs/` from an emulator session on 2026-10-14 (create bakery, log in, dashboard load, edit settings on two bakeries). Nothing below is implemented yet.

Auth and `hasBakeryAccess` are cheap (token check only, no DB read). The cost is in what the frontend asks for and how settings are patched.

## Observed

| Request | Count / size | Note |
|---|---|---|
| `GET /bakeries/:id/settings/default` | 12 of 32 | 3 within 2 s on one page load; mostly 304 |
| `GET /system-settings` | 3 x 5 KB | only a system admin can change it |
| `GET /bakeries?includeDeleted=true` | 3 | system-admin list, refetched on navigation |
| `PATCH settings/default` | 2, 5-8 KB response | followed ~100 ms later by a GET of the same doc |
| `GET orders?per_page=5000&date_field=preparationDate...` | 1 | one-day range, fine today |
| `GET settings/default/staff` and `/b2b_clients` | on every load | needed only on some screens |
| `POST /bakeries` | 2245 ms | includes user creation and seeding |

A 304 saves bandwidth, not reads: Express computes the ETag after the handler runs, so Firestore is still read.

## Backend items (this repo)

### B1. Settings patch reads the document twice and merges outside the transaction (do first)
- `src/services/bakerySettingsService.js:41-81` reads `default` (line 44), merges `features`/`branding`/`subscription`, then calls `baseService.patch`.
- `src/services/base/serviceFactory.js:444-478` reads the same doc again inside `runTransaction`.
- Race: two concurrent patches each merge against stale data and the later write wins.
- Fix: do the merge inside the transaction. Options: an optional `prepare(currentData, data)` hook in `serviceFactory.patch`, or a settings-specific transaction. Keep the `enabledAt` preservation and `updateProductCategories` logic in that hook.

### B2. Redact secrets in the dev request logger (small)
- `src/middleware/requestLogger.js`: the saved `POST /bakeries` log holds `user.password` in plaintext. Redact `password` (and card fields) in `req.body` before writing the file and before the console dump.

### B3. Optional: short in-memory TTL cache for `settings/default`
- Only if the frontend store (F1) is not done. Invalidate on patch. Skip if F1 ships.

### B4. Later
- Cap orders `per_page` (e.g. 200-500) and paginate in the client.
- `request_logs` already resets on `npm run serve`; no further work.

## Frontend items (separate repo)

- **F1.** Load `settings/default` once into a store and reuse it instead of refetching per page/navigation. Biggest win (~12 requests down to ~1-2 per session).
- **F2.** After `PATCH settings/default`, use the response (it is the full updated document) and drop the follow-up GET.
- **F3.** Cache `/system-settings` for the session; refetch only after the admin edits it.
- **F4.** Load the system-admin bakery list once; refresh only after create/edit.
- **F5.** PATCH only changed keys instead of the whole `features` tree (~1.5 KB of unchanged data per call). Also removes the overwrite window for concurrent edits.
- **F6.** Fetch `staff` and `b2b_clients` lazily, on the screens that use them.

## Suggested order
F1, F2, F3 (about 60-70% fewer requests), then B1 + B2, then F4-F6, then B4.

## Verification
- Run `npm run serve`, repeat the same session (login, dashboard, edit settings, switch bakery), and compare file counts in `src/middleware/request_logs/` (target: `settings_default` GETs 12 -> 1-2, no GET right after a PATCH).
- B1: patch settings twice in parallel with different `features` keys; both changes must persist. Ask before running any tests.
