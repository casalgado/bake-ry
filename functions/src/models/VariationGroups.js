const { generateId } = require('../utils/helpers');

/**
 * @typedef {Object} DimensionOption
 * @property {string} name - Display name of the option (e.g., "Small", "Medium", "Large")
 * @property {number} value - Numeric value (e.g., weight in grams, quantity)
 * @property {string} [unit] - Unit of measurement (e.g., "g", "kg", "pcs")
 * @property {boolean} [isWholeGrain] - Whether this option is whole grain
 * @property {number} [displayOrder] - Order for display/sorting (calculated if not provided)
 */

/**
 * @typedef {Object} Dimension
 * @property {string} type - Dimension type (WEIGHT, QUANTITY, SIZE, FLAVOR, etc.)
 * @property {string} label - Human-readable label for UI display
 * @property {DimensionOption[]} options - Array of available options for this dimension
 * @property {number} [displayOrder] - Order for display/sorting
 */

/**
 * @typedef {Object} Combination
 * @property {string} id - Unique identifier for the combination
 * @property {string[]} selection - Array of selected option names, one from each dimension
 * @property {string} name - Display name for the combination (auto-generated if not provided)
 * @property {number} basePrice - Selling price for this combination
 * @property {number} [costPrice] - Cost price for this combination
 * @property {boolean} [isActive] - Whether this combination is available (default: true)
 * @property {boolean} [isWholeGrain] - Whether this combination is whole grain (auto-calculated)
 */

class VariationGroups {
  constructor({ dimensions = [], combinations = [] } = {}) {
    // Ensure dimensions have displayOrder
    this.dimensions = dimensions.map((dim, index) => ({
      ...dim,
      displayOrder: dim.displayOrder !== undefined ? dim.displayOrder : index,
      options: dim.options?.map((opt, optIndex) => ({
        ...opt,
        displayOrder: opt.displayOrder !== undefined ? opt.displayOrder : this.calculateDisplayOrder(opt),
        isWholeGrain: opt.isWholeGrain || false,
      })) || [],
    }));

    this.combinations = combinations.map(combo => ({
      ...combo,
      id: combo.id || generateId(),
      isWholeGrain: combo.isWholeGrain || false,
    }));
  }

  /**
   * Get price for a specific combination by ID
   * @param {string} combinationId - The combination ID
   * @returns {Object} - {totalPrice, totalCost, profit, profitMargin}
   */
  getCombinationPrice(combinationId) {
    const combination = this.combinations.find(c => c.id === combinationId);
    if (!combination) {
      return { totalPrice: 0, totalCost: 0, profit: 0, profitMargin: 0 };
    }

    const totalPrice = combination.basePrice || 0;
    const totalCost = combination.costPrice || 0;
    const profit = totalPrice - totalCost;
    const profitMargin = totalPrice > 0 ? ((profit / totalPrice) * 100).toFixed(2) : 0;

    return { totalPrice, totalCost, profit, profitMargin };
  }

  /**
   * Find a combination by ID
   * @param {string} combinationId - The combination ID to find
   * @returns {Object|null} - The found combination or null
   */
  findCombinationById(combinationId) {
    return this.combinations.find(c => c.id === combinationId) || null;
  }

  /**
   * Calculate display order based on option properties (similar to ProductVariation)
   * @param {Object} option - Option object
   * @returns {number} - Calculated display order
   */
  calculateDisplayOrder(option) {
    if (option.displayOrder !== undefined) return option.displayOrder;
    if (option.name && option.name.trim().toLowerCase() === 'otra') return 999;
    if (option.isWholeGrain) return 2;
    return 1;
  }

  /**
   * Add a new dimension
   * @param {string} type - Dimension type (WEIGHT, QUANTITY, SIZE, etc.)
   * @param {string} label - Display label for the dimension
   * @param {Array} options - Array of options for this dimension
   * @param {number} displayOrder - Display order for the dimension
   */
  addDimension(type, label, options = [], displayOrder) {
    const processedOptions = options.map((opt, index) => ({
      ...opt,
      displayOrder: opt.displayOrder !== undefined ? opt.displayOrder : this.calculateDisplayOrder(opt),
      isWholeGrain: opt.isWholeGrain || false,
    }));

    const existingIndex = this.dimensions.findIndex(d => d.type === type);
    const dimDisplayOrder = displayOrder !== undefined ? displayOrder : this.dimensions.length;

    if (existingIndex !== -1) {
      this.dimensions[existingIndex] = {
        type,
        label,
        options: processedOptions,
        displayOrder: dimDisplayOrder,
      };
    } else {
      this.dimensions.push({
        type,
        label,
        options: processedOptions,
        displayOrder: dimDisplayOrder,
      });
    }
  }

