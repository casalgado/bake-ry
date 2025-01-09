const { BAKERY_ID } = require('../seedConfig');
const fs = require('fs');
const path = require('path');
const orderService = require('../../services/orderService');

// Load seeded data
const seededProducts = require('../data/seededProducts.json');
const seededUsers = require('../data/seededUsers.json');

const getWeightedQuantity = () => {
  const rand = Math.random() * 100;
  if (rand < 60) return 1;       // 60% chance for quantity of 1
  if (rand < 90) return 2;       // 30% chance for quantity of 2
  return 3;                      // 10% chance for quantity of 3
};

// Constants
const NUMBER_OF_DAYS = 100;
const APPROX_ORDERS_PER_DAY = 4; // min 3
const ORDER_ITEM_QUANTITY = getWeightedQuantity();
const DELIVERY_PROBABILITY = 0.9;
const COMMENT_PROBABILITY = 0.2;
const DELIVERY_FEES = [6000, 7000, 8000, 9000];
const PAYMENT_METHODS = ['cash', 'transfer', 'bold'];
const RANDOM_COMMENTS = [
  'Entrega especial para cumpleaños',
  'Cliente frecuente',
  'Preguntar por portería',
  'Llamar antes de entregar',
  'Cliente nuevo',
  'Pago exacto',
  'Entregar en la mañana',
  'Dejar en recepción',
  'Edificio sin ascensor',
  'No tocar el timbre',
  'Regalo sorpresa',
  'Entregar después de las 2pm',
  'Cliente alérgico al gluten',
  'Pedido para evento especial',
  'Incluir tarjeta de felicitación',
  'Direcciones adicionales en notas',
  'Empresa - Preguntar en seguridad',
  'Preferencia horario tarde',
  'Local cerrado mediodía',
  'Contactar WhatsApp al llegar',
];

// Helper functions
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomOrder(date) {
  // Select random user
  const user = getRandomElement(seededUsers);

  // Determine delivery vs pickup
  const isDelivery = Math.random() < DELIVERY_PROBABILITY;
  const deliveryFee = isDelivery ? getRandomElement(DELIVERY_FEES) : 0;
  const deliveryCost = isDelivery ? deliveryFee - 1000 : 0;

  // Generate random number of items (1-5)
  const numberOfItems = getRandomInt(1, 5);
  const orderItems = generateRandomItems(numberOfItems);

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const total = subtotal + deliveryFee;

  // Add comments randomly
  const hasComments = Math.random() < COMMENT_PROBABILITY;
  const internalNotes = hasComments ? getRandomElement(RANDOM_COMMENTS) : '';

  return {
    preparationDate: date,
    dueDate: date,
    bakeryId: BAKERY_ID,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone ? user.phone.toString() : '',
    orderItems,
    status: 0,
    isPaid: false,
    paymentMethod: getRandomElement(PAYMENT_METHODS),
    paymentDetails: null,
    fulfillmentType: isDelivery ? 'delivery' : 'pickup',
    deliveryAddress: user.address,
    deliveryInstructions: '',
    deliveryFee,
    deliveryCost,
    subtotal,
    total,
    customerNotes: '',
    internalNotes,
    isComplimentary: false,
  };
}

function generateRandomItems(count) {
  const orderItems = [];
  const selectedProducts = new Set();

  while (orderItems.length < count) {
    const product = getRandomElement(seededProducts);

    // Avoid duplicate products
    if (selectedProducts.has(product.id)) {
      continue;
    }
    selectedProducts.add(product.id);

    const quantity = ORDER_ITEM_QUANTITY;
    const variation = product.variations?.length > 0
      ? getRandomElement(product.variations)
      : null;

    const basePrice = variation ? variation.basePrice : product.basePrice;
    const currentPrice = variation ? variation.currentPrice || basePrice : product.currentPrice || basePrice;
    const subtotal = quantity * currentPrice;

    orderItems.push({
      productId: product.id,
      productName: product.name,
      collectionId: product.collectionId,
      collectionName: product.collectionName,
      quantity,
      basePrice,
      currentPrice,
      taxPercentage: product.taxPercentage,
      variation: variation ? {
        id: variation.id,
        name: variation.name,
        value: variation.value,
        recipeId: 1,
        isWholeGrain: variation.isWholeGrain,
        currentPrice: variation.currentPrice || variation.basePrice,
      } : null,
      recipeId: 1,
      isComplimentary: false,
      status: 0,
      subtotal,
    });
  }

  return orderItems;
}

async function generateOrders() {
  try {
    console.log('Generating orders...');
    const orders = [];
    const currentDate = new Date();

    // Generate orders for the past 30 days
    for (let i = 0; i < NUMBER_OF_DAYS; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);

      // Skip Sundays (0 is Sunday in getDay())
      if (date.getDay() === 0) {
        continue;
      }

      // Generate 10-15 orders per day
      const ordersPerDay = getRandomInt(APPROX_ORDERS_PER_DAY - 2, APPROX_ORDERS_PER_DAY + 2);
      for (let j = 0; j < ordersPerDay; j++) {
        const order = generateRandomOrder(date);
        orders.push(order);
      }
    }

    // Save orders to database
    let successCount = 0;
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;

    for (const order of orders) {
      try {
        await orderService.create(order, BAKERY_ID);
        successCount++;

        // Update progress
        process.stdout.write(`\rCreating orders... ${spinner[spinnerIndex]} (${successCount}/${orders.length})`);
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
      } catch (error) {
        console.error('\nError creating order:', error);
      }
    }

    console.log(`\nSuccessfully created ${successCount} orders`);

    // Save generated orders to file for reference
    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededOrders.json'),
      JSON.stringify(orders, null, 2),
    );

    console.log('Orders saved to seededOrders.json');
    return orders;
  } catch (error) {
    console.error('Error in generateOrders:', error);
    throw error;
  }
}

// Export the function for use in other seeders
module.exports = generateOrders;

// Run standalone if this is the main module
if (require.main === module) {
  generateOrders();
}
