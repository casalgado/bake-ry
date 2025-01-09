// models/SalesReport.js

const { Order } = require('./Order');

class SalesReport {
  constructor(orders, b2b_clients) {
    this.orders = orders.map(order => new Order(order)).filter(order => !order.isComplimentary);
    this.complimentaryOrders = orders.map(order => new Order(order)).filter(order => order.isComplimentary);
    this.b2b_clientIds = new Set(b2b_clients.map(client => client.id));

    // Pre-calculate common metrics
    this.totalRevenue = this.orders.reduce((sum, order) => sum + order.total, 0);
    this.totalSales = this.orders.reduce((sum, order) => sum + order.subtotal, 0);
    this.totalDelivery = this.orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

    // B2B and B2C calculations
    this.b2bOrders = this.orders.filter(order => this.b2b_clientIds.has(order.userId));
    this.b2cOrders = this.orders.filter(order => !this.b2b_clientIds.has(order.userId));
    this.totalB2B = this.b2bOrders.reduce((sum, order) => sum + order.total, 0);
    this.totalB2C = this.b2cOrders.reduce((sum, order) => sum + order.total, 0);

    // Calculate date range once
    this.dateRange = this.calculateDateRange();

    // Pre-calculate product aggregations
    this.aggregatedProducts = this.aggregateProductData();
  }

  generateReport() {
    return {
      metadata: this.generateMetadata(),
      salesMetrics: this.generateSalesMetrics(),
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
      totalPaidOrders: this.orders.length,
      totalRevenue: this.totalRevenue,
      totalSales: this.totalSales,
      totalDelivery: this.totalDelivery,
      totalB2B: this.totalB2B,
      totalB2C: this.totalB2C,
      percentageB2B: Number(((this.totalB2B / this.totalSales) * 100).toFixed(1)),
      percentageB2C: Number(((this.totalB2C / this.totalSales) * 100).toFixed(1)),
      totalComplimentaryOrders: this.complimentaryOrders.length,
      currency: 'COP',
    };
  }

  calculateTimeRanges() {
    const dailyTotals = {};

    // Initialize daily totals
    const uniqueDays = [...new Set(this.orders.map(order =>
      new Date(order.dueDate).toISOString().split('T')[0],
    ))].sort();

    uniqueDays.forEach(date => {
      const dayOrders = this.orders.filter(order =>
        new Date(order.dueDate).toISOString().split('T')[0] === date,
      );

      const dayB2BOrders = dayOrders.filter(order => this.b2b_clientIds.has(order.userId));
      const dayB2COrders = dayOrders.filter(order => !this.b2b_clientIds.has(order.userId));

      const dayTotal = dayOrders.reduce((sum, order) => sum + order.total, 0);
      const dayB2B = dayB2BOrders.reduce((sum, order) => sum + order.subtotal, 0);
      const dayB2C = dayB2COrders.reduce((sum, order) => sum + order.subtotal, 0);
      const dayDelivery = dayOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
      const daySales = dayB2B + dayB2C;

      dailyTotals[date] = {
        total: dayTotal,
        sales: daySales,
        delivery: dayDelivery,
        b2b: {
          amount: dayB2B,
          percentage: (dayB2B / daySales) * 100,
        },
        b2c: {
          amount: dayB2C,
          percentage: (dayB2C / daySales) * 100,
        },
      };
    });

    // Calculate weekly and monthly totals
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
      const firstDay = new Date(uniqueDays[0]);
      const lastDay = new Date(uniqueDays[uniqueDays.length - 1]);
      periodKey = `${this.getWeekRange(firstDay)}/${this.getWeekRange(lastDay)}`;
    } else {
      periodKey = this.getMonthKey(new Date(uniqueDays[0]));
    }

    // Initialize period totals with the same structure as daily totals
    let totalSales = 0;
    let totalB2B = 0;
    let totalB2C = 0;
    let totalDelivery = 0;

    uniqueDays.forEach(date => {
      const dayTotals = dailyTotals[date];
      totalSales += dayTotals.sales;
      totalB2B += dayTotals.b2b.amount;
      totalB2C += dayTotals.b2c.amount;
      totalDelivery += dayTotals.delivery;
    });

