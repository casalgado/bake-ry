// models/SalesReport.js

const { Order } = require('./Order');

class SalesReport {
  constructor(orders, b2b_clients) {
    this.orders = orders.map(order => new Order(order)).filter(order => !order.isComplimentary);
    this.complimentaryOrders = orders.map(order => new Order(order)).filter(order => order.isComplimentary);
    this.b2b_clientIds = new Set(b2b_clients.map(client => client.id));
    this.dateRange = this.calculateDateRange();
  }

  generateReport() {
    return {
      metadata: this.generateMetadata(),
      revenueMetrics: this.generateRevenueMetrics(),
      productMetrics: this.generateProductMetrics(),
      operationalMetrics: this.generateOperationalMetrics(),
      taxMetrics: this.generateTaxMetrics(),
    };
  }

  calculateDateRange() {
    const dates = this.orders.map(order => new Date(order.dueDate));
    return {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates)),
      totalDays: Math.ceil(
        (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24),
      ) + 1,
    };
  }

  generateMetadata() {
    return {
      dateRange: this.dateRange,
      totalOrders: this.orders.length,
      totalRevenue: this.orders.reduce((sum, order) => sum + order.total, 0),
      totalComplimentaryOrders: this.complimentaryOrders.length,
      currency: 'COP',
    };
  }

  generateRevenueMetrics() {
    return {
      total: this.calculateTimeRanges(),
      averageOrderValue: this.calculateAverageOrderValue(),
      byPaymentMethod: this.calculateRevenueByPaymentMethod(),
      byCollection: this.calculateRevenueByCollection(),
      byCustomerSegment: this.calculateRevenueByCustomerSegment(),
    };
  }

  generateProductMetrics() {
    return {
      bestSellers: {
        byQuantity: this.calculateBestSellersByQuantity(),
        byRevenue: this.calculateBestSellersByRevenue(),
      },
      averageItemsPerOrder: this.calculateAverageItemsPerOrder(),
      popularVariations: this.calculatePopularVariations(),
    };
  }

  generateOperationalMetrics() {
    return {
      fulfillment: this.calculateFulfillmentMetrics(),
      deliveryMetrics: this.calculateDeliveryMetrics(),
    };
  }

  generateTaxMetrics() {
    const taxMetrics = {
      taxableItems: 0,          // Count of items that have tax
      preTaxSubtotal: 0,        // Subtotal of taxable items before tax
      totalTax: 0,              // Total tax amount collected
      total: 0,                  // Total with tax
    };

    // Process each order item
    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        // Only count items with tax (coffee products)
        if (item.taxPercentage > 0) {
          taxMetrics.taxableItems += item.quantity;
          taxMetrics.preTaxSubtotal += item.preTaxPrice * item.quantity;
          taxMetrics.totalTax += item.taxAmount * item.quantity;
          taxMetrics.total += item.subtotal;
        }
      });
    });

    return taxMetrics;
  }

  calculateTimeRanges() {
    const dailyTotals = {};

    // Initialize a template for each day
    const uniqueDays = [...new Set(this.orders.map(order =>
      new Date(order.dueDate).toISOString().split('T')[0],
    ))].sort();

    uniqueDays.forEach(date => {
      dailyTotals[date] = {
        b2b: 0,          // B2B sales without delivery
        b2c: 0,          // B2C sales without delivery
        subtotal: 0,     // Total sales without delivery
        delivery: 0,     // Total delivery fees
        total: 0,         // Grand total including delivery
      };
    });

    // Calculate totals for each day
    this.orders.forEach(order => {
      const dateKey = new Date(order.dueDate).toISOString().split('T')[0];
      const isB2B = this.b2b_clientIds.has(order.userId);

      // Calculate order subtotal (without delivery)
      const subtotal = order.subtotal;

      // Add to appropriate category
      if (isB2B) {
        dailyTotals[dateKey].b2b += subtotal;
      } else {
        dailyTotals[dateKey].b2c += subtotal;
      }

      // Add delivery fee if present
      if (order.fulfillmentType === 'delivery' && order.deliveryFee) {
        dailyTotals[dateKey].delivery += order.deliveryFee;
      }

      // Update totals
      dailyTotals[dateKey].subtotal = dailyTotals[dateKey].b2b + dailyTotals[dateKey].b2c;
      dailyTotals[dateKey].total = dailyTotals[dateKey].subtotal + dailyTotals[dateKey].delivery;
    });

    // Calculate weekly and monthly totals with the same structure
    const weeklyTotals = this.calculatePeriodTotals(uniqueDays, dailyTotals, 'weekly');
    const monthlyTotals = this.calculatePeriodTotals(uniqueDays, dailyTotals, 'monthly');

    return {
      daily: dailyTotals,
      weekly: weeklyTotals,
      monthly: monthlyTotals,
    };
  }

  calculatePeriodTotals(uniqueDays, dailyTotals, period) {
    const periodTotals = {};
    let periodKey;

    if (period === 'weekly') {
      // Get week range for first and last day
      const firstDay = new Date(uniqueDays[0]);
      const lastDay = new Date(uniqueDays[uniqueDays.length - 1]);
      periodKey = `${this.getWeekRange(firstDay)}/${this.getWeekRange(lastDay)}`;
    } else { // monthly
      periodKey = this.getMonthKey(new Date(uniqueDays[0]));
    }

    // Initialize period totals
    periodTotals[periodKey] = {
      b2b: 0,
      b2c: 0,
      subtotal: 0,
      delivery: 0,
      total: 0,
    };

    // Sum up all daily totals
    uniqueDays.forEach(date => {
      const dayTotals = dailyTotals[date];
      periodTotals[periodKey].b2b += dayTotals.b2b;
      periodTotals[periodKey].b2c += dayTotals.b2c;
      periodTotals[periodKey].delivery += dayTotals.delivery;
      periodTotals[periodKey].subtotal += dayTotals.subtotal;
      periodTotals[periodKey].total += dayTotals.total;
    });

    return periodTotals;
  }

  calculateAverageOrderValue() {
    const total = this.orders.reduce((sum, order) => sum + order.total, 0);
    return total / this.orders.length;
  }

  calculateRevenueByPaymentMethod() {
    const paymentMethods = {};
    let totalRevenue = 0;

    this.orders.forEach(order => {
      const method = order.paymentMethod;
      if (!paymentMethods[method]) {
        paymentMethods[method] = {
          total: 0,
          orders: 0,
        };
      }
      paymentMethods[method].total += order.total;
      paymentMethods[method].orders += 1;
      totalRevenue += order.total;
    });

    // Calculate percentages
    Object.keys(paymentMethods).forEach(method => {
      paymentMethods[method].percentage =
          (paymentMethods[method].total / totalRevenue) * 100;
    });

    return paymentMethods;
  }

  calculateRevenueByCollection() {
    const collections = {};
    let totalRevenue = 0;
    let totalQuantity = 0;

    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        if (!collections[item.collectionName]) {
          collections[item.collectionName] = {
            revenue: 0,
            quantity: 0,
          };
        }
        collections[item.collectionName].revenue += item.subtotal;
        collections[item.collectionName].quantity += item.quantity;
        totalRevenue += item.subtotal;
        totalQuantity += item.quantity;
      });
    });

    // Calculate percentages
    Object.keys(collections).forEach(collection => {
      collections[collection].averagePrice = collections[collection].revenue / collections[collection].quantity;

      collections[collection].percentageRevenue =
          (collections[collection].revenue / totalRevenue) * 100;
      collections[collection].percentageQuantity =
          (collections[collection].quantity / totalQuantity) * 100;
    });

    return collections;
  }

  calculateRevenueByCustomerSegment() {
    const segments = {
      b2b: { total: 0, orders: 0, averagePrice: 0 },
      b2c: { total: 0, orders: 0, averagePrice: 0 },
    };

    let totalRevenue = 0;

    this.orders.forEach(order => {
      // Check if customer is B2B by checking against b2b_clientIds Set
      const segment = this.b2b_clientIds.has(order.userId) ? 'b2b' : 'b2c';

      segments[segment].total += order.total;
      segments[segment].orders += 1;

      totalRevenue += order.total;
    });

    // Calculate percentages
    Object.keys(segments).forEach(segment => {
      if (totalRevenue > 0) {
        segments[segment].averagePrice = segments[segment].total / segments[segment].orders;
        segments[segment].percentageRevenue = (segments[segment].total / totalRevenue) * 100;
      } else {
        segments[segment].percentageRevenue = 0;
      }
    });

    return segments;
  }

  calculateBestSellersByQuantity() {
    const products = {};

    // Aggregate product data
    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        if (!products[item.productId]) {
          products[item.productId] = {
            productId: item.productId,
            name: item.productName,
            collection: item.collectionName,
            quantity: 0,
            revenue: 0,
          };
        }
        products[item.productId].quantity += item.quantity;
        products[item.productId].revenue += item.subtotal;
      });
    });

    // Convert to array and sort by quantity
    return Object.values(products)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(product => ({
        ...product,
        averagePrice: product.revenue / product.quantity,
      }));
  }

  calculateBestSellersByRevenue() {
    const products = this.calculateBestSellersByQuantity();
    return [...products]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  calculateAverageItemsPerOrder() {
    const totalItems = this.orders.reduce((sum, order) =>
      sum + order.orderItems.filter(item => !item.isComplimentary).reduce((itemSum, item) => itemSum + item.quantity, 0), 0,
    );
    return totalItems / this.orders.length;
  }

  calculatePopularVariations() {
    const variations = {};
    let totalItems = 0;

    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        if (item.variation) {
          const varName = item.variation.name;
          if (!variations[varName]) {
            variations[varName] = {
              quantity: 0,
              revenue: 0,
            };
          }
          variations[varName].quantity += item.quantity;
          variations[varName].revenue += item.subtotal;
          totalItems += item.quantity;
        }
      });
    });

    Object.keys(variations).forEach(variation => {
      variations[variation].percentage =
          (variations[variation].quantity / totalItems) * 100;
    });

    return variations;
  }

  calculateFulfillmentMetrics() {
    const fulfillment = {
      delivery: { orders: 0, percentage: 0 },
      pickup: { orders: 0, percentage: 0 },
    };

    this.orders.forEach(order => {
      fulfillment[order.fulfillmentType].orders += 1;
    });

    fulfillment.delivery.percentage =
        (fulfillment.delivery.orders / this.orders.length) * 100;
    fulfillment.pickup.percentage =
        (fulfillment.pickup.orders / this.orders.length) * 100;

    return fulfillment;
  }

  calculateDeliveryMetrics() {
    const deliveryOrders = this.orders.filter(
      order => order.fulfillmentType === 'delivery',
    );

    const totalFees = deliveryOrders.reduce(
      (sum, order) => sum + order.deliveryFee, 0,
    );

    const totalCost = deliveryOrders.reduce(
      (sum, order) => sum + order.deliveryCost, 0,
    );

    return {
      totalFees,
      averageFee: deliveryOrders.length ? totalFees / deliveryOrders.length : 0,
      totalCost,
      averageCost: deliveryOrders.length ? totalCost / deliveryOrders.length : 0,
      deliveryRevenue: totalFees - totalCost,
      totalOrders: deliveryOrders.length,
    };
  }

  // Helper methods
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

module.exports = SalesReport;
