/**
 * Delete Firebase Auth accounts that belong to non-auth roles (clients).
 *
 * DRY RUN BY DEFAULT. Deletes nothing unless BOTH flags are present:
 *   node pruneClientAuth.js --confirm --yes-delete-auth-accounts
 *
 * Firestore is never touched. The client's user document, orders, history and
 * phone all stay exactly as they are — only the unused login is removed.
 *
 * A backup of every deleted record (uid + email + claims) is written before
 * any deletion, so an account can be recreated with the same uid if needed.
 */
const path = require('path');
const fs = require('fs');

const { admin, db } = require('../../config/firebase');

const AUTH_REQUIRED_ROLES = [
  'bakery_staff', 'delivery_assistant', 'production_assistant',
  'accounting_assistant', 'bakery_admin',
];

// Never touch these, whatever the data says. Add anything else by hand here.
const PROTECTED_UIDS = new Set([]);
const MANUAL_PROTECTED_EMAILS = ['dev@carsalhaz.com'];

const LIVE = process.argv.includes('--confirm')
          && process.argv.includes('--yes-delete-auth-accounts');

// --limit N: only act on the first N (oldest first). For a small trial run.
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const norm = (e) => (e || '').toLowerCase().trim();

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    res.users.forEach((u) => users.push({
      uid: u.uid,
      email: u.email || '',
      disabled: u.disabled,
      created: u.metadata.creationTime,
      lastSignIn: u.metadata.lastSignInTime || null,
      claims: u.customClaims || {},
    }));
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function firestoreUsersByUid() {
  const map = new Map();
  const add = (id, x, scope, bakeryId) => map.set(id, {
    scope, bakeryId, email: x.email || '', name: x.name || '',
    role: x.role || '', isDeleted: !!x.isDeleted,
  });

  (await db.collection('users').get()).forEach((d) =>
    add(d.id, d.data(), 'root', d.data().bakeryId || null));

  for (const b of (await db.collection('bakeries').get()).docs) {
    (await b.ref.collection('users').get()).forEach((d) =>
      add(d.id, d.data(), 'bakery', b.id));
  }
  return map;
}

