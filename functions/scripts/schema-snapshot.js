#!/usr/bin/env node
// READ-ONLY: walks Firestore and prints an inferred schema (field names + types per collection
// path) as Markdown. Diagnostic tool, always writes a timestamped snapshot to
// docs/schema-snapshots/ (safe to commit — no credentials or per-bakery business data leave the
// field/type level). Ported from restaurant-dashboard/functions/scripts/schema-snapshot.js.
//
// Targets the local emulator by default; pass --prod for the real project. That needs the
// service-account key at src/config/serviceAccountKey.json (same file seedConfig.js's
// commented-out prod block uses), or set GOOGLE_APPLICATION_CREDENTIALS yourself.
//
// Usage:
//   node scripts/schema-snapshot.js [--sample <n>] [--max-depth <n>] [--collection <path>]
//   Add --prod to run against production Firestore instead of the emulator.
//
// /bakeries is special-cased (see PINNED_BAKERY_IDS, exploreBakeriesRoot): the sample always
// includes a fixed list of known bakeries plus the most recent ones, and each subcollection
// (orders, products, ...) is shown both per-bakery (to catch shape drift between bakeries) and
// pooled into one merged shape.
const fs = require('fs');
const path = require('path');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'bake-ry';

const args = process.argv.slice(2);
const get = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
};

const isProd = args.includes('--prod');
const sampleSize = parseInt(get('--sample') || '5', 10);
const maxDepth = parseInt(get('--max-depth') || '6', 10);
const scopePath = get('--collection');

const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'schema-snapshots');
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const outPath = path.join(OUT_DIR, `${isProd ? 'production' : 'emulator'}-${timestamp}.md`);
const summaryOutPath = path.join(OUT_DIR, `${isProd ? 'production' : 'emulator'}-${timestamp}-summary.md`);

const PROBE_LIMIT = 3; // internal safety knob — how many sampled docs to probe for subcollection names

if (isProd) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, '..', 'src', 'config', 'serviceAccountKey.json');
  if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    console.error(
      `--prod requires a service-account key; none found at ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`,
    );
    process.exit(1);
  }
} else {
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
}

const admin = require('firebase-admin');
const { Timestamp, GeoPoint, DocumentReference } = require('firebase-admin/firestore');
admin.initializeApp();
const db = admin.firestore();

// ── Type inference ─────────────────────────────────────────────────────────────
// isIdShaped: heuristic for "this key is really a record ID, not a field name" —
// Firebase Auth UID / Firestore auto-ID (long alnum), or short numeric-ish IDs
// like order numbers and product codes, plus day-of-month keys.
function isIdShaped(key) {
  return (
    /^[A-Za-z0-9_-]{20,}$/.test(key) ||
    /^\d{1,4}[A-Za-z]{0,2}$/.test(key) ||
    /^\d{4}-\d{2}-\d{2}$/.test(key) // ISO date keys, e.g. "2026-01-05"
  );
}

function classifyValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (value instanceof Timestamp) return 'Timestamp';
  if (value instanceof GeoPoint) return 'GeoPoint';
  if (value instanceof DocumentReference) return `Reference<${value.parent.id}>`;
  if (Array.isArray(value)) return null; // handled by caller (needs to flatten across samples)
  if (typeof value === 'object') return null; // handled by caller (needs classifyObjectShape)
  return 'unknown';
}

// mergeValues: merges a list of raw observed values for one field into a single
// type descriptor. Returns either a primitive type string, an Array<...> string,
// or an object shape descriptor (from classifyObjectShape).
function mergeValues(values) {
  const present = values.filter((v) => v !== undefined);
  if (present.length === 0) return 'unknown';

  const arrays = present.filter((v) => Array.isArray(v));
  const objects = present.filter((v) => v !== null && !Array.isArray(v) && typeof v === 'object' && !(v instanceof Timestamp) && !(v instanceof GeoPoint) && !(v instanceof DocumentReference));
  const primitives = present.filter((v) => !arrays.includes(v) && !objects.includes(v));

  const types = new Set();

  for (const p of primitives) {
    types.add(classifyValue(p));
  }

  if (arrays.length > 0) {
    const elements = arrays.flatMap((a) => a);
    const elementType = elements.length > 0 ? mergeValues(elements) : 'unknown';
    types.add(renderType(`Array<${renderType(elementType)}>`));
  }

  if (objects.length > 0) {
    types.add(classifyObjectShape(objects));
  }

  if (types.size === 1) return [...types][0];
  return { union: [...types] };
}

