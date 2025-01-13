const fs = require('fs');
const path = require('path');

// Import orders
const orders = require('../data/export_orders_2.json');

// Set the specific date you want to filter (YYYY-MM-DD)
const TARGET_DATE = '2025-01-13';

// Helper function to get just the date part
const getDatePart = (dateStr) => dateStr.split('T')[0];

// Filter orders for the specific date
const filteredOrders = Object.fromEntries(
  Object.entries(orders).filter(([, order]) =>
    getDatePart(order.date) === TARGET_DATE,
  ),
);

// Create processed_imports directory if it doesn't exist
const processedImportsDir = path.join(__dirname, '../data/processed_imports');
if (!fs.existsSync(processedImportsDir)) {
  fs.mkdirSync(processedImportsDir, { recursive: true });
}

// Save filtered orders
const filename = `orders_${TARGET_DATE}.json`;
fs.writeFileSync(
  path.join(processedImportsDir, filename),
  JSON.stringify(filteredOrders, null, 2),
);

// Print summary
console.log('\nFiltering Summary:');
console.log('------------------');
console.log('Date:', TARGET_DATE);
console.log('Total orders found:', Object.keys(filteredOrders).length);
console.log('\nOrders saved to:', filename);

// Print basic order details
console.log('\nOrders found:');
Object.entries(filteredOrders).forEach(([orderId, order]) => {
  console.log(`\nOrder ID: ${orderId}`);
  console.log(`Client: ${order.client}`);
  console.log(`Total: ${order.total}`);
});
