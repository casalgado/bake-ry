# Runbook: prune orphaned client Auth accounts

**Status:** ready to execute. Audit done, dry run reviewed, nothing deleted yet.
**Written:** 2026-09-09
**Scripts:** `src/seeds/runners/auditAuth.js`, `src/seeds/runners/pruneClientAuth.js`

---

## The problem in one paragraph

The Firebase project has **1087 Auth accounts** but only **36** belong to staff or
admins. The other **1050 belong to clients** (`bakery_customer`), who never log in
and whose accounts the app never reads. They are inert logins with guessable
passwords. They came from two places, and only one of them is still active.

---

## Cause 1 — a legacy import (1047 accounts, finished)

Auth accounts by month created, for client-role users:

```
2025-01   1028      <- 992 of them on Jan 17 alone: one import run
2025-02     19
2025-07      2
2025-08      1
```

The January 2025 `es-alimento` import ran under an older version of
`bakeryUserService.create` that created a Firebase Auth account for **every**
user regardless of role. The `AUTH_REQUIRED_ROLES` gate was added later.
Those 1047 accounts are fossils. Nothing has mass-created accounts since Feb 2025.

**Current code is correct.** `bakeryUserService.js:146` checks
`needsAuthAccount(newUser.role)` and `bakery_customer` is deliberately not in
`AUTH_REQUIRED_ROLES`. Clients get a plain Firestore doc id, no Auth record.

## Cause 2 — a live bug (still leaking, ~3 accounts so far)

`src/services/bakeryUserService.js:243-255`, the role-change branch of `update`:

```js
if (data.role && data.role !== currentUser.role) {
  const hasAuthAccount = await userExists(id);
  if (!hasAuthAccount) {
    await admin.auth().createUser({ uid: id, email: currentUser.email, ... });
  }
  await admin.auth().setCustomUserClaims(id, { role: data.role, ... });
```

It never checks `needsAuthAccount(data.role)`. Changing **anyone's** role — including
changing someone **to** `bakery_customer` — mints an Auth account. The three
post-February accounts (all `diana_lee-demo`) came from this.

**Fix this after the prune, not before.** One change at a time. See "Follow-up work".

---

## Why deleting is safe

- Nothing in the app authenticates a client. `authService.login` is the only Auth
  read path and it only ever runs for staff.
- The prune script contains **no Firestore write**. Client documents, orders,
  order history, phones and emails are untouched.
- Orders reference `userId`, which is the Firestore doc id — unaffected by Auth deletion.
- A backup JSON (uid + email + claims) is written **before** any deletion.
  Firebase allows recreating an account at the same uid.
- Cost is not a factor either way: Firebase Auth bills on *active* users and
  every one of these has `lastSignIn: null`.

**What is genuinely unrecoverable:** the passwords and the original `creationTime`.
Neither matters — no client has ever signed in.

---

## Safety gates in `pruneClientAuth.js`

An account is deleted only if **every** gate passes. Anything rejected is counted
and printed with its reason.

| Gate | Purpose |
|---|---|
| Has a matching Firestore doc | Orphans get flagged for a human, never auto-deleted |
| Firestore role not in `AUTH_REQUIRED_ROLES` | Never touch someone who needs to log in |
| Auth custom claims don't say staff either | Catches drift between the two stores |
| Not `system_admin` | — |
| **Never signed in** (`lastSignIn` is null) | Anything ever used is a human decision |
| Email not in the protected set | Manual escape hatch |

The protected set is built at runtime, not hardcoded: `MANUAL_PROTECTED_EMAILS`
plus every email belonging to a staff/admin account in **both** Firestore and Auth
claims (including soft-deleted ones). It protects by *email*, which is wider than
the role gate — it also shields a client record sharing an email with staff.

Edit `MANUAL_PROTECTED_EMAILS` near the top of the script to add anything else.

---

## Expected dry-run result (as of 2026-09-09)

```
Auth records: 1087   Firestore user docs: 3047
Protected emails: 55 (1 manual + staff/admin from firestore & auth claims)

TO DELETE: 1048
TO KEEP:   39

Deletions by bakery:      1046 es-alimento, 2 diana_lee-demo
Deletions by role:        1048 bakery_customer
Kept, with reason:        37 protected email
                           2 HAS SIGNED IN — needs a human decision
```

The arithmetic: 1050 client accounts − 2 that have signed in = 1048.
No staff, no root docs, no orphans in the delete set.

---

## Procedure

All commands run from `C:\Users\casal\documents\web\back\bake-ry\functions`.

### Step 1 — dry run, review the list

```bash
node src/seeds/runners/pruneClientAuth.js
```

Deletes nothing. Prints the full list oldest-first (created, last login, email,
name, bakery, uid) and writes two files next to the script:

- `auth-prune-dryrun-<timestamp>.json` — full delete/keep lists with reasons
- `auth-prune-dryrun-<timestamp>.csv` — same, spreadsheet-friendly

Open the CSV. Check for:

- any row where `lastSignIn` is not `-` (there should be none — they're gated out)
- any **name** you recognise as someone who ought to be staff

> **Do not commit the JSON or CSV.** They contain ~1048 real client email
> addresses. Add `src/seeds/runners/auth-prune-*.json` and
> `src/seeds/runners/auth-prune-*.csv` to `.gitignore` first, or move them out
> of the repo when you're done.

### Step 2 — delete five, verify the app

```bash
node src/seeds/runners/pruneClientAuth.js --confirm --yes-delete-auth-accounts --limit=5
```

Takes the five oldest (all from the Jan 2025 import). Then, in the app:

- log in as staff
- load the `es-alimento` client list
- open one of the five clients from the CSV
- confirm their orders and order history are intact

Nothing should have changed. That's the point.

### Step 3 — the rest

```bash
node src/seeds/runners/pruneClientAuth.js --confirm --yes-delete-auth-accounts
```

Re-reads live data (never the dry-run file), re-applies every gate, writes
`auth-prune-BACKUP-<timestamp>.json`, then deletes in batches of 1000.
Expect two batches. Keep the BACKUP file somewhere safe outside the repo.

### Step 4 — verify

```bash
node src/seeds/runners/auditAuth.js
```

Read-only. Expect roughly:

```
Auth records .................... ~39
  legit staff/admin ............. 36
  matched a NON-auth role ....... 2      (the two that had signed in)
  orphan, no firestore doc ...... 0
```

---

## Rollback

Recreate from the backup JSON:

```js
const { admin } = require('./src/config/firebase');
const backup = require('./path/to/auth-prune-BACKUP-<timestamp>.json');
for (const u of backup.del) {
  await admin.auth().createUser({ uid: u.uid, email: u.email });
  if (Object.keys(u.claims).length) await admin.auth().setCustomUserClaims(u.uid, u.claims);
}
```

Passwords are not recoverable. No client has ever used one.

---

## Open items (separate from the prune)

**1. Two accounts have signed in.** `bakery_customer` by role, but someone logged
in — 2025-06-19 and 2025-07-05, both `diana_lee-demo`. Almost certainly staff who
were demoted to customer via cause 2. Decide whether they're real people who still
need to log in. They are excluded from deletion automatically. To see them:

```bash
node -e "const r=require('./src/seeds/runners/auth-prune-dryrun-<timestamp>.json'); r.keep.filter(x=>x.why.startsWith('HAS SIGNED IN')).forEach(x=>console.log(JSON.stringify(x,null,2)))"
```

**2. Three staff/admin accounts have invented `@pendiente.com` emails** —
`74ox@`, `i2vb@`, `pw8g@`. These people can never do a password reset, because
nothing delivers to `pendiente.com`. Find out who they are and give them real
addresses.

**3. Six Firestore staff have no Auth record** — mostly junk test bakeries
(`aoeu-…`, `waffles-…`), plus `manager@lee.com` in `diana_lee-demo`, which may be
a genuinely broken login.

**4. Junk test bakeries.** `aoeu-1755714475877`, `aoeu-1756041762993`,
`aoeu-1756041871112`, `waffles-1755986859150`, `waffles-1755986888731` and similar
hold nothing but a test admin. Candidates for deletion.

---

## Follow-up work: the email-uniqueness audit

The prune is one finding from a wider review. The rest, unfixed, worst first:

1. **Auth and the app disagree about scope.** `bakeryUserService.create:121-127`
   checks uniqueness *within one bakery*; `admin.auth().createUser` enforces it
   *across the whole project*. A staff email free in bakery B but present in
   bakery A passes the app check, then throws `auth/email-already-exists` as a
   500 instead of a clean 400. **The same person cannot be staff at two bakeries.**
   Decide whether that should be allowed — if yes, it's a much larger change.
2. **No normalization.** `User.js:27` doesn't lowercase or trim email
   (`legalName` on line 36 does). Firestore treats `Juan@x.com` and `juan@x.com`
   as distinct; Firebase Auth does not. Same failure, different cause.
3. **`update` never checks email uniqueness** (`bakeryUserService.js:230`) —
   phone is checked carefully at `:214-224`, email isn't. POST enforces, PUT doesn't.
4. **Create check ignores `isDeleted`** (`:121-124`) while the phone check
   includes it (`:133`). A soft-deleted user's email is burned forever.
5. **`authService.login:45-55` looks users up by email** with `limit(1)`, then
   asserts uid matches. With duplicate emails it can pick the wrong doc and
   throw a spurious 401. The uid is already in the token — use
   `.doc(decodedToken.uid).get()` and delete the email query.
6. **Auth mutations inside Firestore transactions** (`:151-165`, `:231`, `:250`,
   `:335`). Transaction callbacks re-run on contention; these side effects re-run
   with them and are not rolled back.
7. **Check-then-write races.** All uniqueness checks run outside the transaction.
   Real enforcement needs a uniqueness document written in the same transaction.

Cause 2 above (`:243-255`) is the smallest and most urgent of these — one
condition, and it stops the leak that refills the list this runbook just drained.

**Decided and closed:** the `@pendiente.com` placeholder-email scheme
(`User.js:27`) stays as-is. Not up for revisiting.
