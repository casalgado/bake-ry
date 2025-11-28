// models/ProductReport.js

const { Order } = require('./Order');

class ProductReport {
  constructor(orders, b2b_clients, all_products, options = {}) {
    this.options = {
      categories: options.categories || null, // array of collectionIds or null for all
      period: options.period || null, // 'daily', 'weekly', 'monthly' or null
      metrics: options.metrics || 'both', // 'ingresos', 'cantidad', or 'both'
      segment: options.segment || 'none', // 'none', 'all', 'b2b', 'b2c'
      dateField: options.dateField || 'dueDate',
      defaultDateRangeApplied: options.defaultDateRangeApplied || false,
    };

    // Convert orders to Order instances and filter out complimentary
    this.allOrders = orders.map(order => order instanceof Order ? order : new Order(order))
      .filter(order => !order.isComplimentary);

    // Create B2B client ID set for segmentation
    this.b2b_clientIds = new Set(b2b_clients.map(client => client.id));
    this.all_products = all_products;

    // Filter by categories if specified
    this.categoryIds = this.options.categories
      ? new Set(this.options.categories)
      : null;

    // Segment orders based on option
    this.orders = this.filterOrdersBySegment(this.allOrders);

    // Pre-calculate aggregated data
    this.aggregatedData = this.aggregateProductData();
  }

  filterOrdersBySegment(orders) {
    const segment = this.options.segment;

    if (segment === 'b2b') {
      return orders.filter(order => this.b2b_clientIds.has(order.userId));
    } else if (segment === 'b2c') {
      return orders.filter(order => !this.b2b_clientIds.has(order.userId));
    }
    // 'none' or 'all' - use all orders
    return orders;
  }

  generateReport() {
    return {
      metadata: this.generateMetadata(),
      products: this.generateProductTable(),
      summary: this.generateSummary(),
    };
  }

  generateMetadata() {
    const dates = this.orders.map(order => new Date(order[this.options.dateField]));
    const validDates = dates.filter(d => !isNaN(d.getTime()));

    return {
      options: this.options,
      totalOrders: this.orders.length,
      dateRange: validDates.length > 0 ? {
        start: new Date(Math.min(...validDates)),
        end: new Date(Math.max(...validDates)),
      } : null,
      totalProducts: this.aggregatedData.length,
      currency: 'COP',
    };
  }