function renderType(t) {
  if (typeof t === 'string') return t;
  if (t && t.union) return t.union.map(renderType).join(' | ');
  if (t && t.kind === 'fixed') return renderFixedInline(t);
  if (t && (t.kind === 'dynamic' || t.kind === 'hybrid')) return renderDynamicInline(t);
  return String(t);
}

function renderFixedInline(shape) {
  return `{ ${shape.fixed.map((f) => `${f.key}${f.optional ? '?' : ''}: ${renderType(f.type)}`).join(', ')} }`;
}

function renderDynamicInline(shape) {
  return `{ [dynamicKey]: ${renderType(shape.dynamic.valueType)} }`;
}

// classifyObjectShape: the fixed-vs-dynamic-key heuristic. Peels off reserved
// keys (leading underscore, e.g. "_meta") as always-fixed, then checks whether
// every remaining key looks like a record ID rather than a field name. If so,
// pools all those keys' values into one merged shape instead of listing every
// key literally (avoids unreadable output for things like `members` or
// `byProduct`'s product-code keys).
function classifyObjectShape(objectSamples) {
  const allKeys = new Set(objectSamples.flatMap((o) => Object.keys(o)));
  const reserved = [...allKeys].filter((k) => k.startsWith('_'));
  const remaining = [...allKeys].filter((k) => !k.startsWith('_'));

  const allDynamic = remaining.length > 0 && remaining.every(isIdShaped);

  if (allDynamic) {
    const pooled = objectSamples.flatMap((o) => remaining.filter((k) => k in o).map((k) => o[k]));
    return {
      kind: reserved.length > 0 ? 'hybrid' : 'dynamic',
      fixed: reserved.map((k) => describeFixedKey(k, objectSamples)),
      dynamic: {
        keyCount: remaining.length,
        sampledDocs: objectSamples.length,
        exampleKeys: remaining.slice(0, 5),
        valueType: mergeValues(pooled),
      },
    };
  }

  return {
    kind: 'fixed',
    fixed: [...reserved, ...remaining].map((k) => describeFixedKey(k, objectSamples)),
  };
}

function describeFixedKey(key, objectSamples) {
  const presentCount = objectSamples.filter((o) => key in o).length;
  const values = objectSamples.filter((o) => key in o).map((o) => o[key]);
  return {
    key,
    optional: presentCount < objectSamples.length,
    presentCount,
    totalCount: objectSamples.length,
    type: mergeValues(values),
  };
}

// looksHeterogeneous: some collections (e.g. `config`) aren't repeated entities of one shape —
// they're a small bag of named singleton docs, each with its own mostly-disjoint fields. Merging
// those into one shape makes every field look "optional" (present in 1 of N docs) instead of
// showing N small, distinct docs. Detect it via average pairwise field-set overlap across the
// sampled docs: real entity collections share nearly all top-level fields; a singleton bag shares
// almost none.
// ponytail: fixed 0.3 overlap cutoff, not calibrated beyond this codebase's shapes — revisit if
// a genuinely homogeneous collection ever trips it (e.g. many nullable/optional fields at once).
const HETEROGENEITY_OVERLAP_THRESHOLD = 0.3;

function looksHeterogeneous(objectSamples) {
  if (objectSamples.length < 2) return false;
  const keySets = objectSamples.map((o) => new Set(Object.keys(o).filter((k) => !k.startsWith('_'))));

  let totalOverlap = 0;
  let pairs = 0;
  for (let i = 0; i < keySets.length; i++) {
    for (let j = i + 1; j < keySets.length; j++) {
      const a = keySets[i];
      const b = keySets[j];
      const intersection = [...a].filter((k) => b.has(k)).length;
      const union = new Set([...a, ...b]).size;
      totalOverlap += union === 0 ? 1 : intersection / union;
      pairs++;
    }
  }
  return pairs > 0 && totalOverlap / pairs < HETEROGENEITY_OVERLAP_THRESHOLD;
}

