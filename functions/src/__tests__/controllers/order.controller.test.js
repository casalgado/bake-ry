// tests/controllers/orderController.test.js
const orderController = require('../../controllers/orderController');
const OrderService = require('../../services/OrderService');

jest.mock('../../services/OrderService');

describe('Order Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {
      params: { bakeryId: 'test-bakery' },
      body: {},
      user: { uid: 'test-user' },
    };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  describe('patchAll', () => {
    it('should handle bulk updates', async () => {
      const updates = [{ id: '1', status: 'completed' }];
      mockReq.body.updates = updates;

      await orderController.patchAll(mockReq, mockRes);

      expect(OrderService.prototype.patchAll).toHaveBeenCalledWith(
        'test-bakery',
        updates,
        mockReq.user,
      );
    });
  });
});
