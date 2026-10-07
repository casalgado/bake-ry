# ACTIVE: Inbound email intake (`facturas@mentedigital.app`)

> Handoff document for the next session. Last updated: 2026-10-05.
> **Status:** Phase 1 is deployed and verified end-to-end in production. **Nothing is committed yet.** The user will review the code with a clean head and commit it themselves (next day).
> **Next session starts with:** Step 1, the Node.js upgrade (deadline 2026-10-30), then Step 2, the `storage.rules` fix, then back to inbound email. See §8.
> **Open design question:** automatic intake without manual forwarding (§11). **Revised 2026-10-06:** keep manual forward until the parsers exist, then add per-bakery aliases (one Worker, subaddressing) and ask the main suppliers to add the alias as a *second* recipient. Changing the bakery's DIAN reception email is the heavier, later option.

---

## 1. Goal

Users (bakery staff and admins) send emails to our software. The backend:
1. receives the email,
2. **identifies the user**,
3. picks a **parser** based on the email,
4. decides **what to do** with the parsed data.

The first concrete use case is **supplier e-invoices**. Staff forward the Colombian DIAN *factura electrónica* emails they receive from suppliers. These arrive as a ZIP with an `AttachedDocument` XML (UBL 2.1 `Invoice` embedded in CDATA) plus the PDF. Eventually they should feed inventory (stock `purchase` movements) and expenses.

### Phases
| Phase | Scope | Status |
|---|---|---|
| **1. Intake + sender auth** | Receive, verify sender (DKIM + Firebase Auth), log, store raw `.eml`, bounce rejects | ✅ **Deployed + verified in prod** |
| **2. Parsers** | DIAN invoice parser first | ⏸ **On hold, by user decision**: collect several real examples before defining fixtures and schemas |
| **3. Domain integration** | Invoice → stock `purchase` movements / expenses | ❌ Not designed. Needs its own design session |

---

## 2. Architecture (as built)

```
Staff forwards email → facturas@mentedigital.app
  → Cloudflare Email Routing (MX on Cloudflare)
  → Routing rule "facturas" → Email Worker "inbound-email" (pass-through)
  → POST https://bake-w6hoomxe5a-uc.a.run.app/inbound-email
        Content-Type: message/rfc822 (raw email bytes), header X-Inbound-Secret
  → backend:
     1. secret check (constant-time)                         → 401
     2. parse with postal-mime
     3. dedupe: doc id = sha256(Message-ID); if already 'received' → return stored result
        (rejected emails ARE re-evaluated, e.g. after the sender is added to the team)
     4. DKIM verify with mailauth: needs a valid signature ALIGNED with the From domain;
        exactly one From header
                                                             → rejected_unverified
     5. admin.auth().getUserByEmail(from) → custom claims {role, bakeryId}
        missing user / disabled / no bakeryId                → rejected_unknown_sender
     6. if received: upload raw .eml to Storage inbound_emails/{bakeryId}/{id}.eml
        (BEFORE the Firestore write, so a doc never points at a missing file)
     7. write Firestore inbound_emails/{id}
     → 200 { id, status, reason }
  → Worker: non-2xx → setReject("try later"); status !== 'received' → setReject(reason)
     (the sender gets an SMTP bounce with the reason)
```

---

## 3. Key decisions and why (don't re-litigate without new info)

- **A GCP service-account email can't receive mail** (no mailbox, no MX). That was the user's original idea, so we used an inbound provider instead.
- **Inbound provider: Cloudflare Email Routing + Email Worker.** Free, unlimited inbound, 25 MiB max message. Researched alternatives: Postmark ($16.50/mo, Pro plan only), Mailgun (free tier 1 route / 100 per day), SendGrid (no free plan since 2025), SES ($0.10/1k, adds AWS), Google Workspace + Gmail API (most moving parts: watch renewals, Pub/Sub, domain-wide delegation).
- **The Worker never parses.** The Workers free plan allows **10 ms of CPU** per invocation, and waiting on fetch doesn't count. It also forwards the *untouched* raw bytes, so DKIM signatures stay verifiable in the backend.
- **Sender identity = DKIM-aligned From + Firebase Auth account.** The From header alone is spoofable, and **gmail.com publishes DMARC `p=none`**, so Cloudflare delivers spoofed `@gmail.com` mail. We verify DKIM ourselves: the signature must pass AND its domain must align with the From domain.
  - **A bug was caught by the tests and fixed:** a valid signature from *another* domain (attacker.com) used to be reported as `pass`. It's now `unaligned` and rejected.