(async () => {
  console.log(LIVE ? '*** LIVE RUN — WILL DELETE ***' : '--- DRY RUN — deletes nothing ---');

  const authUsers = await listAllAuthUsers();
  const fsByUid = await firestoreUsersByUid();
  console.log(`Auth records: ${authUsers.length}   Firestore user docs: ${fsByUid.size}\n`);

  // Protected emails = manual list + every email belonging to a staff/admin
  // account, taken from BOTH stores. Deleted users still count: a soft-deleted
  // admin's email stays protected. This is deliberately wider than the role
  // check below — it also shields a client doc that shares an email with staff.
  const PROTECTED_EMAILS = new Set(MANUAL_PROTECTED_EMAILS.map(norm));
  for (const f of fsByUid.values()) {
    if (AUTH_REQUIRED_ROLES.includes(f.role) || f.role === 'system_admin') {
      if (norm(f.email)) PROTECTED_EMAILS.add(norm(f.email));
    }
  }
  for (const a of authUsers) {
    const r = a.claims.role;
    if (r && (AUTH_REQUIRED_ROLES.includes(r) || r === 'system_admin')) {
      if (norm(a.email)) PROTECTED_EMAILS.add(norm(a.email));
    }
  }
  console.log(`Protected emails: ${PROTECTED_EMAILS.size} `
    + `(${MANUAL_PROTECTED_EMAILS.length} manual + staff/admin from firestore & auth claims)\n`);

  const del = [];
  const keep = [];

  for (const a of authUsers) {
    const fs_ = fsByUid.get(a.uid);
    const reject = (why) => keep.push({ ...a, fs: fs_, why });

    // Safety gates — every one must pass to be deleted.
    if (PROTECTED_UIDS.has(a.uid)) { reject('protected uid'); continue; }
    if (PROTECTED_EMAILS.has(norm(a.email))) { reject('protected email'); continue; }
    if (!fs_) { reject('ORPHAN — no firestore doc, investigate manually'); continue; }
    if (AUTH_REQUIRED_ROLES.includes(fs_.role)) { reject(`staff role (${fs_.role})`); continue; }
    if (a.claims.role && AUTH_REQUIRED_ROLES.includes(a.claims.role)) {
      reject(`claims say staff (${a.claims.role}) but firestore says ${fs_.role}`); continue;
    }
    if (a.claims.role === 'system_admin') { reject('system_admin'); continue; }
    if (a.lastSignIn) { reject(`HAS SIGNED IN (${a.lastSignIn}) — needs a human decision`); continue; }

    del.push({ ...a, fs: fs_ });
  }

  console.log(`TO DELETE: ${del.length}`);
  console.log(`TO KEEP:   ${keep.length}\n`);

  const tally = (arr, fn) => {
    const m = {};
    arr.forEach((x) => { const k = fn(x); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  console.log('Deletions by bakery:');
  tally(del, (x) => x.fs.bakeryId || '(root)').forEach(([k, v]) =>
    console.log(`  ${String(v).padStart(5)}  ${k}`));

  console.log('\nDeletions by firestore role:');
  tally(del, (x) => x.fs.role || '(none)').forEach(([k, v]) =>
    console.log(`  ${String(v).padStart(5)}  ${k}`));

  console.log('\nKept, with reason:');
  tally(keep, (x) => x.why).forEach(([k, v]) =>
    console.log(`  ${String(v).padStart(5)}  ${k}`));

  const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
  del.sort((a, b) => new Date(a.created) - new Date(b.created));

  console.log(`\nFULL LIST SLATED FOR DELETION (${del.length}), oldest first:`);
  console.log(`  ${'#'.padStart(4)}  ${'CREATED'.padEnd(10)}  ${'LASTLOGIN'.padEnd(10)}  `
    + `${'EMAIL'.padEnd(42)}  ${'NAME'.padEnd(26)}  ${'BAKERY'.padEnd(16)}  UID`);
  del.forEach((x, i) => console.log(
    `  ${String(i + 1).padStart(4)}  ${iso(x.created).padEnd(10)}  ${iso(x.lastSignIn).padEnd(10)}  `
    + `${(x.email || '(no email)').padEnd(42)}  ${(x.fs.name || '').slice(0, 26).padEnd(26)}  `
    + `${(x.fs.bakeryId || '').padEnd(16)}  ${x.uid}`));

  console.log('\nProtected emails (never deleted):');
  [...PROTECTED_EMAILS].sort().forEach((e) => console.log(`  ${e}`));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(__dirname, `auth-prune-${LIVE ? 'BACKUP' : 'dryrun'}-${stamp}.json`);
  fs.writeFileSync(backup, JSON.stringify({
    generatedAt: new Date().toISOString(), live: LIVE,
    protectedEmails: [...PROTECTED_EMAILS].sort(), del, keep,
  }, null, 2));
  const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = path.join(__dirname, `auth-prune-${LIVE ? 'BACKUP' : 'dryrun'}-${stamp}.csv`);
  fs.writeFileSync(csv, [
    'created,lastSignIn,email,name,role,bakeryId,uid',
    ...del.map((x) => [iso(x.created), iso(x.lastSignIn), x.email, x.fs.name,
      x.fs.role, x.fs.bakeryId, x.uid].map(csvCell).join(',')),
  ].join('\n'), 'utf8');

  console.log(`\nFull list written to: ${backup}`);
  console.log(`Spreadsheet-friendly:  ${csv}`);

  if (!LIVE) {
    console.log('\nDRY RUN — nothing deleted.');
    console.log('To execute: node pruneClientAuth.js --confirm --yes-delete-auth-accounts');
    return process.exit(0);
  }

  const target = del.slice(0, LIMIT);
  console.log(`\nDeleting ${target.length} auth accounts`
    + `${LIMIT === Infinity ? '' : ` (--limit=${LIMIT} of ${del.length})`}...`);
  let ok = 0; const failures = [];
  for (let i = 0; i < target.length; i += 1000) {
    const chunk = target.slice(i, i + 1000);
    const res = await admin.auth().deleteUsers(chunk.map((x) => x.uid));
    ok += res.successCount;
    res.errors.forEach((e) => failures.push({ uid: chunk[e.index].uid, error: e.error.message }));
    console.log(`  batch ${i / 1000 + 1}: ${res.successCount} ok, ${res.failureCount} failed`);
  }
  console.log(`\nDone. Deleted ${ok}, failed ${failures.length}.`);
  if (failures.length) console.log(JSON.stringify(failures.slice(0, 20), null, 2));
  console.log(`Backup of deleted records: ${backup}`);
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e); process.exit(1); });
