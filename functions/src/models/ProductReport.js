// models/ProductReport.js
//
// NEW 3-Step Pipeline Architecture:
// Step 1: flattenOrderItems - Convert complex order structure to simple flat array
// Step 2: groupByPeriods - Group flattened data by time periods (if needed)
// Step 3: transformToOutput - Aggregate and format based on options
//
// NOTE: item.subtotal is always post-tax (includes tax in both inclusive and exclusive tax modes).

const { Order } = require('./Order');
const { getDateInColombia } = require('../utils/dateUtils');

class ProductReport {
  constructor(orders, b2b_clients, all_products, options = {}) {
    // Validate required inputs
    this.validateInputs(orders, b2b_clients, all_products);

    // Validate and set options
    this.options = this.validateOptions(options);

    // Convert orders to Order instances and filter out complimentary
    this.allOrders = orders.map(order => order instanceof Order ? order : new Order(order))
      .filter(order => !order.isComplimentary);

    // Store data for processing
    this.b2b_clients = b2b_clients;
    this.all_products = all_products;
  }

  generateReport() {
    // Step 1: Flatten orders to granular level
    const step1_flattened = this.flattenOrderItems(this.allOrders, this.b2b_clients);

    // Step 2: Aggregate by combination - Group and aggregate with period calculations
    const step2_aggregated = this.aggregateByCombination(step1_flattened);

    // Step 3: Transform to final output - Apply all filtering and formatting
    const step3_transformed = this.transformToOutput(step2_aggregated);

    return {
      metadata: {
        ...this.generateMetadata(),
        intermediateData: {
          step1_flattened: step1_flattened,
          step2_aggregated: step2_aggregated,
          step3_transformed: step3_transformed,
        },
      },
      products: step3_transformed,
      summary: this.generateSummary(step3_transformed),
    };
  }

  generateMetadata() {
    const dates = this.allOrders.map(order => new Date(order[this.options.dateField]));
    const validDates = dates.filter(d => !isNaN(d.getTime()));

    return {
      options: this.options,
      totalOrders: this.allOrders.length,
      dateRange: validDates.length > 0 ? {
        start: new Date(Math.min(...validDates)),
        end: new Date(Math.max(...validDates)),
      } : null,
      totalProducts: 0, // TODO: Calculate from processed data
      currency: 'COP',
    };
  }

  validateInputs(orders, b2b_clients, all_products) {
    if (orders === null || orders === undefined) {
      throw new Error('Orders array is required');
    }
    if (!Array.isArray(orders)) {
      throw new Error('Orders must be an array');
    }

    if (b2b_clients === null || b2b_clients === undefined) {
      throw new Error('B2B clients array is required');
    }
    if (!Array.isArray(b2b_clients)) {
      throw new Error('B2B clients must be an array');
    }

    if (all_products === null || all_products === undefined) {
      throw new Error('Products array is required');
    }
    if (!Array.isArray(all_products)) {
      throw new Error('Products must be an array');
    }
  }

  validateOptions(options) {
    const validatedOptions = {
      categories: options.categories || null,
      detailLevel: options.detailLevel || 'product',
      period: options.period || null,
      metrics: options.metrics || 'both',
      segment: options.segment || 'none',
      dateField: options.dateField || 'dueDate',
      defaultDateRangeApplied: options.defaultDateRangeApplied || false,
    };

    // Validate detailLevel
    if (!['product', 'combination'].includes(validatedOptions.detailLevel)) {
      throw new Error('Invalid detailLevel: must be "product" or "combination"');
    }

    // Validate period
    if (validatedOptions.period !== null && !['daily', 'weekly', 'monthly'].includes(validatedOptions.period)) {
      throw new Error('Invalid period: must be null, "daily", "weekly", or "monthly"');
    }

    // Validate metrics
    if (!['ingresos', 'cantidad', 'both'].includes(validatedOptions.metrics)) {
      throw new Error('Invalid metrics: must be "ingresos", "cantidad", or "both"');
    }

    // Validate segment
    if (!['none', 'all', 'b2b', 'b2c'].includes(validatedOptions.segment)) {
      throw new Error('Invalid segment: must be "none", "all", "b2b", or "b2c"');
    }

    // Validate dateField
    const validDateFields = ['dueDate', 'paymentDate', 'preparationDate', 'createdAt', 'updatedAt'];
    if (!validDateFields.includes(validatedOptions.dateField)) {
      throw new Error('Invalid dateField: must be a valid order date property');
    }

    // Validate categories
    if (validatedOptions.categories !== null) {
      if (!Array.isArray(validatedOptions.categories)) {
        throw new Error('Invalid categories: must be an array or null');
      }
      if (validatedOptions.categories.length === 0) {
        throw new Error('Invalid categories: array cannot be empty');
      }
    }

    return validatedOptions;
  }