  /**
   * Add option to existing dimension
   * @param {string} type - Dimension type
   * @param {Object} option - Option to add {name, value, unit?, isWholeGrain?, displayOrder?, etc.}
   */
  addOptionToDimension(type, option) {
    const dimension = this.dimensions.find(d => d.type === type);
    if (dimension) {
      const processedOption = {
        ...option,
        displayOrder: option.displayOrder !== undefined ? option.displayOrder : this.calculateDisplayOrder(option),
        isWholeGrain: option.isWholeGrain || false,
      };
      dimension.options.push(processedOption);
      // Sort options by displayOrder after adding
      dimension.options.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }
  }

  /**
   * Generate all possible combinations from dimensions
   * @returns {Array} - Array of all possible selection combinations
   */
  generateAllCombinations() {
    if (this.dimensions.length === 0) return [];

    const combinations = [];
    const generateCombos = (dimensionIndex, currentSelection) => {
      if (dimensionIndex >= this.dimensions.length) {
        combinations.push([...currentSelection]);
        return;
      }

      const dimension = this.dimensions[dimensionIndex];
      for (const option of dimension.options) {
        currentSelection.push(option.name);
        generateCombos(dimensionIndex + 1, currentSelection);
        currentSelection.pop();
      }
    };

    generateCombos(0, []);
    return combinations;
  }

  /**
   * Set price for a specific combination
   * @param {string} combinationId - Combination ID
   * @param {Object} priceData - {basePrice, costPrice}
   */
  setCombinationPrice(combinationId, priceData) {
    const combination = this.combinations.find(c => c.id === combinationId);
    if (combination) {
      combination.basePrice = priceData.basePrice;
      combination.costPrice = priceData.costPrice;
    }
  }

  /**
   * Add a new combination
   * @param {Array} selection - Array of option names selected
   * @param {Object} priceData - {basePrice, costPrice, name?, isActive?, isWholeGrain?}
   * @returns {string} - The new combination ID
   */
  addCombination(selection, priceData) {
    const combinationId = generateId();
    const name = priceData.name || this.generateCombinationName(selection);

    // Determine if combination is wholegrain based on any selected option being wholegrain
    let isWholeGrain = priceData.isWholeGrain;
    if (isWholeGrain === undefined) {
      isWholeGrain = selection.some(optName => {
        const option = this.getOptionFromDimensions(optName);
        return option?.isWholeGrain || false;
      });
    }

    this.combinations.push({
      id: combinationId,
      selection,
      name,
      basePrice: priceData.basePrice || 0,
      costPrice: priceData.costPrice || 0,
      isActive: priceData.isActive !== undefined ? priceData.isActive : true,
      isWholeGrain,
    });

    return combinationId;
  }

  /**
   * Generate a display name for a combination
   * @param {Array} selection - Array of selected option names
   * @returns {string} - Generated name
   */
  generateCombinationName(selection) {
    return selection.join(' + ');
  }

  /**
   * Convert from legacy flat array format
   * @param {Array} flatVariations - Legacy flat array of variations
   * @returns {VariationGroups} - New VariationGroups instance
   */
  static fromLegacyVariations(flatVariations) {
    // Group legacy variations by type to create dimensions
    const dimensionsMap = {};
    const combinations = [];
    const dimensionDisplayOrders = {};

    flatVariations.forEach(v => {
      const dimensionKey = v.type;

      // Create dimension if it doesn't exist
      if (!dimensionsMap[dimensionKey]) {
        dimensionsMap[dimensionKey] = {
          type: v.type,
          label: v.type,
          options: [],
          displayOrder: dimensionDisplayOrders[v.type] || Object.keys(dimensionsMap).length,
        };
      }

      // Add option to dimension (if not already present)
      const existingOption = dimensionsMap[dimensionKey].options.find(opt => opt.name === v.name);
      if (!existingOption) {
        dimensionsMap[dimensionKey].options.push({
          name: v.name,
          value: v.value,
          unit: v.unit || '',
          isWholeGrain: v.isWholeGrain || false,
          displayOrder: v.displayOrder !== undefined ? v.displayOrder : (v.isWholeGrain ? 2 : 1),
        });
      }

      // Create combination for this single variation
      combinations.push({
        id: v.id,
        selection: [v.name],
        name: v.name,
        basePrice: v.basePrice || 0,
        costPrice: v.costPrice || 0,
        isActive: true,
        isWholeGrain: v.isWholeGrain || false,
      });
    });

    // Sort options within each dimension by displayOrder
    Object.values(dimensionsMap).forEach(dim => {
      dim.options.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    });

    return new VariationGroups({
      dimensions: Object.values(dimensionsMap).sort((a, b) =>
        (a.displayOrder || 0) - (b.displayOrder || 0),
      ),
      combinations,
    });
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object} - Plain object representation
   */
  toPlainObject() {
    return {
      dimensions: this.dimensions,
      combinations: this.combinations,
    };
  }