- **Auth lookup via Firebase Auth, not Firestore.** Admins live in root `users` and staff in `bakeries/{id}/users`, but all of them have Auth accounts with `role` + `bakeryId` custom claims (`src/services/bakeryUserService.js` ~L159, `adminUserService.js` ~L34). Clients have no Auth account, so they're excluded automatically.
- **Only the last hop matters.** A staff member forwarding a supplier email (even a forward of a forward) is the intended flow. We verify the forwarder, not the original supplier.
- **The Firestore log stays at root `inbound_emails/`**, not under `bakeries/`. It's an intake/audit log that includes rejected mail, which belongs to no bakery. Bakery-facing data (phase 2) will go under `bakeries/{bakeryId}/supplier_invoices/`. `firestore.rules` has no rule for `inbound_emails`, so all clients are denied by default and only the Admin SDK can read it.
- **The raw `.eml` is stored in Storage only for `received` emails**, at `inbound_emails/{bakeryId}/{id}.eml`. Reasons: parsers can reprocess later (the user wants examples first), DIAN requires 5-year retention, and a per-bakery folder makes export/deletion simple. It's deliberately **outside `bakeries/`** because of the storage.rules hole (see §8).
- **Rejected emails bounce** instead of being silently dropped, so staff know immediately.

---

## 4. Code (all uncommitted; review it, then commit)

