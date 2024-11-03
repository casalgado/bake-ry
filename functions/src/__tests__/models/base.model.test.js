// __tests__/models/base/BaseModel.test.js

const BaseModel = require('../../models/base/BaseModel');

describe('BaseModel', () => {
  class TestModel extends BaseModel {
    static get dateFields() {
      return [...super.dateFields, 'testDate'];
    }
  }

  describe('constructor', () => {
    it('should initialize with default values when no data provided', () => {
      const model = new BaseModel();

      expect(model.createdAt).toBeInstanceOf(Date);
      expect(model.updatedAt).toBeInstanceOf(Date);
      expect(model.id).toBeUndefined();
    });

    it('should set provided values', () => {
      const now = new Date();
      const model = new BaseModel({
        id: '123',
        createdAt: now,
        updatedAt: now,
      });

      expect(model.id).toBe('123');
      expect(model.createdAt).toBe(now);
      expect(model.updatedAt).toBe(now);
    });
  });

  describe('toFirestore', () => {
    it('should remove id and undefined values', () => {
      const model = new BaseModel({
        id: '123',
        name: 'test',
        nullValue: null,
        undefinedValue: undefined,
      });

      const firestoreData = model.toFirestore();

      expect(firestoreData.id).toBeUndefined();
      expect(firestoreData.name).toBe('test');
      expect(firestoreData.nullValue).toBeNull();
      expect(firestoreData.undefinedValue).toBeUndefined();
      expect(firestoreData.createdAt).toBeInstanceOf(Date);
      expect(firestoreData.updatedAt).toBeInstanceOf(Date);
    });

    it('should remove internal properties', () => {
      const model = new BaseModel();
      const firestoreData = model.toFirestore();

      expect(firestoreData._dateFields).toBeUndefined();
    });
  });

  describe('fromFirestore', () => {
    it('should return null for non-existent document', () => {
      const doc = { exists: false };
      const model = BaseModel.fromFirestore(doc);

      expect(model).toBeNull();
    });

    it('should convert Firestore timestamps to dates', () => {
      const now = new Date();
      const firestoreTimestamp = {
        toDate: () => now,
      };

      const doc = {
        exists: true,
        id: '123',
        data: () => ({
          createdAt: firestoreTimestamp,
          updatedAt: firestoreTimestamp,
        }),
      };

      const model = TestModel.fromFirestore(doc);

      expect(model.createdAt).toEqual(now);
      expect(model.updatedAt).toEqual(now);
    });

    it('should handle additional date fields from child classes', () => {
      const now = new Date();
      const firestoreTimestamp = {
        toDate: () => now,
      };

      const doc = {
        exists: true,
        id: '123',
        data: () => ({
          createdAt: firestoreTimestamp,
          updatedAt: firestoreTimestamp,
          testDate: firestoreTimestamp,
        }),
      };

      const model = TestModel.fromFirestore(doc);

      expect(model.testDate).toEqual(now);
    });
  });
});
