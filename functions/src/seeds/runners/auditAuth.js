/**
 * READ-ONLY audit of Firebase Auth vs Firestore users.
 * Writes nothing. Dumps a summary to stdout and a full JSON report next to itself.
 */
const path = require('path');
const fs = require('fs');

const { admin, db } = require('../../config/firebase');

const AUTH_REQUIRED_ROLES = [
  'bakery_staff', 'delivery_assistant', 'production_assistant',
  'accounting_assistant', 'bakery_admin',
];

const norm = (e) => (e || '').toLowerCase().trim();
const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : 'unknown');

async function listAllAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    for (const u of res.users) {
      users.push({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || '',
        disabled: u.disabled,
        created: u.metadata.creationTime,
        lastSignIn: u.metadata.lastSignInTime || null,
        providers: u.providerData.map((p) => p.providerId),
        claims: u.customClaims || {},
      });
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return users;
}

async function listFirestoreUsers() {
  const out = [];

  const root = await db.collection('users').get();
  root.forEach((d) => {
    const x = d.data();
    out.push({
      docId: d.id, scope: 'root', bakeryId: x.bakeryId || null,
      email: x.email || '', name: x.name || '', role: x.role || '',
      category: x.category || '', isDeleted: !!x.isDeleted,
      createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
    });
  });

  const bakeries = await db.collection('bakeries').get();
  for (const b of bakeries.docs) {
    const snap = await b.ref.collection('users').get();
    snap.forEach((d) => {
      const x = d.data();
      out.push({
        docId: d.id, scope: 'bakery', bakeryId: b.id,
        email: x.email || '', name: x.name || '', role: x.role || '',
        category: x.category || '', isDeleted: !!x.isDeleted,
        createdAt: x.createdAt?.toDate?.()?.toISOString() || null,
      });
    });
  }
  return { fsUsers: out, bakeryIds: bakeries.docs.map((d) => d.id) };
}

function tally(arr, keyFn) {
  const m = {};
  for (const a of arr) { const k = keyFn(a); m[k] = (m[k] || 0) + 1; }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function printTable(title, rows, limit = 15) {
  console.log(`\n${title}`);
  if (!rows.length) { console.log('  (none)'); return; }
  rows.slice(0, limit).forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));
  if (rows.length > limit) console.log(`  ... ${rows.length - limit} more`);
}

