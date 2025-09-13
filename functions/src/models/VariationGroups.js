const { generateId } = require('../utils/helpers');

/**
 * @typedef {Object} DimensionOption
 * @property {string} name - Display name of the option (e.g., "Small", "Medium", "Large")
 * @property {number} value - Numeric value (e.g., weight in grams, quantity)
 * @property {boolean} [isWholeGrain] - Whether this option is whole grain
 * @property {number} [displayOrder] - Order for display/sorting (calculated if not provided)
 */

/**
 * @typedef {Object} Dimension
 * @property {string} id - Unique identifier for this dimension (to support multiple same-type dimensions)
 * @property {string} type - Dimension type (WEIGHT, QUANTITY, SIZE, FLAVOR, etc.)
 * @property {string} label - Human-readable label for UI display
 * @property {string} [unit] - Unit of measurement for all options in this dimension (e.g., "g", "kg", "pcs")
 * @property {DimensionOption[]} options - Array of available options for this dimension
 * @property {number} [displayOrder] - Order for display/sorting
 */

/**
 * @typedef {Object} Combination
 * @property {string} id - Unique identifier for the combination
 * @property {string[]} selection - Array of selected option names, one from each dimension
 * @property {string} name - Display name for the combination (auto-generated if not provided)
 * @property {number} [basePrice] - Selling price for this combination
 * @property {number} [costPrice] - Cost price for this combination
 * @property {boolean} [isActive] - Whether this combination is available (default: true)
 * @property {boolean} [isWholeGrain] - Whether this combination is whole grain (auto-calculated)
 */

class VariationGroups {
  /**
   * Create a VariationGroups instance
   * @param {Object} options
   * @param {Dimension[]} [options.dimensions=[]] - Array of dimension definitions
   * @param {Combination[]} [options.combinations=[]] - Array of price combinations
   */
  constructor({ dimensions = [], combinations = [] } = {}) {
    // Ensure dimensions have id, displayOrder, and proper option handling
    this.dimensions = dimensions.map((dim, index) => ({
      ...dim,
      id: dim.id || generateId(),
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
   * @param {string} [unit] - Unit of measurement for this dimension
   * @param {number} [displayOrder] - Display order for the dimension
   * @param {string} [id] - Dimension ID (generated if not provided)
   * @returns {string} - The dimension ID
   */
  addDimension(type, label, options = [], unit, displayOrder, id) {
    const processedOptions = options.map((opt, index) => ({
      ...opt,
      displayOrder: opt.displayOrder !== undefined ? opt.displayOrder : this.calculateDisplayOrder(opt),
      isWholeGrain: opt.isWholeGrain || false,
    }));

    const dimensionId = id || generateId();
    const dimDisplayOrder = displayOrder !== undefined ? displayOrder : this.dimensions.length;

    // Check if dimension with this ID already exists
    const existingIndex = this.dimensions.findIndex(d => d.id === dimensionId);

    const dimensionData = {
      id: dimensionId,
      type,
      label,
      unit,
      options: processedOptions,
      displayOrder: dimDisplayOrder,
    };

    if (existingIndex !== -1) {
      this.dimensions[existingIndex] = dimensionData;
    } else {
      this.dimensions.push(dimensionData);
    }

    return dimensionId;
  }

  /**
   * Add option to existing dimension
   * @param {string} dimensionId - Dimension ID
   * @param {Object} option - Option to add {name, value, isWholeGrain?, displayOrder?, etc.}
   */
  addOptionToDimension(dimensionId, option) {
    const dimension = this.dimensions.find(d => d.id === dimensionId);
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
          id: generateId(),
          type: v.type,
          label: v.type,
          unit: v.unit || '',
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
          isWholeGrain: v.isWholeGrain || false,
          displayOrder: v.displayOrder !== undefined ? v.displayOrder : (v.isWholeGrain ? 2 : 1),
        });
      }

      // Create combination for this single variation
      combinations.push({
        id: v.id,
        selection: [v.name],
        name: v.name,
        basePrice: v.basePrice,
        costPrice: v.costPrice,
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
   * Helper to find which dimension contains an option
   */
  getDimensionForOption(optionName) {
    return this.dimensions.find(dim =>
      dim.options.some(opt => opt.name === optionName),
    );
  }

  /**
   * Helper to find dimension by ID
   */
  getDimensionById(dimensionId) {
    return this.dimensions.find(dim => dim.id === dimensionId);
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
   * @param {string} dimensionId - The dimension ID
   * @returns {Array} - Sorted options or empty array
   */
  getSortedOptions(dimensionId) {
    const dimension = this.dimensions.find(d => d.id === dimensionId);
    if (!dimension) return [];

    return [...dimension.options].sort((a, b) =>
      (a.displayOrder || 0) - (b.displayOrder || 0),
    );
  }

  /**
   * Get sorted options for a dimension by type (legacy support)
   * @param {string} dimensionType - The dimension type
   * @returns {Array} - Sorted options or empty array (from first matching dimension)
   */
  getSortedOptionsByType(dimensionType) {
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
   * @param {string} dimensionId - The dimension ID
   * @param {number} displayOrder - New display order
   */
  setDimensionDisplayOrder(dimensionId, displayOrder) {
    const dimension = this.dimensions.find(d => d.id === dimensionId);
    if (dimension) {
      dimension.displayOrder = displayOrder;
    }
  }

  /**
   * Update display order for an option
   * @param {string} dimensionId - The dimension ID
   * @param {string} optionName - The option name
   * @param {number} displayOrder - New display order
   */
  setOptionDisplayOrder(dimensionId, optionName, displayOrder) {
    const dimension = this.dimensions.find(d => d.id === dimensionId);
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

/*
Example Firestore Document Structure:

{
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z",

  "dimensions": [
    {
      "id": "dim_abc123",
      "type": "WEIGHT",
      "label": "Cake Weight",
      "unit": "g",
      "displayOrder": 0,
      "options": [
        {
          "name": "small",
          "value": 500,
          "isWholeGrain": false,
          "displayOrder": 1
        },
        {
          "name": "large",
          "value": 1000,
          "isWholeGrain": false,
          "displayOrder": 2
        }
      ]
    },
    {
      "id": "dim_def456",
      "type": "FLAVOR",
      "label": "Flavor",
      "displayOrder": 1,
      "options": [
        {"name": "chocolate", "value": 1, "displayOrder": 1},
        {"name": "vanilla", "value": 1, "displayOrder": 2}
      ]
    }
  ],
  "combinations": [
    {
      "id": "combo_xyz789",
      "selection": ["small", "chocolate"],
      "name": "small + chocolate",
      "basePrice": 150,
      "costPrice": 80,
      "isActive": true,
      "isWholeGrain": false
    },
    {
      "id": "combo_abc987",
      "selection": ["large", "vanilla"],
      "name": "large + vanilla",
      "basePrice": 250,
      "costPrice": 120,
      "isActive": true,
      "isWholeGrain": false
    }
  ]
}
*/

module.exports = VariationGroups;