  /**
   * Convert to flat array for Firestore (backward compatibility)
   * @returns {Array} - Flat array of variations
   */
  toFirestoreArray() {
    // Convert combinations back to flat ProductVariation-like objects
    const flat = [];

    this.combinations.forEach(combo => {
      // For single-dimension selections, create a simple variation
      if (combo.selection.length === 1) {
        const dimensionType = this.getDimensionForOption(combo.selection[0])?.type || 'SIZE';
        const dimensionOption = this.getOptionFromDimensions(combo.selection[0]);

        flat.push({
          id: combo.id,
          name: combo.selection[0],
          value: dimensionOption?.value || 0,
          basePrice: combo.basePrice,
          costPrice: combo.costPrice,
          type: dimensionType,
          unit: dimensionOption?.unit || '',
          isWholeGrain: combo.isWholeGrain || dimensionOption?.isWholeGrain || false,
          displayOrder: dimensionOption?.displayOrder || this.calculateDisplayOrder(dimensionOption || {}),
        });
      }
    });

    // Sort by displayOrder
    return flat.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  }

  /**
   * Helper to find which dimension contains an option
   */
  getDimensionForOption(optionName) {
    return this.dimensions.find(dim =>
      dim.options.some(opt => opt.name === optionName),
    );
  }

  /**
   * Helper to get option details from dimensions
   */
  getOptionFromDimensions(optionName) {
    for (const dimension of this.dimensions) {
      const option = dimension.options.find(opt => opt.name === optionName);
      if (option) return option;
    }
    return null;
  }

  /**
   * Validate the structure
   * @returns {Array} - Array of validation errors (empty if valid)
   */
  validate() {
    const errors = [];

    // Validate dimensions
    this.dimensions.forEach((dimension, dimIndex) => {
      if (!dimension.type) {
        errors.push(`Dimension ${dimIndex}: type is required`);
      }
      if (!dimension.options || !Array.isArray(dimension.options)) {
        errors.push(`Dimension ${dimIndex}: options must be an array`);
      }
    });

    // Validate combinations
    this.combinations.forEach((combination, comboIndex) => {
      if (!combination.selection || !Array.isArray(combination.selection)) {
        errors.push(`Combination ${comboIndex}: selection must be an array`);
      }
      if (combination.basePrice === undefined || combination.basePrice < 0) {
        errors.push(`Combination ${comboIndex}: basePrice must be non-negative`);
      }
      if (combination.costPrice !== undefined && combination.costPrice < 0) {
        errors.push(`Combination ${comboIndex}: costPrice must be non-negative`);
      }
    });

    return errors;
  }

  /**
   * Check if there are any variations
   * @returns {boolean} - True if has variations
   */
  hasVariations() {
    return this.combinations.length > 0;
  }

  /**
   * Get total number of combinations
   * @returns {number} - Total combination count
   */
  getTotalCombinationCount() {
    return this.combinations.length;
  }

  /**
   * Check if all combinations have prices set
   * @returns {boolean} - True if all combinations have prices
   */
  allCombinationsHavePrices() {
    return this.combinations.every(combo =>
      combo.basePrice !== undefined && combo.basePrice >= 0,
    );
  }

  /**
   * Get sorted dimensions by display order
   * @returns {Array} - Sorted dimensions
   */
  getSortedDimensions() {
    return [...this.dimensions].sort((a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0),
    );
  }

  /**
   * Get sorted options for a dimension
   * @param {string} dimensionType - The dimension type
   * @returns {Array} - Sorted options or empty array
   */
  getSortedOptions(dimensionType) {
    const dimension = this.dimensions.find(d => d.type === dimensionType);
    if (!dimension) return [];

    return [...dimension.options].sort((a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0),
    );
  }

  /**
   * Get all wholegrain combinations
   * @returns {Array} - Array of wholegrain combinations
   */
  getWholeGrainCombinations() {
    return this.combinations.filter(combo => combo.isWholeGrain);
  }

  /**
   * Update display order for a dimension
   * @param {string} dimensionType - The dimension type
   * @param {number} displayOrder - New display order
   */
  setDimensionDisplayOrder(dimensionType, displayOrder) {
    const dimension = this.dimensions.find(d => d.type === dimensionType);
    if (dimension) {
      dimension.displayOrder = displayOrder;
    }
  }

  /**
   * Update display order for an option
   * @param {string} dimensionType - The dimension type
   * @param {string} optionName - The option name
   * @param {number} displayOrder - New display order
   */
  setOptionDisplayOrder(dimensionType, optionName, displayOrder) {
    const dimension = this.dimensions.find(d => d.type === dimensionType);
    if (dimension) {
      const option = dimension.options.find(opt => opt.name === optionName);
      if (option) {
        option.displayOrder = displayOrder;
        // Re-sort options
        dimension.options.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      }
    }
  }
}

module.exports = VariationGroups;