// fetchLatestSample: orders by createdAt desc so the sample reflects recent data, not whatever
// order Firestore happens to store docs in. Falls back to an unordered limit() when the
// collection has docs but none carry createdAt (Firestore excludes fieldless docs from orderBy).
async function fetchLatestSample(collectionRef, n) {
  const ordered = await collectionRef.orderBy('createdAt', 'desc').limit(n).get();
  if (ordered.docs.length > 0) return ordered.docs;
  const fallback = await collectionRef.limit(n).get();
  return fallback.docs;
}

// PINNED_BAKERY_IDS: bakeries that must always appear in the root /bakeries sample (known
// staging/demo accounts), regardless of createdAt order. Remaining sample slots are filled
// with the most recent bakeries not already covered.
const PINNED_BAKERY_IDS = [
  'biofilia-diseo-verde-sas-1758568948738',
  'claritatem-1756475060821',
  'diana_lee',
  'diana_lee-demo',
  'es-alimento',
  'pastellus',
  'molina-art-1770409453123',
];

async function fetchSampleWithPinned(collectionRef, n, pinnedIds) {
  const pinnedSnaps = await Promise.all(pinnedIds.map((id) => collectionRef.doc(id).get()));
  const pinned = pinnedSnaps.filter((snap) => snap.exists);
  const pinnedIdSet = new Set(pinned.map((s) => s.id));

  const topUpCount = Math.max(n - pinned.length, 0);
  const latest = topUpCount > 0 ? await fetchLatestSample(collectionRef, n) : [];
  const topUp = latest.filter((d) => !pinnedIdSet.has(d.id)).slice(0, topUpCount);

  return [...pinned, ...topUp];
}

// ── Traversal ──────────────────────────────────────────────────────────────────
async function exploreCollection(collectionRef, displayPath, depth) {
  if (depth > maxDepth) {
    return { path: displayPath, truncated: 'max-depth' };
  }

  const [countSnap, docs] = await Promise.all([
    collectionRef.count().get(),
    fetchLatestSample(collectionRef, sampleSize),
  ]);
  const totalCount = countSnap.data().count;

  if (docs.length === 0) {
    return { path: displayPath, sampledDocs: 0, totalCount, shape: null, subcollections: [], docsData: [] };
  }

  const docsData = docs.map((d) => d.data());
  const heterogeneous = looksHeterogeneous(docsData);
  const shape = heterogeneous ? null : classifyObjectShape(docsData);
  const perDoc = heterogeneous
    ? docs.map((d, i) => ({ id: d.id, shape: classifyObjectShape([docsData[i]]) }))
    : null;

  const probeDocs = docs.slice(0, Math.min(PROBE_LIMIT, docs.length));
  const subcolNames = new Set();
  for (const doc of probeDocs) {
    for (const c of await doc.ref.listCollections()) subcolNames.add(c.id);
  }

  const subcollections = [];
  for (const name of subcolNames) {
    let result;
    let i = 0;
    do {
      result = await exploreCollection(
        probeDocs[i].ref.collection(name),
        `${displayPath}/{docId}/${name}`,
        depth + 1,
      );
      i++;
    } while (result.sampledDocs === 0 && i < probeDocs.length);
    subcollections.push(result);
  }

  return {
    path: displayPath,
    sampledDocs: docs.length,
    totalCount,
    shape,
    perDoc,
    subcollections,
    docsData,
  };
}

