// tests/unit/controllers/orderController.test.js
const orderController = require('../../controllers/orderController');
const orderService = require('../../services/orderService');
const { BadRequestError } = require('../../utils/errors');

// Mock orderService
jest.mock('../../services/orderService');

describe('Order Controller', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe('patchAll', () => {
    it('should update multiple orders successfully', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          updates: [
            { id: 'order1', data: { status: 1 } },
            { id: 'order2', data: { status: 2 } },
          ],
        },
        user: { uid: 'user123', role: 'company_staff' },
      };

      const mockResult = {
        success: [
          { id: 'order1', changes: { status: { from: 0, to: 1 } } },
          { id: 'order2', changes: { status: { from: 1, to: 2 } } },
        ],
        failed: [],
      };

      orderService.patchAll.mockResolvedValue(mockResult);

      await orderController.patchAll(req, res);

      expect(orderService.patchAll).toHaveBeenCalledWith(
        'bakery123',
        req.body.updates,
        req.user,
      );
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle partial failures in batch update', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: {
          updates: [
            { id: 'order1', data: { status: 1 } },
            { id: 'nonexistent', data: { status: 2 } },
          ],
        },
        user: { uid: 'user123', role: 'company_staff' },
      };

      const mockResult = {
        success: [
          { id: 'order1', changes: { status: { from: 0, to: 1 } } },
        ],
        failed: [
          { id: 'nonexistent', error: 'Order not found' },
        ],
      };

      orderService.patchAll.mockResolvedValue(mockResult);

      await orderController.patchAll(req, res);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle invalid input', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        body: { updates: 'invalid' },
        user: { uid: 'user123' },
      };

      orderService.patchAll.mockRejectedValue(
        new BadRequestError('Updates must be an array'),
      );

      await orderController.patchAll(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Updates must be an array',
      });
    });
  });

  describe('getSalesReport', () => {
    it('should generate sales report with valid query parameters', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        query: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      };

      const mockReport = {
        summary: {
          totalRevenue: 50000,
          totalOrders: 25,
        },
        salesMetrics: {
          // ... other metrics
        },
      };

      orderService.getSalesReport.mockResolvedValue(mockReport);

      await orderController.getSalesReport(req, res);

      expect(orderService.getSalesReport).toHaveBeenCalledWith(
        'bakery123',
        expect.objectContaining({
          filters: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
          pagination: {
            page: 1,
            perPage: 10,
            offset: 0,
          },
          sort: {
            field: 'createdAt',
            direction: 'desc',
          },
        }),
      );
      expect(res.json).toHaveBeenCalledWith(mockReport);
    });

    it('should handle errors in report generation', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
        query: {},
      };

      const error = new Error('Failed to generate report');
      orderService.getSalesReport.mockRejectedValue(error);

      await orderController.getSalesReport(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to generate report',
        }),
      );
    });
  });

  describe('getHistory', () => {
    it('should return order history', async () => {
      const req = {
        params: {
          bakeryId: 'bakery123',
          id: 'order123',
        },
      };

      const mockHistory = [
        {
          timestamp: new Date(),
          changes: {
            status: { from: 0, to: 1 },
          },
        },
      ];

      orderService.getHistory.mockResolvedValue(mockHistory);

      await orderController.getHistory(req, res);

      expect(orderService.getHistory).toHaveBeenCalledWith('bakery123', 'order123');
      expect(res.json).toHaveBeenCalledWith(mockHistory);
    });

    it('should handle missing parameters', async () => {
      const req = {
        params: { bakeryId: 'bakery123' },
      };

      orderService.getHistory.mockRejectedValue(
        new BadRequestError('Both bakeryId and orderId are required'),
      );

      await orderController.getHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Both bakeryId and orderId are required',
      });
    });
  });
});
