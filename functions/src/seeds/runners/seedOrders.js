const { BAKERY_ID } = require('../seedConfig');
const fs = require('fs');
const path = require('path');
const orderService = require('../../services/orderService');

// Load real order data
const realOrdersData = require('../../../zsandbox/all_orders.ea.json');

// The models handle all date transformation automatically via BaseModel.ensureDate()

async function generateOrders() {
  try {
    console.log('Importing real orders...');

    // Use real order data directly - models handle all transformation
    // Sort by createdAt date (most recent first) so you can stop anytime
    const orders = realOrdersData.items.sort((a, b) => {
      const dateA = new Date(a.createdAt || '1900-01-01');
      const dateB = new Date(b.createdAt || '1900-01-01');
      return dateB - dateA; // Most recent first
    });

    console.log(`Found ${orders.length} orders to import`);
    console.log(`Date range: ${orders[0]?.createdAt} (newest) to ${orders[orders.length - 1]?.createdAt} (oldest)`);

    // Save orders to database in batches
    let successCount = 0;
    let errorCount = 0;
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    const batchSize = 10; // Process in smaller batches to avoid memory issues

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);

      // Process batch orders
      for (const order of batch) {
        try {
          await orderService.create(order, BAKERY_ID);
          successCount++;
        } catch (error) {
          console.error(`\nError creating order ${order.id}:`, error.message);
          errorCount++;
        }

        // Update progress
        process.stdout.write(
          `\rImporting orders... ${spinner[spinnerIndex]} (${successCount}/${orders.length}, ${errorCount} errors)`,
        );
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
      }

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nSuccessfully imported ${successCount} orders`);
    if (errorCount > 0) {
      console.log(`Failed to import ${errorCount} orders`);
    }

    // Save processed orders to file for reference
    const seedDataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(seedDataDir)) {
      fs.mkdirSync(seedDataDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(seedDataDir, 'importedOrders.json'),
      JSON.stringify(orders.slice(0, 100), null, 2), // Save only first 100 for reference due to size
    );

    console.log('Sample of imported orders saved to importedOrders.json');
    return { successCount, errorCount, totalCount: orders.length };
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
