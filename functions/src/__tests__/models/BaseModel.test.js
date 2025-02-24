// tests/unit/models/BaseModel.test.js
const BaseModel = require('../../models/base/BaseModel');

describe('BaseModel', () => {
  describe('constructor', () => {
    it('should initialize with basic properties', () => {
      const now = new Date();
      const data = {
        id: '123',
        createdAt: now,
        updatedAt: now,
      };

      const model = new BaseModel(data);

      expect(model.id).toBe('123');
      expect(model.createdAt).toEqual(now);
      expect(model.updatedAt).toEqual(now);
    });

    it('should set createdAt to current date if not provided', () => {
      const model = new BaseModel({ id: '123' });

      expect(model.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('ensureDate', () => {
    it('should handle null values', () => {
      expect(BaseModel.ensureDate(null)).toBeNull();
    });

    it('should handle Date objects', () => {
      const date = new Date();
      expect(BaseModel.ensureDate(date)).toEqual(date);
    });

    it('should handle date strings', () => {
      const dateStr = '2024-01-01';
      const result = BaseModel.ensureDate(dateStr);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2024-01-01');
    });

    it('should handle Firestore timestamps', () => {
      const timestamp = {
        toDate: () => new Date('2024-01-01'),
      };
      const result = BaseModel.ensureDate(timestamp);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('toFirestore', () => {
    it('should remove id field', () => {
      const model = new BaseModel({ id: '123', name: 'test' });
      const firestoreData = model.toFirestore();

      expect(firestoreData.id).toBeUndefined();
      expect(firestoreData.name).toBe('test');
    });

    it('should remove undefined, null, values', () => {
      const model = new BaseModel({
        id: '123',
        name: 'test',
        empty: '',
        nullValue: null,
        undefinedValue: undefined,
      });

      const firestoreData = model.toFirestore();

      expect(firestoreData).toEqual({
        name: 'test',
        empty: '',
        createdAt: expect.any(Date),
      });
    });
  });

  describe('fromFirestore', () => {
    it('should return null for non-existent documents', () => {
      const doc = { exists: false };
      expect(BaseModel.fromFirestore(doc)).toBeNull();
    });

    it('should create instance from Firestore document', () => {
      const doc = {
        exists: true,
        id: '123',
        data: () => ({
          name: 'test',
          createdAt: new Date(),
        }),
      };

      const model = BaseModel.fromFirestore(doc);

      expect(model).toBeInstanceOf(BaseModel);
      expect(model.id).toBe('123');
      expect(model.name).toBe('test');
    });
  });
});