// exploreBakeriesRoot: /bakeries is multi-tenant, and shapes (esp. `orders`) can drift between
// bakeries as the schema evolves. The generic exploreCollection() only probes subcollections
// under the first few sampled parent docs and stops at the first one with data — fine for
// single-tenant collections, misleading here. This explores every pinned/sampled bakery's
// subcollections separately (so drift is visible per bakery) and also pools them into one
// merged shape per subcollection (so the common shape is still easy to read at a glance).
async function exploreBakeriesRoot(bakeriesRef) {
  const displayPath = '/bakeries';
  const countSnap = await bakeriesRef.count().get();
  const totalCount = countSnap.data().count;
  const docs = await fetchSampleWithPinned(bakeriesRef, sampleSize, PINNED_BAKERY_IDS);

  if (docs.length === 0) {
    return { path: displayPath, sampledDocs: 0, totalCount, shape: null, isBakeriesRoot: true, subcollectionGroups: [] };
  }

  const docsData = docs.map((d) => d.data());
  const heterogeneous = looksHeterogeneous(docsData);
  const shape = heterogeneous ? null : classifyObjectShape(docsData);
  const perDoc = heterogeneous
    ? docs.map((d, i) => ({ id: d.id, shape: classifyObjectShape([docsData[i]]) }))
    : null;

  const subcolNames = new Set();
  for (const doc of docs) {
    for (const c of await doc.ref.listCollections()) subcolNames.add(c.id);
  }

  const subcollectionGroups = [];
  for (const name of subcolNames) {
    const perBakeryNodes = [];
    const pooledDocsData = [];
    for (const doc of docs) {
      const node = await exploreCollection(doc.ref.collection(name), `/bakeries/${doc.id}/${name}`, 1);
      if (node.sampledDocs > 0) {
        perBakeryNodes.push(node);
        pooledDocsData.push(...node.docsData);
      }
    }
    const pooledHeterogeneous = pooledDocsData.length > 0 && looksHeterogeneous(pooledDocsData);
    const pooledShape = pooledDocsData.length > 0 && !pooledHeterogeneous ? classifyObjectShape(pooledDocsData) : null;
    subcollectionGroups.push({ name, perBakeryNodes, pooledShape, pooledSampleCount: pooledDocsData.length, bakeriesWithData: perBakeryNodes.length });
  }

  return { path: displayPath, sampledDocs: docs.length, totalCount, shape, perDoc, isBakeriesRoot: true, subcollectionGroups };
}

