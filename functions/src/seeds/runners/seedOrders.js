const { BAKERY_ID } = require('../seedConfig');
const fs = require('fs');
const path = require('path');
const orderService = require('../../services/orderService');

// Load seeded data
const seededUsers = require('../data/seededUsers.json');
const productsData = require('../data/products.json');

const getWeightedQuantity = () => {
  const rand = Math.random() * 100;
  if (rand < 60) return 1; // 60% chance for quantity of 1
  if (rand < 90) return 2; // 30% chance for quantity of 2
  return 3; // 10% chance for quantity of 3
};

// Constants
const NUMBER_OF_DAYS = 60;
const APPROX_ORDERS_PER_DAY = 3; // min 3
const ORDER_ITEM_QUANTITY = () => getWeightedQuantity();
const DELIVERY_PROBABILITY = 0.9;
const COMMENT_PROBABILITY = 0.2;
const DELIVERY_FEES = [6000, 7000, 8000, 9000];
const PAYMENT_METHODS = ['cash', 'transfer', 'davivienda'];
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

  // Payment logic (50/50 paid/unpaid)
  const isPaid = Math.random() < 0.5;

  // Payment date logic - if paid, set to dueDate or 1-2 days after
  let paymentDate = null;
  if (isPaid) {
    const daysAfter = Math.random() < 0.5 ? 0 : getRandomInt(1, 2);
    paymentDate = new Date(date);
    paymentDate.setDate(paymentDate.getDate() + daysAfter);
  }

  // Partial payment logic (10% of orders get 40-50% partial payment)
  const hasPartialPayment = Math.random() < 0.1;
  let partialPaymentAmount = 0;
  let partialPaymentDate = null;

  if (hasPartialPayment) {
    const subtotal = orderItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    const total = subtotal + deliveryFee;
    partialPaymentAmount = Math.round(total * (0.4 + Math.random() * 0.1)); // 40-50%

    // Set partial payment date between order creation and payment date (or just after creation if unpaid)
    const maxDate = paymentDate || new Date(date.getTime() + (1000 * 60 * 60 * 24 * getRandomInt(1, 3))); // 1-3 days after if unpaid
    const minDate = new Date(date.getTime() + (1000 * 60 * 60 * getRandomInt(2, 8))); // 2-8 hours after creation
    partialPaymentDate = new Date(minDate.getTime() + Math.random() * (maxDate.getTime() - minDate.getTime()));
  }

  // Add comments randomly
  const hasComments = Math.random() < COMMENT_PROBABILITY;
  const internalNotes = hasComments ? getRandomElement(RANDOM_COMMENTS) : '';

  return {
    preparationDate: date,
    dueDate: date,
    paymentDate,
    partialPaymentDate,
    bakeryId: BAKERY_ID,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userPhone: user.phone ? user.phone.toString() : '',
    userNationalId: '',
    orderItems,
    status: 0,
    isPaid,
    isDeliveryPaid: false,
    paymentMethod: getRandomElement(PAYMENT_METHODS),
    partialPaymentAmount,
    fulfillmentType: isDelivery ? 'delivery' : 'pickup',
    deliveryAddress: user.address,
    deliveryInstructions: '',
    deliveryDriverId: '-',
    driverMarkedAsPaid: false,
    deliverySequence: 1,
    deliveryFee,
    deliveryCost,
    numberOfBags: 1,
    customerNotes: '',
    deliveryNotes: '',
    internalNotes,
    isDeleted: false,
    lastEditedBy: {
      userId: 'seed-system',
      email: 'system@bakery.com',
      role: 'system',
    },
  };
}

function generateRandomItems(count) {
  const orderItems = [];
  const selectedProducts = new Set();

  // Limit count to available products to avoid infinite loop
  const maxCount = Math.min(count, productsData.items.length);

  while (orderItems.length < maxCount) {
    const product = getRandomElement(productsData.items);

    // Avoid duplicate products
    if (selectedProducts.has(product.id)) {
      continue;
    }
    selectedProducts.add(product.id);

    const quantity = ORDER_ITEM_QUANTITY();
    const variation =
      product.variations?.length > 0
        ? getRandomElement(product.variations)
        : null;

    const basePrice = variation ? variation.basePrice : product.basePrice;
    const currentPrice = variation
      ? variation.currentPrice || basePrice
      : product.currentPrice || basePrice;

    orderItems.push({
      productId: product.id,
      productName: product.name,
      collectionId: product.collectionId,
      collectionName: product.collectionName,
      quantity,
      basePrice,
      currentPrice,
      taxPercentage: product.taxPercentage,
      variation: variation
        ? {
          id: variation.id,
          name: variation.name,
          value: variation.value,
          isWholeGrain: variation.isWholeGrain,
          currentPrice: variation.currentPrice || variation.basePrice,
        }
        : null,
      isComplimentary: false,
      productionBatch: 1,
      status: 0,
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
      const ordersPerDay = getRandomInt(
        APPROX_ORDERS_PER_DAY - 2,
        APPROX_ORDERS_PER_DAY + 2,
      );
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
        process.stdout.write(
          `\rCreating orders... ${spinner[spinnerIndex]} (${successCount}/${orders.length})`,
        );
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