  flattenOrderItems(orders, b2bClients) {
    const b2bClientIds = new Set(b2bClients.map(client => client.id));
    const flattenedItems = [];

    orders.forEach(order => {
      const isB2B = b2bClientIds.has(order.userId);
      const orderDate = order[this.options.dateField];

      order.orderItems
        .filter(item => !item.isComplimentary)
        .forEach(item => {
          flattenedItems.push({
            // Identifiers
            orderId: order.id,
            orderItemId: item.id,

            // Dimensions
            productId: item.productId,
            combinationId: item.combination?.id || null,
            categoryId: item.collectionId,
            date: getDateInColombia(orderDate),
            isB2B: isB2B,

            // Metrics
            ingresos: item.subtotal,
            cantidad: item.quantity,
            currentPrice: item.currentPrice,

            // Metadata
            productName: item.productName,
            categoryName: item.collectionName,
            combinationName: item.combination?.name || null,
          });
        });
    });

    return flattenedItems;
  }

  aggregateByCombination(flatData) {
    // Group by combination key: productId + combinationId
    const groups = {};

    flatData.forEach(item => {
      const key = `${item.productId}_${item.combinationId || 'base'}`;

      if (!groups[key]) {
        groups[key] = {
          productId: item.productId,
          combinationId: item.combinationId,
          productName: item.productName,
          combinationName: item.combinationName,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          items: [],
        };
      }

      groups[key].items.push(item);
    });

    // Calculate aggregate metrics for each group
    return Object.values(groups).map(group => {
      const metrics = this.calculateAggregateMetrics(group.items);
      const periods = this.calculatePeriodMetrics(group.items);

      const result = {
        ...group,
        ...metrics,
      };

      // Only add periods if period option is set
      if (periods) {
        result.periods = periods;
      }

      return result;
    });
  }

  calculateAggregateMetrics(items) {
    let ingresos = 0;
    let cantidad = 0;
    let b2bIngresos = 0;
    let b2cIngresos = 0;
    let b2bCantidad = 0;
    let b2cCantidad = 0;

    items.forEach(item => {
      ingresos += item.ingresos;
      cantidad += item.cantidad;

      if (item.isB2B) {
        b2bIngresos += item.ingresos;
        b2bCantidad += item.cantidad;
      } else {
        b2cIngresos += item.ingresos;
        b2cCantidad += item.cantidad;
      }
    });

    return {
      ingresos,
      cantidad,
      b2bIngresos,
      b2cIngresos,
      b2bCantidad,
      b2cCantidad,
    };
  }