(async () => {
  console.log('Reading Firebase Auth...');
  const authUsers = await listAllAuthUsers();
  console.log(`  ${authUsers.length} auth records`);

  console.log('Reading Firestore...');
  const { fsUsers, bakeryIds } = await listFirestoreUsers();
  console.log(`  ${fsUsers.length} firestore user docs across ${bakeryIds.length} bakeries`);

  const byUid = new Map();
  for (const f of fsUsers) {
    if (!byUid.has(f.docId)) byUid.set(f.docId, []);
    byUid.get(f.docId).push(f);
  }
  const byEmail = new Map();
  for (const f of fsUsers) {
    const e = norm(f.email);
    if (!e) continue;
    if (!byEmail.has(e)) byEmail.set(e, []);
    byEmail.get(e).push(f);
  }

  const buckets = {
    orphanNoFsDoc: [],
    matchedNonAuthRole: [],
    matchedSoftDeleted: [],
    matchedOk: [],
    emailOnlyMatch: [],
    noClaims: [],
  };

  for (const a of authUsers) {
    const docs = byUid.get(a.uid);
    if (!docs) {
      const byMail = byEmail.get(norm(a.email)) || [];
      (byMail.length ? buckets.emailOnlyMatch : buckets.orphanNoFsDoc)
        .push({ ...a, fsMatchesByEmail: byMail.length });
    } else {
      const d = docs[0];
      const rec = { ...a, fsRole: d.role, fsScope: d.scope, fsBakery: d.bakeryId, fsDeleted: d.isDeleted, fsName: d.name };
      if (d.isDeleted) buckets.matchedSoftDeleted.push(rec);
      else if (!AUTH_REQUIRED_ROLES.includes(d.role)) buckets.matchedNonAuthRole.push(rec);
      else buckets.matchedOk.push(rec);
    }
    if (!a.claims.role) buckets.noClaims.push(a);
  }

  const authUids = new Set(authUsers.map((a) => a.uid));
  const staffMissingAuth = fsUsers.filter(
    (f) => !f.isDeleted && AUTH_REQUIRED_ROLES.includes(f.role) && !authUids.has(f.docId));

  const neverSignedIn = authUsers.filter((a) => !a.lastSignIn);
  const pendiente = authUsers.filter((a) => norm(a.email).endsWith('@pendiente.com'));
  const dupEmailsFs = [...byEmail.entries()]
    .filter(([, v]) => v.filter((x) => !x.isDeleted).length > 1)
    .map(([k, v]) => [`${k}  (${v.map((x) => `${x.scope}:${x.bakeryId || '-'}:${x.role}`).join(' | ')})`, v.length]);

  const line = '='.repeat(72);
  console.log(`\n${line}\nAUTH vs FIRESTORE AUDIT\n${line}`);
  console.log(`Auth records .................. ${authUsers.length}`);
  console.log(`Firestore user docs .......... ${fsUsers.length}`);
  console.log(`Bakeries ..................... ${bakeryIds.length}`);
  console.log(`\n--- Auth record classification ---`);
  console.log(`  legit staff/admin (role needs auth) .... ${buckets.matchedOk.length}`);
  console.log(`  ⚠ matched a NON-auth role (clients!) ... ${buckets.matchedNonAuthRole.length}`);
  console.log(`  ⚠ matched a SOFT-DELETED user .......... ${buckets.matchedSoftDeleted.length}`);
  console.log(`  ⚠ orphan, no firestore doc at all ...... ${buckets.orphanNoFsDoc.length}`);
  console.log(`  ⚠ no doc by uid, but email exists in fs  ${buckets.emailOnlyMatch.length}`);
  console.log(`  no role in custom claims ............... ${buckets.noClaims.length}`);
  console.log(`  never signed in ........................ ${neverSignedIn.length}`);
  console.log(`  @pendiente.com placeholder emails ...... ${pendiente.length}`);
  console.log(`  disabled ............................... ${authUsers.filter((a) => a.disabled).length}`);
  console.log(`\n  firestore staff MISSING an auth record . ${staffMissingAuth.length}`);

  printTable('Auth records created per day (top):', tally(authUsers, (a) => day(a.created)));
  printTable('Auth email domains:', tally(authUsers, (a) => norm(a.email).split('@')[1] || '(no email)'));
  printTable('Claims role on auth records:', tally(authUsers, (a) => a.claims.role || '(none)'));
  printTable('Claims bakeryId on auth records:', tally(authUsers, (a) => a.claims.bakeryId || '(none)'));
  printTable('Firestore roles (not deleted):',
    tally(fsUsers.filter((f) => !f.isDeleted), (f) => `${f.scope}/${f.role || '(none)'}`));
  printTable('Firestore users per bakery (not deleted):',
    tally(fsUsers.filter((f) => !f.isDeleted && f.scope === 'bakery'), (f) => f.bakeryId));
  printTable('DUPLICATE emails in firestore (case-insensitive, live docs):', dupEmailsFs, 20);

  console.log('\n--- Samples ---');
  const sample = (name, arr, fmt) => {
    console.log(`\n${name} (showing up to 10 of ${arr.length}):`);
    if (!arr.length) return console.log('  (none)');
    arr.slice(0, 10).forEach((x) => console.log('  ' + fmt(x)));
  };
  sample('Clients with an auth account', buckets.matchedNonAuthRole,
    (x) => `${x.uid}  ${x.email}  role=${x.fsRole}  bakery=${x.fsBakery}  created=${day(x.created)}  signedIn=${x.lastSignIn ? 'yes' : 'NEVER'}`);
  sample('Orphan auth records', buckets.orphanNoFsDoc,
    (x) => `${x.uid}  ${x.email}  claims=${JSON.stringify(x.claims)}  created=${day(x.created)}  signedIn=${x.lastSignIn ? 'yes' : 'NEVER'}`);
  sample('Auth for soft-deleted users', buckets.matchedSoftDeleted,
    (x) => `${x.uid}  ${x.email}  role=${x.fsRole}  bakery=${x.fsBakery}`);
  sample('Auth matched only by email (uid mismatch — login breaker)', buckets.emailOnlyMatch,
    (x) => `${x.uid}  ${x.email}  fsMatches=${x.fsMatchesByEmail}  claims=${JSON.stringify(x.claims)}`);
  sample('Firestore staff with NO auth record', staffMissingAuth,
    (x) => `${x.docId}  ${x.email}  role=${x.role}  bakery=${x.bakeryId}`);

  const out = path.join(__dirname, 'auth-audit-report.json');
  fs.writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totals: {
      auth: authUsers.length, firestore: fsUsers.length, bakeries: bakeryIds.length,
      matchedOk: buckets.matchedOk.length,
      matchedNonAuthRole: buckets.matchedNonAuthRole.length,
      matchedSoftDeleted: buckets.matchedSoftDeleted.length,
      orphanNoFsDoc: buckets.orphanNoFsDoc.length,
      emailOnlyMatch: buckets.emailOnlyMatch.length,
      staffMissingAuth: staffMissingAuth.length,
      neverSignedIn: neverSignedIn.length,
      pendiente: pendiente.length,
    },
    buckets, staffMissingAuth, dupEmailsFs, authUsers, fsUsers,
  }, null, 2));
  console.log(`\nFull report: ${out}`);
  process.exit(0);
})().catch((e) => { console.error('AUDIT FAILED:', e); process.exit(1); });