// ── Report ─────────────────────────────────────────────────────────────────────
function renderNode(node, lines) {
  if (node.truncated) {
    lines.push(`### \`${node.path}\``);
    lines.push(`*truncated — max depth reached*`);
    lines.push('');
    return;
  }

  lines.push(`### \`${node.path}\``);
  if (node.sampledDocs === 0) {
    lines.push(`*Docs sampled: 0 of ${node.totalCount} total*`);
    lines.push('');
    return;
  }

  const exhaustive = node.sampledDocs >= node.totalCount;
  lines.push(
    `*Docs sampled: ${node.sampledDocs} of ${node.totalCount} total${exhaustive ? ' (exhaustive)' : ' — NOT exhaustive, raise `--sample` to see more'}*`,
  );
  lines.push('');

  if (node.perDoc) {
    lines.push(`*Heterogeneous — treated as a bag of named docs, not repeated entities:*`);
    lines.push('');
    for (const { id, shape } of node.perDoc) {
      lines.push(`**doc: \`${id}\`**`);
      lines.push('```');
      renderShape(shape, lines, '');
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('```');
    renderShape(node.shape, lines, '');
    lines.push('```');
    lines.push('');
  }

  if (node.subcollections.length > 0) {
    lines.push(`**Subcollections:** ${node.subcollections.map((s) => `\`${s.path.split('/').pop()}\``).join(', ')}`);
    lines.push('');
  }

  for (const sub of node.subcollections) {
    renderNode(sub, lines);
  }
}

function renderBakeriesRootNode(node, lines, includePerBakery) {
  lines.push(`### \`${node.path}\``);
  if (node.sampledDocs === 0) {
    lines.push(`*Docs sampled: 0 of ${node.totalCount} total*`);
    lines.push('');
    return;
  }

  const exhaustive = node.sampledDocs >= node.totalCount;
  lines.push(
    `*Docs sampled: ${node.sampledDocs} of ${node.totalCount} total${exhaustive ? ' (exhaustive)' : ' — pinned bakeries + most recent'}*`,
  );
  lines.push('');

  if (node.perDoc) {
    lines.push(`*Heterogeneous — treated as a bag of named docs, not repeated entities:*`);
    lines.push('');
    for (const { id, shape } of node.perDoc) {
      lines.push(`**doc: \`${id}\`**`);
      lines.push('```');
      renderShape(shape, lines, '');
      lines.push('```');
      lines.push('');
    }
  } else {
    lines.push('```');
    renderShape(node.shape, lines, '');
    lines.push('```');
    lines.push('');
  }

  for (const group of node.subcollectionGroups) {
    lines.push(`#### Subcollection: \`${group.name}\` (${group.bakeriesWithData} bakeries sampled)`);
    lines.push('');

    if (group.pooledShape) {
      lines.push(`**Merged shape across ${group.pooledSampleCount} sampled docs, all bakeries:**`);
      lines.push('```');
      renderShape(group.pooledShape, lines, '');
      lines.push('```');
      lines.push('');
    }

    if (includePerBakery) {
      lines.push(`**Per-bakery shape (to spot drift):**`);
      lines.push('');
      for (const bakeryNode of group.perBakeryNodes) {
        renderNode(bakeryNode, lines);
      }
    }
  }
}

function renderShape(shape, lines, indent) {
  if (shape.fixed.length > 0) {
    lines.push(`${indent}FIXED FIELDS:`);
    for (const f of shape.fixed) {
      const presence = f.optional ? `  (present: ${f.presentCount}/${f.totalCount})` : '';
      lines.push(`${indent}  ${f.key}${f.optional ? '?' : ''} : ${renderType(f.type)}${presence}`);
    }
    lines.push('');
  }

  if (shape.kind === 'dynamic' || shape.kind === 'hybrid') {
    const d = shape.dynamic;
    lines.push(`${indent}[DYNAMIC KEYS — ${d.keyCount} distinct keys observed across ${d.sampledDocs} sampled doc(s), merged]`);
    lines.push(`${indent}  example keys : ${d.exampleKeys.map((k) => `"${k}"`).join(', ')}`);
    lines.push(`${indent}  value type   :`);
    renderValueType(d.valueType, lines, `${indent}    `);
    lines.push('');
  }
}

function renderValueType(type, lines, indent) {
  if (typeof type === 'string') {
    lines.push(`${indent}${type}`);
    return;
  }
  if (type.union) {
    lines.push(`${indent}${renderType(type)}`);
    return;
  }
  if (type.kind === 'fixed' || type.kind === 'dynamic' || type.kind === 'hybrid') {
    renderShape(type, lines, indent);
    return;
  }
  lines.push(`${indent}${renderType(type)}`);
}

// ── Run ────────────────────────────────────────────────────────────────────────
// Two outputs: "full" includes the per-bakery breakdown under /bakeries subcollections (thorough,
// for spotting drift between bakeries); "summary" has the same content everywhere else but
// collapses those into just the merged shape (general read of the schema).
function header() {
  const lines = [];
  lines.push(`# Firestore Schema Snapshot`);
  lines.push('');
  lines.push(`*Generated (diagnostic — inferred from sampled documents, not hand-maintained).*`);
  lines.push('');
  lines.push(
    `- **Generated:** ${new Date().toISOString()}\n` +
      `- **Project:** ${process.env.GCLOUD_PROJECT} (${isProd ? 'prod' : 'emulator'})\n` +
      `- **Sample size:** ${sampleSize}\n` +
      `- **Max depth:** ${maxDepth}\n` +
      `- **Scope:** ${scopePath || 'root'}`,
  );
  lines.push('');
  return lines;
}

async function run() {
  const fullLines = header();
  const summaryLines = header();

  const renderBoth = (node, isBakeries) => {
    if (isBakeries) {
      renderBakeriesRootNode(node, fullLines, true);
      renderBakeriesRootNode(node, summaryLines, false);
    } else {
      renderNode(node, fullLines);
      renderNode(node, summaryLines);
    }
  };

  if (scopePath) {
    const segments = scopePath.split('/').filter(Boolean);
    if (segments.length % 2 !== 1) {
      console.error(`--collection must point to a collection (odd number of path segments), got: "${scopePath}"`);
      process.exit(1);
    }
    console.error(`Exploring /${scopePath} ...`);
    if (scopePath === 'bakeries') {
      renderBoth(await exploreBakeriesRoot(db.collection('bakeries')), true);
    } else {
      renderBoth(await exploreCollection(db.collection(scopePath), `/${scopePath}`, 0), false);
    }
  } else {
    const rootCollections = await db.listCollections();
    for (const col of rootCollections) {
      console.error(`Exploring /${col.id} ...`);
      if (col.id === 'bakeries') {
        renderBoth(await exploreBakeriesRoot(col), true);
      } else {
        renderBoth(await exploreCollection(col, `/${col.id}`, 0), false);
      }
    }
  }

  const fullReport = fullLines.join('\n');
  console.log(fullReport);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outPath, fullReport);
  fs.writeFileSync(summaryOutPath, summaryLines.join('\n'));
  console.error(`\nWritten to ${path.relative(process.cwd(), outPath)}`);
  console.error(`Written to ${path.relative(process.cwd(), summaryOutPath)}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSchema snapshot failed:', err.message);
    process.exit(1);
  });
