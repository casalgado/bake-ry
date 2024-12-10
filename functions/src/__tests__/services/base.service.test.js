const { db } = require('../../config/firebase');
const BaseService = require('../../services/base/BaseService');
const User = require('../../models/User');
const Recipe = require('../../models/Recipe');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => {
  // Create a mock query builder that maintains chainability
  const createQueryBuilder = () => {
    const query = {
      where: jest.fn(() => query),
      orderBy: jest.fn(() => query),
      limit: jest.fn(() => query),
      offset: jest.fn(() => query),
      get: jest.fn(),
    };
    return query;
  };

  // Create a mock collection reference
  const createCollectionRef = () => {
    const query = createQueryBuilder();
    const collectionRef = {
      ...query,
      doc: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };
    return collectionRef;
  };

  return {
    db: {
      collection: jest.fn().mockImplementation(() => createCollectionRef()),
      runTransaction: jest.fn(),
    },
  };
});

describe('BaseService', () => {
  let userService;
  let recipeService;
  let mockQueryBuilder;
  let mockDocs;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock documents
    mockDocs = [
      {
        id: 'user1',
        data: () => ({
          name: 'Test User',
          email: 'test@test.com',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        exists: true,
      },
    ];

    // Setup query builder with chaining
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        docs: mockDocs,
        size: mockDocs.length,
      }),
    };

    // Setup collection reference
    const mockCollectionRef = {
      ...mockQueryBuilder,
      doc: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
    };

    // Mock the collection method to return our chainable query builder
    db.collection.mockImplementation(() => mockCollectionRef);

    // Initialize services
    userService = new BaseService('users', User);
    recipeService = new BaseService('recipes', Recipe, 'bakeries/{bakeryId}');
  });

  describe('getCollectionRef', () => {
    it('should return correct collection ref for root collection', () => {
      userService.getCollectionRef();
      expect(db.collection).toHaveBeenCalledWith('users');
    });

    it('should return correct collection ref for nested collection', () => {
      const bakeryId = 'bakery123';
      recipeService.getCollectionRef(bakeryId);
      expect(db.collection).toHaveBeenCalledWith(`bakeries/${bakeryId}/recipes`);
    });
  });

  describe('getAll', () => {
    it('should log collection path and query parameters', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      await userService.getAll(null, {
        filters: { role: 'admin' },
        sort: { field: 'createdAt', direction: 'desc' },
        pagination: { page: 1, perPage: 10 },
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should correctly transform Firestore documents to model instances', async () => {
      const result = await userService.getAll();

      expect(result.items).toBeDefined();
      expect(result.items[0]).toBeInstanceOf(User);
      expect(result.items[0].name).toBe('Test User');
    });

    it('should handle empty query results', async () => {
      // Override the get implementation for this test
      mockQueryBuilder.get.mockResolvedValueOnce({
        docs: [],
        size: 0,
      });

      const result = await userService.getAll();

      expect(result.items).toHaveLength(0);
    });

    it('should apply filters correctly', async () => {
      await userService.getAll(null, {
        filters: { role: 'admin' },
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('role', '==', 'admin');
    });

    it('should apply pagination correctly', async () => {
      await userService.getAll(null, {
        pagination: { page: 2, perPage: 10 },
      });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(10);
    });

    it('should apply sorting correctly', async () => {
      await userService.getAll(null, {
        sort: { field: 'createdAt', direction: 'desc' },
      });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });
  });
});
