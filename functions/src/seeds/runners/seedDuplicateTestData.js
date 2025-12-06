/**
 * Seeds test data for duplicate phone cleanup testing
 * Mirrors the 3 scenarios from production:
 * 1. Same person, one has 0 orders (delete the one with 0 orders)
 * 2. Different people sharing phone (clear phone from one)
 * 3. Same person with orders on both (migrate order, delete duplicate)
 */

const { db, BAKERY_ID, timestamp } = require('../seedConfig-diana_lee');
const bakeryUserService = require('../../services/BakeryUserService');
const orderService = require('../../services/OrderService');

const testUsers = [
  // Scenario 1: Same person, one has 0 orders (like Fanny Sales)
  {
    id: 'test-fanny-older',
    name: 'Fanny Sales',
    email: 'fanny-older@test.com',
    phone: '573158007392',
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: true,
  },
  {
    id: 'test-fanny-newer',
    name: 'Fanny Sales',
    email: 'fanny-newer@test.com',
    phone: '573158007392', // Same phone - duplicate!
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: false, // No orders - should be deleted
  },

  // Scenario 2: Different people sharing phone (like Valerie/Martha)
  {
    id: 'test-martha',
    name: 'Martha Osorio',
    email: 'martha@test.com',
    phone: '573157420418',
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: true,
    orderTotal: 350800, // Higher value - keep phone on this one
  },
  {
    id: 'test-valerie',
    name: 'Valerie Lafaurie',
    email: 'valerie@test.com',
    phone: '573157420418', // Same phone - different person!
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: true,
    orderTotal: 99000, // Lower value - clear phone from this one
  },

  // Scenario 3: Same person with orders on both (like Maria del Pilar / Pily)
  {
    id: 'test-maria-pilar',
    name: 'Maria del Pilar Juliao', // Full name - KEEP this one
    email: 'maria-pilar@test.com',
    phone: '573126217704',
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: true,
    orderTotal: 291000,
  },
  {
    id: 'test-pily',
    name: 'Pily Juliao', // Nickname - DELETE this one, migrate order
    email: 'pily@test.com',
    phone: '573126217704', // Same phone - same person!
    role: 'bakery_customer',
    category: 'B2C',
    hasOrder: true,
    orderTotal: 123600,
  },
];

// Get a product ID from the seeded products
async function getTestProductId() {
  const productsSnapshot = await db
    .collection('bakeries')
    .doc(BAKERY_ID)
    .collection('products')
    .limit(1)
    .get();

  if (productsSnapshot.empty) {
    throw new Error('No products found. Run seed:setup-diana_lee first.');
  }

  const product = productsSnapshot.docs[0];
  return {
    id: product.id,
    ...product.data(),
  };
}

async function createTestOrder(userId, userName, total, product) {
  const dueDate = new Date('2025-11-15');
  const prepDate = new Date('2025-11-14');
  const createdDate = new Date('2025-11-10');

  const orderData = {
    userId,
    userName,
    userEmail: `${userId}@test.com`,
    userPhone: '',
    status: 3, // delivered
    isPaid: true,
    paymentMethod: 'cash',
    fulfillmentType: 'pickup',
    dueDate,
    dueTime: '10:00',
    preparationDate: prepDate,
    createdAt: createdDate,
    orderItems: [
      {
        productId: product.id,
        productName: product.name || 'Test Product',
        productDescription: '',
        collectionId: product.collectionId || '',
        collectionName: product.collectionName || '',
        quantity: 1,
        basePrice: total,
        currentPrice: total,
        taxPercentage: 0,
      },
    ],
    customerNotes: 'Test order for duplicate cleanup testing',
  };

  return await orderService.create(orderData, BAKERY_ID);
}

async function seedDuplicateTestData() {
  try {
    console.log('Getting test product...');
    const product = await getTestProductId();
    console.log(`Using product: ${product.name || product.id}`);

    console.log('\nCreating test users with duplicate phones...\n');

    for (const userData of testUsers) {
      const { hasOrder, orderTotal, ...userFields } = userData;

      // Create user directly in Firestore (bypassing uniqueness check)
      const userRef = db
        .collection('bakeries')
        .doc(BAKERY_ID)
        .collection('users')
        .doc(userData.id);

      await userRef.set({
        ...userFields,
        isDeleted: false,
        createdAt: timestamp(),
        updatedAt: timestamp(),
      });

      console.log(`✓ Created user: ${userData.name} (${userData.id})`);

      // Create order if needed
      if (hasOrder) {
        const total = orderTotal || 100000;
        const order = await createTestOrder(userData.id, userData.name, total, product);
        console.log(`  → Created order: ${order.id} (total: ${total})`);
      }
    }

    console.log('\n=== Test Data Summary ===\n');
    console.log('Scenario 1 - Same person, one with 0 orders:');
    console.log('  Phone: 573158007392');
    console.log('  - test-fanny-older (has order) → KEEP');
    console.log('  - test-fanny-newer (no orders) → DELETE');

    console.log('\nScenario 2 - Different people sharing phone:');
    console.log('  Phone: 573157420418');
    console.log('  - test-martha (higher value) → KEEP phone');
    console.log('  - test-valerie (lower value) → CLEAR phone');

    console.log('\nScenario 3 - Same person, both have orders:');
    console.log('  Phone: 573126217704');
    console.log('  - test-maria-pilar (full name) → KEEP, receive migrated order');
    console.log('  - test-pily (nickname) → MIGRATE order, then DELETE');

    console.log('\n✓ Test data seeded successfully!');

  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDuplicateTestData().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = seedDuplicateTestData;
