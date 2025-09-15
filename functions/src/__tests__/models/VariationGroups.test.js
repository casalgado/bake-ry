const VariationGroups = require('../../models/VariationGroups');

describe('VariationGroups', () => {
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const vg = new VariationGroups();
      expect(vg.dimensions).toEqual([]);
      expect(vg.combinations).toEqual([]);
    });

    it('should assign displayOrder to dimensions and options', () => {
      const vg = new VariationGroups({
        dimensions: [
          {
            type: 'SIZE',
            label: 'Size',
            options: [
              { name: 'small', value: 500 },
              { name: 'small wholegrain', value: 500, isWholeGrain: true },
              { name: 'otra', value: 1000 },
            ],
          },
        ],
      });

      expect(vg.dimensions[0].displayOrder).toBe(0);
      expect(vg.dimensions[0].options[0].displayOrder).toBe(1); // normal
      expect(vg.dimensions[0].options[1].displayOrder).toBe(2); // wholegrain
      expect(vg.dimensions[0].options[2].displayOrder).toBe(999); // otra
    });

    it('should preserve isWholeGrain in combinations', () => {
      const vg = new VariationGroups({
        combinations: [
          { selection: ['small'], basePrice: 100 },
          { selection: ['small wholegrain'], basePrice: 100, isWholeGrain: true },
        ],
      });

      expect(vg.combinations[0].isWholeGrain).toBe(false);
      expect(vg.combinations[1].isWholeGrain).toBe(true);
    });
  });

  describe('calculateDisplayOrder', () => {
    let vg;

    beforeEach(() => {
      vg = new VariationGroups();
    });

    it('should return 999 for "otra" option', () => {
      expect(vg.calculateDisplayOrder({ name: 'otra' })).toBe(999);
      expect(vg.calculateDisplayOrder({ name: 'OTRA' })).toBe(999);
      expect(vg.calculateDisplayOrder({ name: ' otra ' })).toBe(999);
    });

    it('should return 2 for wholegrain options', () => {
      expect(vg.calculateDisplayOrder({ isWholeGrain: true })).toBe(2);
    });

    it('should return 1 for normal options', () => {
      expect(vg.calculateDisplayOrder({ name: 'small' })).toBe(1);
      expect(vg.calculateDisplayOrder({})).toBe(1);
    });

    it('should preserve explicit displayOrder', () => {
      expect(vg.calculateDisplayOrder({ displayOrder: 5 })).toBe(5);
      expect(vg.calculateDisplayOrder({ displayOrder: 0 })).toBe(0);
    });
  });

  describe('addDimension', () => {
    let vg;

    beforeEach(() => {
      vg = new VariationGroups();
    });

    it('should add dimension with processed options', () => {
      vg.addDimension('SIZE', 'Size', [
        { name: 'small', value: 500 },
        { name: 'small wholegrain', value: 500, isWholeGrain: true },
      ]);

      expect(vg.dimensions).toHaveLength(1);
      expect(vg.dimensions[0].type).toBe('SIZE');
      expect(vg.dimensions[0].displayOrder).toBe(0);
      expect(vg.dimensions[0].options[0].displayOrder).toBe(1);
      expect(vg.dimensions[0].options[1].displayOrder).toBe(2);
      expect(vg.dimensions[0].options[1].isWholeGrain).toBe(true);
    });

    it('should add multiple dimensions with same type', () => {
      vg.addDimension('SIZE', 'Size', [{ name: 'small', value: 500 }]);
      vg.addDimension('SIZE', 'Updated Size', [{ name: 'large', value: 1000 }]);

      expect(vg.dimensions).toHaveLength(2);
      expect(vg.dimensions[0].label).toBe('Size');
      expect(vg.dimensions[1].label).toBe('Updated Size');
    });

    it('should respect custom displayOrder', () => {
      vg.addDimension('SIZE', 'Size', [], undefined, 10);
      expect(vg.dimensions[0].displayOrder).toBe(10);
    });
  });

  describe('addOptionToDimension', () => {
    let vg;
    let sizeDimensionId;

    beforeEach(() => {
      vg = new VariationGroups({
        dimensions: [{ id: 'size-dim', type: 'SIZE', label: 'Size', options: [] }],
      });
      sizeDimensionId = vg.dimensions[0].id;
    });

    it('should add option with calculated displayOrder', () => {
      vg.addOptionToDimension(sizeDimensionId, { name: 'small', value: 500 });
      vg.addOptionToDimension(sizeDimensionId, { name: 'small wholegrain', value: 500, isWholeGrain: true });
      vg.addOptionToDimension(sizeDimensionId, { name: 'otra', value: 1000 });

      const options = vg.dimensions[0].options;
      expect(options).toHaveLength(3);
      expect(options[0].name).toBe('small'); // displayOrder: 1
      expect(options[1].name).toBe('small wholegrain'); // displayOrder: 2
      expect(options[2].name).toBe('otra'); // displayOrder: 999
    });

    it('should sort options by displayOrder after adding', () => {
      vg.addOptionToDimension(sizeDimensionId, { name: 'otra', value: 1000 });
      vg.addOptionToDimension(sizeDimensionId, { name: 'small', value: 500 });
      vg.addOptionToDimension(sizeDimensionId, { name: 'small wholegrain', value: 500, isWholeGrain: true });

      const options = vg.dimensions[0].options;
      expect(options[0].name).toBe('small'); // displayOrder: 1
      expect(options[1].name).toBe('small wholegrain'); // displayOrder: 2
      expect(options[2].name).toBe('otra'); // displayOrder: 999
    });
  });

  describe('addCombination', () => {
    let vg;

    beforeEach(() => {
      vg = new VariationGroups({
        dimensions: [
          {
            type: 'SIZE',
            label: 'Size',
            options: [
              { name: 'small', value: 500, isWholeGrain: false },
              { name: 'small wholegrain', value: 500, isWholeGrain: true },
            ],
          },
        ],
      });
    });

    it('should detect wholegrain from selected options', () => {
      const id1 = vg.addCombination(['small'], { basePrice: 100 });
      const id2 = vg.addCombination(['small wholegrain'], { basePrice: 100 });

      const combo1 = vg.findCombinationById(id1);
      const combo2 = vg.findCombinationById(id2);

      expect(combo1.isWholeGrain).toBe(false);
      expect(combo2.isWholeGrain).toBe(true);
    });

    it('should respect explicit isWholeGrain value', () => {
      const id = vg.addCombination(['small'], { basePrice: 100, isWholeGrain: true });
      const combo = vg.findCombinationById(id);
      expect(combo.isWholeGrain).toBe(true);
    });
  });

  describe('fromLegacyVariations', () => {
    it('should convert flat variations preserving all fields', () => {
      const flatVariations = [
        {
          id: 'v1',
          name: 'small',
          value: 500,
          basePrice: 100,
          type: 'SIZE',
          isWholeGrain: false,
          displayOrder: 1,
        },
        {
          id: 'v2',
          name: 'small wholegrain',
          value: 500,
          basePrice: 100,
          type: 'SIZE',
          isWholeGrain: true,
          displayOrder: 2,
        },
        {
          id: 'v3',
          name: 'otra',
          value: 1000,
          basePrice: 200,
          type: 'SIZE',
          displayOrder: 999,
        },
      ];

      const vg = VariationGroups.fromLegacyVariations(flatVariations);

      expect(vg.dimensions).toHaveLength(1);
      expect(vg.dimensions[0].type).toBe('SIZE');

      const options = vg.dimensions[0].options;
      expect(options).toHaveLength(3);
      expect(options[0].name).toBe('small');
      expect(options[0].displayOrder).toBe(1);
      expect(options[1].name).toBe('small wholegrain');
      expect(options[1].isWholeGrain).toBe(true);
      expect(options[1].displayOrder).toBe(2);
      expect(options[2].name).toBe('otra');
      expect(options[2].displayOrder).toBe(999);

      expect(vg.combinations).toHaveLength(3);
      expect(vg.combinations[1].isWholeGrain).toBe(true);
    });

    it('should handle missing displayOrder with defaults', () => {
      const flatVariations = [
        { id: 'v1', name: 'small', value: 500, basePrice: 100, type: 'SIZE' },
        { id: 'v2', name: 'small wholegrain', value: 500, basePrice: 100, type: 'SIZE', isWholeGrain: true },
      ];

      const vg = VariationGroups.fromLegacyVariations(flatVariations);

      const options = vg.dimensions[0].options;
      expect(options[0].displayOrder).toBe(1); // default for normal
      expect(options[1].displayOrder).toBe(2); // default for wholegrain
    });
  });

  describe('toFirestoreArray', () => {
    it('should convert to flat array preserving fields', () => {
      const vg = new VariationGroups({
        dimensions: [
          {
            type: 'SIZE',
            label: 'Size',
            options: [
              { name: 'small', value: 500, isWholeGrain: false, displayOrder: 1 },
              { name: 'small wholegrain', value: 500, isWholeGrain: true, displayOrder: 2 },
              { name: 'otra', value: 1000, displayOrder: 999 },
            ],
          },
        ],
        combinations: [
          { id: 'c1', selection: ['small'], basePrice: 100, isWholeGrain: false },
          { id: 'c2', selection: ['small wholegrain'], basePrice: 100, isWholeGrain: true },
          { id: 'c3', selection: ['otra'], basePrice: 200, isWholeGrain: false },
        ],
      });

      const flat = vg.toFirestoreArray();

      expect(flat).toHaveLength(3);
      expect(flat[0].name).toBe('small');
      expect(flat[0].isWholeGrain).toBe(false);
      expect(flat[0].displayOrder).toBe(1);
      expect(flat[1].name).toBe('small wholegrain');
      expect(flat[1].isWholeGrain).toBe(true);
      expect(flat[1].displayOrder).toBe(2);
      expect(flat[2].name).toBe('otra');
      expect(flat[2].displayOrder).toBe(999);
    });

    it('should sort by displayOrder', () => {
      const vg = new VariationGroups({
        dimensions: [
          {
            type: 'SIZE',
            options: [
              { name: 'otra', value: 1000, displayOrder: 999 },
              { name: 'small', value: 500, displayOrder: 1 },
              { name: 'medium', value: 750, displayOrder: 3 },
            ],
          },
        ],
        combinations: [
          { id: 'c1', selection: ['otra'], basePrice: 200 },
          { id: 'c2', selection: ['small'], basePrice: 100 },
          { id: 'c3', selection: ['medium'], basePrice: 150 },
        ],
      });

      const flat = vg.toFirestoreArray();
      expect(flat[0].name).toBe('small');
      expect(flat[1].name).toBe('medium');
      expect(flat[2].name).toBe('otra');
    });
  });

  describe('helper methods', () => {
    let vg;
    let sizeDimensionId;
    let flavorDimensionId;

    beforeEach(() => {
      vg = new VariationGroups({
        dimensions: [
          {
            id: 'size-dim',
            type: 'SIZE',
            label: 'Size',
            displayOrder: 2,
            options: [
              { name: 'small', value: 500, displayOrder: 1 },
              { name: 'otra', value: 1000, displayOrder: 999 },
              { name: 'medium', value: 750, displayOrder: 3 },
            ],
          },
          {
            id: 'flavor-dim',
            type: 'FLAVOR',
            label: 'Flavor',
            displayOrder: 1,
            options: [{ name: 'vanilla', displayOrder: 1 }],
          },
        ],
        combinations: [
          { selection: ['small'], basePrice: 100, isWholeGrain: false },
          { selection: ['medium'], basePrice: 150, isWholeGrain: true },
        ],
      });
      sizeDimensionId = vg.dimensions.find(d => d.type === 'SIZE').id;
      flavorDimensionId = vg.dimensions.find(d => d.type === 'FLAVOR').id;
    });

    it('getSortedDimensions should return dimensions sorted by displayOrder', () => {
      const sorted = vg.getSortedDimensions();
      expect(sorted[0].type).toBe('FLAVOR');
      expect(sorted[1].type).toBe('SIZE');
    });

    it('getSortedOptions should return options sorted by displayOrder', () => {
      const sorted = vg.getSortedOptions(sizeDimensionId);
      expect(sorted[0].name).toBe('small');
      expect(sorted[1].name).toBe('medium');
      expect(sorted[2].name).toBe('otra');
    });

    it('getWholeGrainCombinations should filter wholegrain combinations', () => {
      const wholegrain = vg.getWholeGrainCombinations();
      expect(wholegrain).toHaveLength(1);
      expect(wholegrain[0].selection).toEqual(['medium']);
    });

    it('setDimensionDisplayOrder should update dimension order', () => {
      vg.setDimensionDisplayOrder(sizeDimensionId, 0);
      const sizeDim = vg.dimensions.find(d => d.id === sizeDimensionId);
      expect(sizeDim.displayOrder).toBe(0);
    });

    it('setOptionDisplayOrder should update and resort options', () => {
      vg.setOptionDisplayOrder(sizeDimensionId, 'otra', 2);
      const sizeDim = vg.dimensions.find(d => d.id === sizeDimensionId);
      const options = sizeDim.options;
      expect(options[0].name).toBe('small');
      expect(options[1].name).toBe('otra');
      expect(options[2].name).toBe('medium');
    });
  });
});