  generateProductTable() {
    const products = this.aggregatedData.map(product => {
      const row = {
        categoryId: product.categoryId,
        categoryName: product.categoryName,
        productId: product.productId,
        productName: product.productName,
        avgPrice: product.avgPrice,
      };

      // Add metrics based on options
      if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
        row.totalIngresos = product.totalIngresos;
      }
      if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
        row.totalCantidad = product.totalCantidad;
      }

      // Add segment breakdown if segment is 'all'
      if (this.options.segment === 'all') {
        if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
          row.b2bIngresos = product.b2bIngresos;
          row.b2cIngresos = product.b2cIngresos;
        }
        if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
          row.b2bCantidad = product.b2bCantidad;
          row.b2cCantidad = product.b2cCantidad;
        }
      }

      // Add period data if period is specified
      if (this.options.period && product.periods) {
        row.periods = {};
        Object.keys(product.periods).sort().forEach(periodKey => {
          row.periods[periodKey] = {};
          if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
            row.periods[periodKey].ingresos = product.periods[periodKey].ingresos;
          }
          if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
            row.periods[periodKey].cantidad = product.periods[periodKey].cantidad;
          }
          // Add B2B/B2C breakdown per period when segment is 'all'
          if (this.options.segment === 'all') {
            if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
              row.periods[periodKey].b2bIngresos = product.periods[periodKey].b2bIngresos;
              row.periods[periodKey].b2cIngresos = product.periods[periodKey].b2cIngresos;
            }
            if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
              row.periods[periodKey].b2bCantidad = product.periods[periodKey].b2bCantidad;
              row.periods[periodKey].b2cCantidad = product.periods[periodKey].b2cCantidad;
            }
          }
        });
      }

      return row;
    });

    // Sort by category name, then product name
    return products.sort((a, b) => {
      const catCompare = (a.categoryName || '').localeCompare(b.categoryName || '');
      if (catCompare !== 0) return catCompare;
      return (a.productName || '').localeCompare(b.productName || '');
    });
  }

  generateSummary() {
    const totals = this.aggregatedData.reduce((acc, product) => {
      acc.totalIngresos += product.totalIngresos;
      acc.totalCantidad += product.totalCantidad;
      if (this.options.segment === 'all') {
        acc.b2bIngresos += product.b2bIngresos;
        acc.b2bCantidad += product.b2bCantidad;
        acc.b2cIngresos += product.b2cIngresos;
        acc.b2cCantidad += product.b2cCantidad;
      }
      return acc;
    }, {
      totalIngresos: 0,
      totalCantidad: 0,
      b2bIngresos: 0,
      b2bCantidad: 0,
      b2cIngresos: 0,
      b2cCantidad: 0,
    });

    // Calculate by category
    const byCategory = {};
    this.aggregatedData.forEach(product => {
      const catId = product.categoryId || 'uncategorized';
      if (!byCategory[catId]) {
        byCategory[catId] = {
          categoryId: catId,
          categoryName: product.categoryName || 'Sin categoría',
          totalIngresos: 0,
          totalCantidad: 0,
        };
      }
      byCategory[catId].totalIngresos += product.totalIngresos;
      byCategory[catId].totalCantidad += product.totalCantidad;
    });

    const result = {
      totals: {},
      byCategory: Object.values(byCategory),
    };

    if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
      result.totals.totalIngresos = totals.totalIngresos;
    }
    if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
      result.totals.totalCantidad = totals.totalCantidad;
    }

    if (this.options.segment === 'all') {
      if (this.options.metrics === 'ingresos' || this.options.metrics === 'both') {
        result.totals.b2bIngresos = totals.b2bIngresos;
        result.totals.b2cIngresos = totals.b2cIngresos;
      }
      if (this.options.metrics === 'cantidad' || this.options.metrics === 'both') {
        result.totals.b2bCantidad = totals.b2bCantidad;
        result.totals.b2cCantidad = totals.b2cCantidad;
      }
    }

    return result;
  }

  aggregateProductData() {
    const products = {};
    const productsWithSales = new Set();

    // Determine which orders to use for B2B/B2C breakdown
    const b2bOrders = this.allOrders.filter(order => this.b2b_clientIds.has(order.userId));
    const b2cOrders = this.allOrders.filter(order => !this.b2b_clientIds.has(order.userId));

    // First pass: aggregate sales data from orders
    this.orders.forEach(order => {
      const orderDate = new Date(order[this.options.dateField]);
      const periodKey = this.options.period ? this.getPeriodKey(orderDate) : null;
      const isB2B = this.b2b_clientIds.has(order.userId);

      order.orderItems
        .filter(item => !item.isComplimentary)
        .filter(item => !this.categoryIds || this.categoryIds.has(item.collectionId))
        .forEach(item => {
          productsWithSales.add(item.productId);

          if (!products[item.productId]) {
            products[item.productId] = this.initializeProductEntry(item);
          }

          // Add to totals
          products[item.productId].totalIngresos += item.subtotal;
          products[item.productId].totalCantidad += item.quantity;
          products[item.productId].totalPriceSum += item.currentPrice * item.quantity;

          // Add to period if applicable
          if (periodKey) {
            if (!products[item.productId].periods[periodKey]) {
              products[item.productId].periods[periodKey] = {
                ingresos: 0,
                cantidad: 0,
                b2bIngresos: 0,
                b2bCantidad: 0,
                b2cIngresos: 0,
                b2cCantidad: 0,
              };
            }
            products[item.productId].periods[periodKey].ingresos += item.subtotal;
            products[item.productId].periods[periodKey].cantidad += item.quantity;

            // Track B2B/B2C per period
            if (isB2B) {
              products[item.productId].periods[periodKey].b2bIngresos += item.subtotal;
              products[item.productId].periods[periodKey].b2bCantidad += item.quantity;
            } else {
              products[item.productId].periods[periodKey].b2cIngresos += item.subtotal;
              products[item.productId].periods[periodKey].b2cCantidad += item.quantity;
            }
          }

          // Track B2B/B2C totals
          if (isB2B) {
            products[item.productId].b2bIngresos += item.subtotal;
            products[item.productId].b2bCantidad += item.quantity;
          } else {
            products[item.productId].b2cIngresos += item.subtotal;
            products[item.productId].b2cCantidad += item.quantity;
          }
        });
    });

    // Third pass: add products with zero sales (active or deleted with sales)
    this.all_products
      .filter(product => !product.isDeleted || productsWithSales.has(product.id))
      .filter(product => !this.categoryIds || this.categoryIds.has(product.collectionId))
      .forEach(product => {
        if (!products[product.id]) {
          products[product.id] = {
            productId: product.id,
            productName: product.name,
            categoryId: product.collectionId,
            categoryName: product.collectionName,
            totalIngresos: 0,
            totalCantidad: 0,
            totalPriceSum: 0,
            b2bIngresos: 0,
            b2bCantidad: 0,
            b2cIngresos: 0,
            b2cCantidad: 0,
            periods: {},
          };
        }
      });

    // Calculate average price and finalize
    return Object.values(products).map(product => {
      // Get the most up-to-date name from all_products if available
      const productInfo = this.all_products.find(p => p.id === product.productId);
      return {
        ...product,
        productName: productInfo?.name || product.productName,
        categoryName: productInfo?.collectionName || product.categoryName,
        avgPrice: product.totalCantidad > 0
          ? product.totalPriceSum / product.totalCantidad
          : 0,
      };
    });
  }

  initializeProductEntry(item) {
    return {
      productId: item.productId,
      productName: item.productName,
      categoryId: item.collectionId,
      categoryName: item.collectionName,
      totalIngresos: 0,
      totalCantidad: 0,
      totalPriceSum: 0,
      b2bIngresos: 0,
      b2bCantidad: 0,
      b2cIngresos: 0,
      b2cCantidad: 0,
      periods: {},
    };
  }

  getPeriodKey(date) {
    if (!date || isNaN(date.getTime())) return null;

    switch (this.options.period) {
    case 'daily':
      return date.toISOString().split('T')[0];
    case 'weekly':
      return this.getWeekRange(date);
    case 'monthly':
      return this.getMonthKey(date);
    default:
      return null;
    }
  }

  getWeekRange(date) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    const day = current.getDay() || 7;

    const monday = new Date(current);
    monday.setDate(current.getDate() - (day - 1));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    return `${mondayStr}/${sundayStr}`;
  }

  getMonthKey(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }
}

module.exports = ProductReport;
