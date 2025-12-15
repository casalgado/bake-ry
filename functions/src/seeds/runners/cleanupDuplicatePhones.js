/**
 * Cleanup script for duplicate phone numbers
 *
 * Operations:
 * 1. DELETE - Soft delete users with 0 orders
 * 2. CLEAR_PHONE - Clear phone from a user (different people sharing phone)
 * 3. MIGRATE_AND_DELETE - Migrate orders to target user, delete source order, soft delete source user
 */

const { db, BAKERY_ID } = require('../seedConfig-diana_lee');
const bakeryUserService = require('../../services/bakeryUserService');
const orderService = require('../../services/orderService');

// Configuration for cleanup actions
const CLEANUP_ACTIONS = [
  // Scenario 1: Same person, one has 0 orders - DELETE the one with no orders
  {
    type: 'DELETE',
    userId: 'test-fanny-newer',
    reason: 'Duplicate of test-fanny-older, has 0 orders',
  },

  // Scenario 2: Different people sharing phone - CLEAR phone from lower value user
  {
    type: 'CLEAR_PHONE',
    userId: 'test-valerie',
    reason: 'Different person sharing phone with test-martha, lower order value',
  },

  // Scenario 3: Same person with orders on both - MIGRATE order then DELETE
  {
    type: 'MIGRATE_AND_DELETE',
    sourceUserId: 'test-pily',
    targetUserId: 'test-maria-pilar',
    reason: 'Same person (Pily is nickname), keeping full name account',
  },
];

/**
 * Get all orders for a user
 */
async function getUserOrders(bakeryId, userId) {
  const ordersSnapshot = await db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('orders')
    .where('userId', '==', userId)
    .where('isDeleted', '==', false)
    .get();

  return ordersSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

/**
 * Delete a user (soft delete)
 */
async function deleteUser(bakeryId, userId, reason) {
  console.log(`\n[DELETE] User: ${userId}`);
  console.log(`  Reason: ${reason}`);

  // First check if user has orders
  const orders = await getUserOrders(bakeryId, userId);
  if (orders.length > 0) {
    console.log(`  ⚠️  WARNING: User has ${orders.length} orders! Skipping delete.`);
    return { success: false, error: 'User has orders' };
  }

  await bakeryUserService.delete(userId, bakeryId);
  console.log('  ✓ User soft-deleted successfully');
  return { success: true };
}

/**
 * Clear phone from a user
 */
async function clearPhone(bakeryId, userId, reason) {
  console.log(`\n[CLEAR_PHONE] User: ${userId}`);
  console.log(`  Reason: ${reason}`);

  // Get current user data
  const userDoc = await db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('users')
    .doc(userId)
    .get();

  if (!userDoc.exists) {
    console.log('  ⚠️  User not found!');
    return { success: false, error: 'User not found' };
  }

  const currentPhone = userDoc.data().phone;
  console.log(`  Current phone: ${currentPhone}`);

  await bakeryUserService.update(userId, { phone: '' }, bakeryId);
  console.log('  ✓ Phone cleared successfully');
  return { success: true, previousPhone: currentPhone };
}

/**
 * Migrate orders from source user to target user, then delete source
 */
async function migrateAndDelete(bakeryId, sourceUserId, targetUserId, reason) {
  console.log('\n[MIGRATE_AND_DELETE]');
  console.log(`  Source: ${sourceUserId}`);
  console.log(`  Target: ${targetUserId}`);
  console.log(`  Reason: ${reason}`);

  // Get source user's orders
  const sourceOrders = await getUserOrders(bakeryId, sourceUserId);
  console.log(`  Found ${sourceOrders.length} orders to migrate`);

  if (sourceOrders.length === 0) {
    console.log('  No orders to migrate, just deleting user...');
    await bakeryUserService.delete(sourceUserId, bakeryId);
    console.log('  ✓ Source user deleted');
    return { success: true, migratedOrders: 0 };
  }

  // Get target user info
  const targetUserDoc = await db
    .collection('bakeries')
    .doc(bakeryId)
    .collection('users')
    .doc(targetUserId)
    .get();

  if (!targetUserDoc.exists) {
    console.log('  ⚠️  Target user not found!');
    return { success: false, error: 'Target user not found' };
  }

  const targetUser = targetUserDoc.data();

  // Migrate each order
  for (const order of sourceOrders) {
    console.log(`  Migrating order: ${order.id}`);

    // Create new order data with target user
    const newOrderData = {
      ...order,
      userId: targetUserId,
      userName: targetUser.name,
      userEmail: targetUser.email,
      userPhone: targetUser.phone || '',
      internalNotes: `${order.internalNotes || ''}\n[Migrated from user ${sourceUserId} on ${new Date().toISOString()}]`.trim(),
    };

    // Remove fields that shouldn't be copied
    delete newOrderData.id;
    delete newOrderData.bakeryId;

    // Create the order on target user (this also creates orderHistory)
    const newOrder = await orderService.create(newOrderData, bakeryId);
    console.log(`    ✓ Created new order: ${newOrder.id}`);

    // Soft delete the original order
    await orderService.remove(order.id, bakeryId, { uid: 'system', email: 'system@cleanup.com', role: 'system' });
    console.log(`    ✓ Deleted original order: ${order.id}`);
  }

  // Soft delete the source user
  await bakeryUserService.delete(sourceUserId, bakeryId);
  console.log('  ✓ Source user deleted');

  return { success: true, migratedOrders: sourceOrders.length };
}

/**
 * Main cleanup function
 */
async function runCleanup(dryRun = false) {
  console.log('='.repeat(60));
  console.log('DUPLICATE PHONE CLEANUP');
  console.log(`Bakery: ${BAKERY_ID}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('='.repeat(60));

  const results = {
    success: [],
    failed: [],
  };

  for (const action of CLEANUP_ACTIONS) {
    try {
      let result;

      if (dryRun) {
        console.log(`\n[DRY RUN] Would ${action.type}: ${action.userId || action.sourceUserId}`);
        result = { success: true, dryRun: true };
      } else {
        switch (action.type) {
        case 'DELETE':
          result = await deleteUser(BAKERY_ID, action.userId, action.reason);
          break;
        case 'CLEAR_PHONE':
          result = await clearPhone(BAKERY_ID, action.userId, action.reason);
          break;
        case 'MIGRATE_AND_DELETE':
          result = await migrateAndDelete(BAKERY_ID, action.sourceUserId, action.targetUserId, action.reason);
          break;
        default:
          result = { success: false, error: `Unknown action type: ${action.type}` };
        }
      }

      if (result.success) {
        results.success.push({ action, result });
      } else {
        results.failed.push({ action, result });
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      results.failed.push({ action, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('CLEANUP SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Successful: ${results.success.length}`);
  console.log(`✗ Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed actions:');
    results.failed.forEach(f => {
      console.log(`  - ${f.action.type}: ${f.action.userId || f.action.sourceUserId}`);
      console.log(`    Error: ${f.error || f.result?.error}`);
    });
  }

  return results;
}

// CLI entry point
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  runCleanup(dryRun)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Cleanup failed:', err);
      process.exit(1);
    });
}

module.exports = { runCleanup, CLEANUP_ACTIONS };