### New files
| File | Purpose |
|---|---|
| `src/routes/inboundEmailRoutes.js` | `POST /` with `express.raw({ type: 'message/rfc822', limit: '25mb' })` |
| `src/controllers/inboundEmailController.js` | Secret check (`crypto.timingSafeEqual`; an unset secret never matches). Reads `req.rawBody` (Cloud Functions) or `req.body` (express.raw locally) |
| `src/services/inboundEmailService.js` | `verifySender` (DKIM via `mailauth/lib/dkim/verify`), `findStaffByEmail` (Auth claims), `receive(raw)` |
| `src/models/InboundEmail.js` | Extends `BaseModel`. `STATUSES = { RECEIVED, REJECTED_UNVERIFIED, REJECTED_UNKNOWN_SENDER }` |
| `src/__tests__/routes/inboundEmailRoutes.test.js` | 7 tests (see §6) |
| `../workers/inbound-email.js` (repo root, **outside** `functions/` so it isn't uploaded on deploy) | Cloudflare Email Worker, pasted manually into the dashboard |

### Modified files
| File | Change |
|---|---|
| `src/index.js` | Mounts `app.use("/inbound-email", inboundEmailRoutes)` **before** `requestLogger`, because the logger would dump up to 25 MB of raw email into the logs |
| `src/config/firebase.js` | Added `storageBucket: 'bake-ry.appspot.com'` |
| `src/__tests__/setup/firebase.js` | Same `storageBucket` for the emulator |
| `package.json` / `package-lock.json` | Added `postal-mime` (^4) and `mailauth` (^7). (`fflate` / `fast-xml-parser` were installed by accident and removed; they're phase-2 candidates) |

### Not ours: pre-existing user edits in the working tree (they were deployed along with ours)
- `../bake-td.md`
- `src/models/BakerySettings.js`, `src/models/ClientReport.js`: comment-only doc path updates

### Env / secrets
- `functions/.env` → `INBOUND_EMAIL_SECRET` (gitignored, deployed by Firebase from `.env`). **Rotated once**: the first value was saved as a plain-text Worker variable and pasted in chat. The old value is now rejected in prod (verified 401). Never print it.

---

## 5. Firestore / Storage schema (phase 1)

`inbound_emails/{sha256(messageId)}` (root collection)
```
createdAt, messageId, from, to[], subject,
attachments: [{ filename, contentType, size }],   // metadata only
rawPath: 'inbound_emails/{bakeryId}/{id}.eml' | null,
dkim: { result: 'pass'|'unaligned'|'fail'|'none'|'invalid_from'|..., domain? },
userId, bakeryId, role,                            // null when rejected
status: 'received'|'rejected_unverified'|'rejected_unknown_sender',
reason                                             // Spanish text used in the bounce
```
Storage: `gs://bake-ry.appspot.com/inbound_emails/{bakeryId}/{id}.eml` (content-type `message/rfc822`).

---

## 6. Testing

- Suite: `npx jest src/__tests__/routes/inboundEmailRoutes.test.js` (needs emulators: `npm run serve`). **7/7 passing.**
  - wrong secret → 401
  - DKIM-signed staff email → received; checks doc fields and that the stored `.eml` is downloadable
  - unsigned → `rejected_unverified` with `rawPath: null`
  - spoofed From signed by another domain → `rejected_unverified`
  - duplicated From header → `rejected_unverified`
  - verified sender without an account → `rejected_unknown_sender`
  - same Message-ID twice → one doc
- **How DKIM is tested:** real signing with a throwaway RSA key (`mailauth/lib/dkim/sign`) plus a mocked DNS resolver injected into `dkimVerify` via `jest.mock`. No crypto is mocked.
- Caveats:
  - like all suites here, `clearFirestoreData` **wipes the whole Firestore emulator** (re-seed with `npm run seed:setup`);
  - Storage files from tests are **not** cleaned up in the emulator (harmless).
- **Manual local test with a real email** (proved real Gmail DKIM works):
  ```
  curl -X POST http://127.0.0.1:5001/bake-ry/us-central1/bake/inbound-email \
    -H "Content-Type: message/rfc822" -H "X-Inbound-Secret: <from .env>" \
    --data-binary @email.eml
  ```
  The sender must exist in the **Auth emulator** with `bakeryId` claims. `contabilidadproductorash@gmail.com` was created there as `accounting_assistant` / `es-alimento-dev`. The emulator must be restarted after `.env` changes.

---

## 7. Infrastructure state (production)

- **Domain `mentedigital.app`**: bought on Cloudflare Registrar, so DNS is on Cloudflare. (NOT `mentedigital.com`: that's someone else's live domain on HostGator. The user briefly mixed them up in Firebase Hosting setup.)
  - Email Routing enabled: 3 MX records `route1/2/3.mx.cloudflare.net`, SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DKIM `cf2024-1._domainkey`.
  - DMARC: the user was advised to add `_dmarc` TXT `v=DMARC1; p=reject;` (the domain sends no mail). **Unverified whether it was added.**
  - Firebase Hosting custom domain for `mentedigital.app` was being set up. Records must be **DNS only (grey cloud)**, never proxied (it breaks Firebase SSL). Unverified whether it finished.
  - Catch-all rule: **Disabled** (on purpose: mail to other addresses bounces).
- **Worker `inbound-email`**: created via dashboard ("Create application" → Hello World → Edit code → pasted). Vars: `INBOUND_URL` (plain variable) = `https://bake-w6hoomxe5a-uc.a.run.app/inbound-email`; `INBOUND_EMAIL_SECRET` (**Secret**, encrypted). Workers Logs enabled (Observability tab). Suggested (optional, unverified): disable its public `*.workers.dev` URL. Ignore the Wrangler "update your configuration" banner: we don't use Wrangler.
- **Routing rule**: `facturas@mentedigital.app` → Send to a Worker → `inbound-email`. Active.
- **Cloud Function** `bake` (us-central1, Node 20, 2nd gen) deployed 3× on 2026-10-05; the latest includes Storage + the rotated secret.
- **Verified in prod (2026-10-05 22:09 UTC):** a forward from `dev@carsalhaz.com` → `status: received`, `dkim: pass (carsalhaz.com)`, `bakeryId: es-alimento`, `.eml` 63 KB in Storage. **This confirms DKIM survives Cloudflare's hand-off.**
- Production senders checked:
  - `dev@carsalhaz.com` = system_admin, bakeryId `es-alimento` ✅
  - `es.alimento@gmail.com` = bakery_admin `es-alimento` ✅
  - `contabilidadproductorash@gmail.com` = **not a prod user** (would bounce until created as staff)

---

## 8. Next steps (order set by the user)

**Before step 1:** the user reviews this feature's code and commits it themselves, with a fresh head. Don't commit on your own. Suggested split: the inbound email feature vs. the user's unrelated edits (`bake-td.md`, the comment-only model edits). That way the Node upgrade starts from a clean tree and gets its own commit.

1. **STEP 1, ⚠ URGENT: upgrade Node.js.** The Node 20 runtime is decommissioned on **2026-10-30**; after that, deploys of this project fail.
   - Scope: `engines.node` in `package.json` and `runtime` in `../firebase.json` → Node 22, plus `firebase-functions` → latest. The deploy warns it's outdated, and the upgrade has **breaking changes**.
   - It's a task of its own: explain the plan first, get approval, run the full test suite (ask first), and deploy only on an explicit yes.
2. **STEP 2, security: fix `storage.rules`.** They currently allow ANY authenticated user to read/write `bakeries/{anyBakeryId}/**`, which is cross-tenant access.
   - It should require `request.auth.token.bakeryId == bakeryId` (plus `system_admin`).
   - Check what the frontend uploads there first (the `storage-resize-images` extension is installed, so product images likely live there), so the fix doesn't break uploads or public image reads.
   - Note: the `firestore.rules` helper `isBakeryAdmin` checks `role == 'admin'`, but the real role is `bakery_admin`. Worth reviewing in the same pass.
3. **Then continue with the inbound email work.** Collecting examples and building parsers use manual forward (A). The alias path (§11, B2) comes after the parsers: it's a small Worker + backend change and doesn't affect parser design.
4. **Collect real invoice emails** via `facturas@` (staff must be prod Auth users with a `bakeryId` claim; e.g. create `contabilidadproductorash@gmail.com` as `accounting_assistant`).
5. **Phase 2, parsers** (once there are enough examples):
   - Reprocess the stored `.eml`s from Storage.
   - Observation: the subjects of both examples look like the **DIAN-mandated format** `NIT; supplier name; doc number; doc type code (01 = invoice); supplier name`. They may give the NIT and number before unzipping.
   - Emails can be nested forwards (`Fwd: Fwd:`).
   - Likely deps: `fflate` (unzip) and `fast-xml-parser`.
   - Planned (not built) design: a `PARSERS = [{ match, parse }]` list in the service, with no registry class. Output goes to `bakeries/{bakeryId}/supplier_invoices/{CUFE}` with status `pending_review`, and the **buyer NIT on the invoice must equal `Bakery.nationalId`** (normalized digits, without the check digit) as a second anti-spoofing check.
   - Credit notes (CreditNote XML) are out of scope at first.
6. **Phase 3, integration design.**
   - Expenses: `expenseController.js` / `expenseRoutes.js` are **empty files**, and there's no Expense model.
   - Inventory: the stock ledger (`bakeries/{id}/stocks`, `stockMovements`) already has a `purchase` movement type (`src/services/stockService.js`).
   - `Ingredient.preferredSupplier` is free text ("suppliers belong to the balance-sheet epic"), and there's no Supplier entity.
   - The inventory spec is `zplanning/inventory/INVENTORY-IMPLEMENTATION.md` in the **bake-ry-front** repo; read it first.
   - The hard part is mapping supplier line items ("HARINA TRIGO BULTO X 50KG") to ingredients, with unit conversion.
7. Minor / optional:
   - DMARC for `carsalhaz.com` (it has none; Google Workspace mail).
   - Clean up Storage in the test.
   - A TTL or cleanup for rejected `inbound_emails` docs if spam grows (`ponytail`-style: add it when it's needed).

## 9. Example emails (kept OUT of git on purpose: they contain real supplier data)
- `C:\Users\casal\Downloads\63346951_SONIA DELGADO DELGADO_POSE10373_01_SONIA DELGADO.eml`: a Gmail forward from `contabilidadproductorash@gmail.com`, ZIP `z00633469510082600002885.zip` (60 KB)
- Production: `inbound_emails/es-alimento/a71503ab….eml`: Jerónimo Martins Colombia (Ara), ZIP `fv0900480569Q76A073566.zip`

## 10. Working agreements with this user (important)
- **Explain concepts and agree on a plan before** installing deps, writing code, or touching infra. Finish the step the user is on before moving to the next.
- **Ask before running tests.**
- **Never deploy without an explicit "yes"**, even if the user asks "can we deploy?". List what will ship (including uncommitted non-feature changes) and wait. (A deploy was once done without confirmation, and the user was rightly upset.)
- **Don't commit**: the user commits after their own review.
- Vue conventions (frontend): `<script setup>` first, then template, then `<style scoped>`.
- The user prefers simple, minimal solutions, with critical senior-dev pushback. They pushed back on an over-complicated proposal (§11) and asked for better, more recent research. Lead with the simplest option that works.

---

## 11. OPEN DESIGN QUESTION: automatic intake (no manual forward)

### The ask (user, 2026-10-06)
"Can Gmail auto-forward invoices to our app as soon as they arrive?" Staff shouldn't have to forward each invoice by hand.

### Why the current build doesn't support it
Phase 1 identifies the bakery by **who sent the email**: a DKIM-aligned `From:` that is a Firebase Auth staff user.
- **Manual forward** (tested and working): Gmail creates a *new* message `From: staff@…`, signed by the staff member's domain, so it's accepted.
- **Gmail filter auto-forward**: Gmail re-sends the *original* message, so `From:` stays the **supplier** (e.g. `facturacion@supplier.com`) with the supplier's DKIM. Phase 1 would return `rejected_unknown_sender` and bounce it. *(Not yet verified with a real sample; see "Experiment" below.)*
- **Gmail's forwarding-address confirmation:** before allowing auto-forward, Gmail sends a confirmation code **to the destination** (`facturas@`). That email comes from Google, gets rejected as an unknown sender, and the user never sees the code.

### Options researched
| # | Option | Verdict |
|---|---|---|
| A | **Manual forward** (what's built) | **✅ Keep as v1 and forever as the one-off path.** Works today, zero setup, and the human acts as a free spam filter. Costs one forward per invoice |
| **B2** | **Per-bakery alias given to suppliers as a *second* recipient** (`facturas+es-alimento@mentedigital.app`). Most Colombian invoicing software accepts several emails per customer (`;`-separated); verify per supplier | **⭐ Recommended next step** (after parsers). The bakery keeps its own copy, DIAN registration is untouched, acknowledgement events are unaffected. A handful of top suppliers likely covers most volume |
| B | **Same alias registered in DIAN** as the bakery's reception email (Habilitación → "correo electrónico de recepción"). Alegra does this with `empresa@recepción.alegra.com` | Covers all suppliers, but heavier. See "DIAN caveats" below: the bakery stops getting invoices in its own inbox, and the address is also used for events from the bakery's *own* customers. Only if the app becomes the bakery's invoice inbox |
| C | Gmail filter auto-forward to the alias | **Dropped as a plan.** Works once identity is recipient-based (supplier `From:` no longer matters), and Gmail's confirmation email would just be stored, so the code can be read from Storage by hand. Emergency fallback only, no code for it |
| D | Gmail API (OAuth, read the inbox) | ❌ `gmail.readonly` is a *restricted* scope: past 100 test users it needs Google's **CASA** security assessment (~$540 to $15k, renewed every year) |
| E | Google Apps Script in each bakery's Gmail | ❌ A script to install and maintain per bakery |
| F | Download received invoices from the DIAN portal (`catalogo-vpfe.dian.gov.co` → Documentos recibidos) | ❌ for now: no simple official API for third parties (tools scrape it or need DIAN credentials). Maybe later, to reconcile against what arrived by email |

### DIAN caveats (fact-checked 2026-10-06)
- The reception email is a **single mandatory field** in DIAN Habilitación. Issuers can query it via DIAN's `GetExchangeEmails` service and must put it in the invoice XML.
- It's used **in both directions**: invoices sent to the bakery *and* AttachedDocuments/events (acuse de recibo, aceptación, reclamo) the bakery's own customers send back when the bakery is an issuer. Pointing it at us redirects all of that.
- In practice many suppliers send to the email in *their own customer master*, not the DIAN lookup. So the bakery must tell suppliers either way, which is why B2 gets most of B's value without the side effects.
- Forwarding a copy back to the bakery from the Worker (`message.forward`) only works to **Cloudflare-verified destination addresses**: one verification per bakery inbox.

### How B / B2 change the design (sketch, not built)
- **No new Worker per bakery.** One Worker, one routing rule; subaddressing makes `facturas+anything@` match the existing `facturas@` rule.
- **Identity moves from sender to recipient.** The address the email was sent to tells us the bakery. **The current Worker does NOT pass it** (it only sends `message.raw`); add one header `'X-Envelope-To': message.to`. Don't use the `To:` header: on forwards/BCC it isn't the delivery address. The backend maps alias → bakery (e.g. a field on bakery settings).
- **Trust moves from the email to the document.** The reception address is *not* secret (suppliers and DIAN know it), so anyone could email it. That's fine because:
  1. the invoice's **buyer NIT must equal the bakery's `nationalId`** (already planned for phase 2);
  2. DIAN invoices are **digitally signed by the supplier** (XAdES) and carry a **CUFE** checkable against DIAN;
  3. results land as `pending_review`;
  4. the supplier's own DKIM can be recorded too.
- **Keep path A too:** a staff forward (DKIM + Auth) still works for one-off invoices that went to a personal inbox.
- **Don't bounce supplier mail on the alias path.** Bounces would hit suppliers' invoicing systems. Store everything sent to a known alias; reject only unknown aliases.
- **Cloudflare routing choices:**
  - *Subaddressing* (`facturas+alias@`, must be **enabled** under **Email Routing → Settings**, added 2025-07): the `+detail` is preserved in `message.to`. Works with the current rule; or
  - a subdomain such as `facturas.mentedigital.app` with a catch-all to the Worker.

  Either way, there's one Worker and one route.
- **Product trade-off (B only):** if suppliers send only to our address, the bakery's own inbox no longer receives the invoices. The app must show them (the raw `.eml` is already stored). B2 avoids this.

### Questions to settle with the user before building
1. Address format: `facturas+slug@mentedigital.app` (works with the current rule, leaning this way) vs `slug@facturas.mentedigital.app` (cleaner, needs subdomain routing)?
2. Will es-alimento's top suppliers add a second recipient (B2)? Ask es-alimento which suppliers send the most invoices.
3. Is es-alimento an e-invoice issuer, and through which provider? This matters only if B (changing the DIAN email) is ever considered.

### Sources
- Alegra, buyer enablement and `@recepción.alegra.com` mailbox registered in DIAN: https://ayuda.alegra.com/es/habil%C3%ADtate-como-adquiriente-de-facturas-electr%C3%B3nicas-y-rec%C3%ADbelas-en-el-buz%C3%B3n-de-correo-de-alegra
- Alegra, reception mailbox setup: https://ayuda.alegra.com/col/buzon-de-recepcion-de-comprobantes-electronicos
- DIAN reception email rules (mandatory field, both directions, `GetExchangeEmails`): https://www.aes.com/sites/aesvault.com/files/2024-06/6.DIAN%20Normativa%20Recep%20Correos%20%281%29.pdf and Anexo técnico R165/2023: https://cdn.actualicese.com/normatividad/2023/Resoluciones/Anexo-1-R165-23.pdf
- Cloudflare Email Routing subaddressing (2025-07-21): https://developers.cloudflare.com/changelog/post/2025-07-21-subaddressing/
- Google CASA costs: https://deepstrike.io/blog/google-casa-security-assessment-2025
- Expensify identifies by verified sender (our path A model): https://community.expensify.com/discussion/8221/automatic-forwarding-to-receipts-expensify-com
- DIAN received-documents portal and bulk download tools: https://www.consultorcontable.com/consultar-y-descargar-facturas-electronicas-recibidas/