    periodTotals[periodKey] = {
      total: totalSales + totalDelivery,
      sales: totalSales,
      delivery: totalDelivery,
      b2b: {
        amount: totalB2B,
        percentage: (totalB2B / totalSales) * 100,
      },
      b2c: {
        amount: totalB2C,
        percentage: (totalB2C / totalSales) * 100,
      },
    };

    return periodTotals;
  }

  generateSalesMetrics() {
    return {
      total: this.calculateTimeRanges(),
      averageOrderValue: this.totalRevenue / this.orders.length,
      averageOrderSales: this.totalSales / this.orders.length,
      byPaymentMethod: this.calculateSalesByPaymentMethod(),
      byCollection: this.calculateSalesByCollection(),
      byCustomerSegment: this.calculateSalesByCustomerSegment(),
    };
  }

  generateProductMetrics() {
    return {
      bestSellers: {
        byQuantity: this.calculateBestSellersByQuantity(),
        bySales: this.calculateBestSellersBySales(),
      },
      lowestSellers: {
        byQuantity: this.calculateLowestSellersByQuantity(),
        bySales: this.calculateLowestSellersBySales(),
      },
      averageItemsPerOrder: this.calculateAverageItemsPerOrder(),
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
      taxableItems: 0,
      preTaxSubtotal: 0,
      totalTax: 0,
      total: 0,
    };

    this.orders.forEach(order => {
      order.orderItems.filter(item => !item.isComplimentary).forEach(item => {
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

  calculateSalesByPaymentMethod() {
    const paymentMethods = {};

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
    });

    // Calculate percentages
    Object.keys(paymentMethods).forEach(method => {
      paymentMethods[method].percentage =
          (paymentMethods[method].total / this.totalRevenue) * 100;
    });

    return paymentMethods;
  }

  calculateSalesByCollection() {
    const collections = {};
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
        totalQuantity += item.quantity;
      });
    });

    // Calculate percentages
    Object.keys(collections).forEach(collection => {
      collections[collection].averagePrice =
        collections[collection].revenue / collections[collection].quantity;
      collections[collection].percentageRevenue =
        (collections[collection].revenue / this.totalSales) * 100;
      collections[collection].percentageQuantity =
        (collections[collection].quantity / totalQuantity) * 100;
    });

    return collections;
  }

  calculateSalesByCustomerSegment() {
    return {
      b2b: {
        total: this.totalB2B,
        orders: this.b2bOrders.length,
        averagePrice: this.totalB2B / this.b2bOrders.length,
        percentageSales: (this.totalB2B / this.totalRevenue) * 100,
      },
      b2c: {
        total: this.totalB2C,
        orders: this.b2cOrders.length,
        averagePrice: this.totalB2C / this.b2cOrders.length,
        percentageSales: (this.totalB2C / this.totalRevenue) * 100,
      },
    };
  }
  aggregateProductData() {
    const products = {};
    let totalQuantity = 0;

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
        totalQuantity += item.quantity;
      });
    });

    return Object.values(products).map(product => ({
      ...product,
      averagePrice: product.revenue / product.quantity,
      percentageOfSales: Number(((product.revenue / this.totalSales) * 100).toFixed(1)),
      percentageOfQuantity: Number(((product.quantity / totalQuantity) * 100).toFixed(1)),
    }));
  }

  calculateBestSellersByQuantity() {
    return [...this.aggregatedProducts]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }

  calculateBestSellersBySales() {
    return [...this.aggregatedProducts]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  calculateLowestSellersByQuantity() {
    return [...this.aggregatedProducts]
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 5);
  }

  calculateLowestSellersBySales() {
    return [...this.aggregatedProducts]
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, 5);
  }

  calculateAverageItemsPerOrder() {
    const totalItems = this.orders.reduce((sum, order) =>
      sum + order.orderItems.filter(item => !item.isComplimentary)
        .reduce((itemSum, item) => itemSum + item.quantity, 0), 0,
    );
    return totalItems / this.orders.length;
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
      (sum, order) => sum + (order.deliveryFee || 0),
      0,
    );

    const totalCost = deliveryOrders.reduce(
      (sum, order) => sum + (order.deliveryCost || 0),
      0,
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
