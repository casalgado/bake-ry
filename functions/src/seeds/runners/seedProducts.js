const { BAKERY_ID } = require('../seedConfig');
const productsData = require('../data/products.json');
const productService = require('../../services/productService');
const Product = require('../../models/Product');
const fs = require('fs');
const path = require('path');

async function seedProducts() {
  try {
    console.log('Creating products...');

    // First, ensure product collections exist by reading from file

    // Get products from JSON file
    const products = productsData.items;

    // Store created products with their IDs for reference
    const createdProducts = [];

    // Create products through service
    for (const product of products) {
      try {
        // Create new product with exact data from JSON
        const newProduct = new Product({
          ...product,
          bakeryId: BAKERY_ID,
        });

        const createdProduct = await productService.create(newProduct, BAKERY_ID);

        createdProducts.push({
          id: createdProduct.id,
          ...createdProduct,
        });
        console.log(`Created product: ${createdProduct.collectionName}, ${createdProduct.name}, ${createdProduct.id}`);

      } catch (error) {
        console.error(`Error creating product ${product.name}:`, error);
        // Continue with next product if one fails
        continue;
      }
    }

    // Write created products to a file for reference
    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededProducts.json'),
      JSON.stringify(createdProducts, null, 2),
    );

    console.log('Products seeded successfully');
    return createdProducts;
  } catch (error) {
    console.error('Error seeding products:', error);
    throw error;
  }
}

// Export the function so it can be used by other seeders
module.exports = seedProducts;

// Only run if this is the main file being executed
if (require.main === module) {
  seedProducts();
}