  generatePeriodKey(dateString) {
    if (!this.options.period) return null;

    const date = new Date(dateString + 'T12:00:00Z'); // Noon UTC to avoid timezone issues

    switch (this.options.period) {
    case 'daily':
      return dateString;

    case 'weekly': {
      // Find Monday of the week (Monday = 1, Sunday = 0)
      const dayOfWeek = date.getUTCDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday is 0, so offset is -6

      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() + mondayOffset);

      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}-${String(monday.getUTCDate()).padStart(2, '0')}/${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth() + 1).padStart(2, '0')}-${String(sunday.getUTCDate()).padStart(2, '0')}`;
    }

    case 'monthly':
      return dateString.substring(0, 7); // "2026-03-21" -> "2026-03"

    default:
      return null;
    }
  }

  calculatePeriodMetrics(items) {
    if (!this.options.period) return null;

    const periodGroups = {};

    items.forEach(item => {
      const periodKey = this.generatePeriodKey(item.date);

      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = [];
      }

      periodGroups[periodKey].push(item);
    });

    // Calculate metrics for each period
    const periods = {};
    Object.entries(periodGroups).forEach(([periodKey, periodItems]) => {
      periods[periodKey] = this.calculateAggregateMetrics(periodItems);
    });

    return periods;
  }

  // Full pipeline for production use
  transformToOutput(combinationData) {
    let result = combinationData.map(item => {
      // Deep copy to avoid mutating original data
      const transformed = JSON.parse(JSON.stringify(item));

      // Apply segment filtering
      ProductReport.applySegmentFiltering(transformed, this.options.segment);

      // Apply metrics filtering
      ProductReport.applyMetricsFiltering(transformed, this.options.metrics);

      return transformed;
    });

    // Apply detail level grouping
    result = ProductReport.applyDetailLevelGrouping(result, this.options.detailLevel);

    // Apply category filtering
    result = ProductReport.applyCategoryFiltering(result, this.options.categories);

    // Apply final formatting
    result = ProductReport.applyFinalFormatting(result);

    return result;
  }

  static applySegmentFiltering(item, segment) {
    switch (segment) {
    case 'none':
      // Keep only total metrics, remove segment breakdown
      delete item.b2bIngresos;
      delete item.b2cIngresos;
      delete item.b2bCantidad;
      delete item.b2cCantidad;

      // Apply to periods as well
      if (item.periods) {
        Object.values(item.periods).forEach(period => {
          delete period.b2bIngresos;
          delete period.b2cIngresos;
          delete period.b2bCantidad;
          delete period.b2cCantidad;
        });
      }
      break;

    case 'all':
      // Keep everything (totals + segment breakdown)
      break;

    case 'b2b':
      // Replace totals with B2B values, remove segment properties
      item.ingresos = item.b2bIngresos;
      item.cantidad = item.b2bCantidad;
      delete item.b2bIngresos;
      delete item.b2cIngresos;
      delete item.b2bCantidad;
      delete item.b2cCantidad;

      // Apply to periods
      if (item.periods) {
        Object.values(item.periods).forEach(period => {
          period.ingresos = period.b2bIngresos || 0;
          period.cantidad = period.b2bCantidad || 0;
          delete period.b2bIngresos;
          delete period.b2cIngresos;
          delete period.b2bCantidad;
          delete period.b2cCantidad;
        });
      }
      break;

    case 'b2c':
      // Replace totals with B2C values, remove segment properties
      item.ingresos = item.b2cIngresos;
      item.cantidad = item.b2cCantidad;
      delete item.b2bIngresos;
      delete item.b2cIngresos;
      delete item.b2bCantidad;
      delete item.b2cCantidad;

      // Apply to periods
      if (item.periods) {
        Object.values(item.periods).forEach(period => {
          period.ingresos = period.b2cIngresos || 0;
          period.cantidad = period.b2cCantidad || 0;
          delete period.b2bIngresos;
          delete period.b2cIngresos;
          delete period.b2bCantidad;
          delete period.b2cCantidad;
        });
      }
      break;
    }
  }

  static applyMetricsFiltering(item, metrics) {
    switch (metrics) {
    case 'ingresos':
      // Keep only revenue fields (remove quantity fields if they exist)
      if (Object.prototype.hasOwnProperty.call(item, 'cantidad')) delete item.cantidad;
      if (Object.prototype.hasOwnProperty.call(item, 'b2bCantidad')) delete item.b2bCantidad;
      if (Object.prototype.hasOwnProperty.call(item, 'b2cCantidad')) delete item.b2cCantidad;

      // Apply to periods
      if (item.periods) {
        Object.values(item.periods).forEach(period => {
          if (Object.prototype.hasOwnProperty.call(period, 'cantidad')) delete period.cantidad;
          if (Object.prototype.hasOwnProperty.call(period, 'b2bCantidad')) delete period.b2bCantidad;
          if (Object.prototype.hasOwnProperty.call(period, 'b2cCantidad')) delete period.b2cCantidad;
        });
      }
      break;

    case 'cantidad':
      // Keep only quantity fields (remove revenue fields if they exist)
      if (Object.prototype.hasOwnProperty.call(item, 'ingresos')) delete item.ingresos;
      if (Object.prototype.hasOwnProperty.call(item, 'b2bIngresos')) delete item.b2bIngresos;
      if (Object.prototype.hasOwnProperty.call(item, 'b2cIngresos')) delete item.b2cIngresos;

      // Apply to periods
      if (item.periods) {
        Object.values(item.periods).forEach(period => {
          if (Object.prototype.hasOwnProperty.call(period, 'ingresos')) delete period.ingresos;
          if (Object.prototype.hasOwnProperty.call(period, 'b2bIngresos')) delete period.b2bIngresos;
          if (Object.prototype.hasOwnProperty.call(period, 'b2cIngresos')) delete period.b2cIngresos;
        });
      }
      break;

    case 'both':
      // Keep everything
      break;
    }
  }

  static applyDetailLevelGrouping(items, detailLevel) {
    if (detailLevel === 'combination') {
      // Keep as-is, return all combinations
      return items;
    }

    // Group by productId for product-level aggregation
    const productGroups = {};

    items.forEach(item => {
      const productId = item.productId;

      if (!productGroups[productId]) {
        productGroups[productId] = {
          productId: item.productId,
          combinationId: null,
          productName: item.productName,
          combinationName: null,
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          items: [],
        };
      }

      productGroups[productId].items.push(item);
    });

    // Aggregate each product group
    return Object.values(productGroups).map(group => {
      const aggregated = ProductReport.aggregateProductItems(group.items);

      return {
        ...group,
        ...aggregated,
      };
    });
  }

  static aggregateProductItems(items) {
    // Check which fields exist in the first item to determine what to aggregate
    const firstItem = items[0];

    // Aggregate total metrics
    let ingresos = 0;
    let cantidad = 0;
    let b2bIngresos = 0;
    let b2cIngresos = 0;
    let b2bCantidad = 0;
    let b2cCantidad = 0;

    items.forEach(item => {
      if (Object.prototype.hasOwnProperty.call(item, 'ingresos')) ingresos += item.ingresos || 0;
      if (Object.prototype.hasOwnProperty.call(item, 'cantidad')) cantidad += item.cantidad || 0;
      if (Object.prototype.hasOwnProperty.call(item, 'b2bIngresos')) b2bIngresos += item.b2bIngresos || 0;
      if (Object.prototype.hasOwnProperty.call(item, 'b2cIngresos')) b2cIngresos += item.b2cIngresos || 0;
      if (Object.prototype.hasOwnProperty.call(item, 'b2bCantidad')) b2bCantidad += item.b2bCantidad || 0;
      if (Object.prototype.hasOwnProperty.call(item, 'b2cCantidad')) b2cCantidad += item.b2cCantidad || 0;
    });

    const result = {};

    // Only include fields that exist in the source items
    if (Object.prototype.hasOwnProperty.call(firstItem, 'ingresos')) result.ingresos = ingresos;
    if (Object.prototype.hasOwnProperty.call(firstItem, 'cantidad')) result.cantidad = cantidad;
    if (Object.prototype.hasOwnProperty.call(firstItem, 'b2bIngresos')) result.b2bIngresos = b2bIngresos;
    if (Object.prototype.hasOwnProperty.call(firstItem, 'b2cIngresos')) result.b2cIngresos = b2cIngresos;
    if (Object.prototype.hasOwnProperty.call(firstItem, 'b2bCantidad')) result.b2bCantidad = b2bCantidad;
    if (Object.prototype.hasOwnProperty.call(firstItem, 'b2cCantidad')) result.b2cCantidad = b2cCantidad;

    // Aggregate periods if they exist
    const periodKeys = new Set();
    items.forEach(item => {
      if (item.periods) {
        Object.keys(item.periods).forEach(key => periodKeys.add(key));
      }
    });

    // Always include periods field (even if empty)
    result.periods = {};

    if (periodKeys.size > 0) {
      periodKeys.forEach(periodKey => {
        let periodIngresos = 0;
        let periodCantidad = 0;
        let periodB2bIngresos = 0;
        let periodB2cIngresos = 0;
        let periodB2bCantidad = 0;
        let periodB2cCantidad = 0;

        items.forEach(item => {
          if (item.periods && item.periods[periodKey]) {
            const period = item.periods[periodKey];
            periodIngresos += period.ingresos || 0;
            periodCantidad += period.cantidad || 0;
            periodB2bIngresos += period.b2bIngresos || 0;
            periodB2cIngresos += period.b2cIngresos || 0;
            periodB2bCantidad += period.b2bCantidad || 0;
            periodB2cCantidad += period.b2cCantidad || 0;
          }
        });

        const periodResult = {};

        // Only include period fields that exist in the source items
        if (Object.prototype.hasOwnProperty.call(firstItem, 'ingresos')) periodResult.ingresos = periodIngresos;
        if (Object.prototype.hasOwnProperty.call(firstItem, 'cantidad')) periodResult.cantidad = periodCantidad;
        if (Object.prototype.hasOwnProperty.call(firstItem, 'b2bIngresos')) periodResult.b2bIngresos = periodB2bIngresos;
        if (Object.prototype.hasOwnProperty.call(firstItem, 'b2cIngresos')) periodResult.b2cIngresos = periodB2cIngresos;
        if (Object.prototype.hasOwnProperty.call(firstItem, 'b2bCantidad')) periodResult.b2bCantidad = periodB2bCantidad;
        if (Object.prototype.hasOwnProperty.call(firstItem, 'b2cCantidad')) periodResult.b2cCantidad = periodB2cCantidad;

        result.periods[periodKey] = periodResult;
      });
    }

    return result;
  }

  static applyCategoryFiltering(items, categories) {
    // If no category filter specified, return all items
    if (!categories || categories.length === 0) {
      return items;
    }

    // Filter items where categoryId is in the categories array
    return items.filter(item => categories.includes(item.categoryId));
  }

  static applyFinalFormatting(items) {
    // Apply final transformations to match API response structure
    const formatted = items.map((item) => {
      const result = { ...item };

      // Calculate avgPrice only if both revenue and quantity fields exist
      if (
        Object.prototype.hasOwnProperty.call(result, "ingresos") &&
        Object.prototype.hasOwnProperty.call(result, "cantidad")
      ) {
        const totalRevenue = result.ingresos || 0;
        const totalQuantity = result.cantidad || 0;
        result.avgPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
      }

      // Rename fields to match API response (only if they exist)
      if (Object.prototype.hasOwnProperty.call(result, "ingresos")) {
        result.totalIngresos = result.ingresos;
        delete result.ingresos;
      }
      if (Object.prototype.hasOwnProperty.call(result, "cantidad")) {
        result.totalCantidad = result.cantidad;
        delete result.cantidad;
      }

      // Preserve periods structure (don't rename fields inside periods)
      // Periods already have correct ingresos/cantidad field names

      return result;
    });

    // Sort by totalIngresos descending (if totalIngresos field exists)
    if (
      formatted.length > 0 &&
      Object.prototype.hasOwnProperty.call(formatted[0], "totalIngresos")
    ) {
      formatted.sort((a, b) => (b.totalIngresos || 0) - (a.totalIngresos || 0));
    } else if (
      formatted.length > 0 &&
      Object.prototype.hasOwnProperty.call(formatted[0], "totalCantidad")
    ) {
      // Sort by quantity if revenue not available
      formatted.sort((a, b) => (b.totalCantidad || 0) - (a.totalCantidad || 0));
    }

    return formatted;
  }

  generateSummary(products) {
    const totals = {
      totalIngresos: 0,
      totalCantidad: 0,
    };

    const categoryTotals = {};

    products.forEach(product => {
      const ingresos = product.totalIngresos || 0;
      const cantidad = product.totalCantidad || 0;

      // Add to overall totals
      totals.totalIngresos += ingresos;
      totals.totalCantidad += cantidad;

      // Add B2B/B2C breakdowns if they exist
      if (Object.prototype.hasOwnProperty.call(product, 'b2bIngresos')) {
        if (!Object.prototype.hasOwnProperty.call(totals, 'b2bIngresos')) {
          totals.b2bIngresos = 0;
          totals.b2cIngresos = 0;
          totals.b2bCantidad = 0;
          totals.b2cCantidad = 0;
        }
        totals.b2bIngresos += product.b2bIngresos || 0;
        totals.b2cIngresos += product.b2cIngresos || 0;
        totals.b2bCantidad += product.b2bCantidad || 0;
        totals.b2cCantidad += product.b2cCantidad || 0;
      }

      // Aggregate by category
      const categoryId = product.categoryId;
      const categoryName = product.categoryName;

      if (!categoryTotals[categoryId]) {
        categoryTotals[categoryId] = {
          categoryId,
          categoryName,
          totalIngresos: 0,
          totalCantidad: 0,
        };
      }

      categoryTotals[categoryId].totalIngresos += ingresos;
      categoryTotals[categoryId].totalCantidad += cantidad;
    });

    return {
      totals,
      byCategory: Object.values(categoryTotals),
    };
  }
}

module.exports = ProductReport;
