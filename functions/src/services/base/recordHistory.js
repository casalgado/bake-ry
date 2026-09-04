// The one place a document's updateHistory subcollection gets an entry.
// Extracted from serviceFactory so non-CRUD writers — the cost-propagation walk
// in recipeGraph — record into the same subcollection and record shape instead
// of standing up a parallel one.
//
// `reason` tags why a change happened ('reconciliation' for a drift correction);
// omitted for ordinary edits. `currentData` is unused but kept so the existing
// serviceFactory call sites don't have to change argument order.
const recordHistory = (transaction, docRef, changes, currentData, editor, reason = null) => {
  void currentData;

  const record = {
    timestamp: new Date(),
    editor: {
      userId: editor?.uid || 'system',
      email: editor?.email || 'system@system.com',
      role: editor?.role || 'system',
    },
    changes,
  };

  if (reason) record.reason = reason;

  transaction.set(docRef.collection('updateHistory').doc(), record);
};

module.exports = recordHistory;
