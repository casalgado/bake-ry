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
      productMix: this.calculateProductMix(),
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

  calculateTimeRanges() {
    const dailyTotals = {};
    const weeklyTotals = {};
    const monthlyTotals = {};

    this.orders.forEach(order => {
      const orderDate = new Date(order.dueDate);

      // Daily total
      const dateKey = orderDate.toISOString().split('T')[0];
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + order.total;

      // Weekly total
      const weekKey = this.getWeekRange(orderDate);
      weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + order.total;

      // Monthly total
      const monthKey = this.getMonthKey(orderDate);
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + order.total;
    });

    return {
      daily: dailyTotals,
      weekly: weeklyTotals,
      monthly: monthlyTotals,
    };
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

    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        if (!collections[item.collectionName]) {
          collections[item.collectionName] = {
            total: 0,
            orders: 0,
          };
        }
        collections[item.collectionName].total += item.subtotal;
        collections[item.collectionName].orders += 1;
        totalRevenue += item.subtotal;
      });
    });

    // Calculate percentages
    Object.keys(collections).forEach(collection => {
      collections[collection].percentage =
          (collections[collection].total / totalRevenue) * 100;
    });

    return collections;
  }

  calculateRevenueByCustomerSegment() {
    const segments = {
      b2b: { total: 0, orders: 0 },
      b2c: { total: 0, orders: 0 },
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
        segments[segment].percentage = (segments[segment].total / totalRevenue) * 100;
      } else {
        segments[segment].percentage = 0;
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

  calculateProductMix() {
    const collections = {};
    let totalQuantity = 0;
    let totalRevenue = 0;

    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
        if (!collections[item.collectionName]) {
          collections[item.collectionName] = {
            quantity: 0,
            revenue: 0,
          };
        }
        collections[item.collectionName].quantity += item.quantity;
        collections[item.collectionName].revenue += item.subtotal;
        totalQuantity += item.quantity;
        totalRevenue += item.subtotal;
      });
    });

    Object.keys(collections).forEach(collection => {
      collections[collection].quantityPercentage =
          (collections[collection].quantity / totalQuantity) * 100;
      collections[collection].revenuePercentage =
          (collections[collection].revenue / totalRevenue) * 100;
    });

    return collections;
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

    return {
      averageFee: deliveryOrders.length ? totalFees / deliveryOrders.length : 0,
      totalFees,
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
