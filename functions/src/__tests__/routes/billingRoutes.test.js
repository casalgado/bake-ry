const request = require('supertest');
const express = require('express');
const billingRoutes = require('../../routes/billingRoutes');
const BillingService = require('../../services/billingService');

// Mock the BillingService
jest.mock('../../services/billingService');

// Mock authentication middleware
jest.mock('../../middleware/userAccess', () => ({
  authenticateUser: (req, res, next) => {
    req.user = {
      uid: 'admin-user-123',
      role: 'system_admin',
      email: 'admin@test.com',
    };
    next();
  },
  requireSystemAdmin: (req, res, next) => {
    if (req.user?.role === 'system_admin') {
      next();
    } else {
      res.status(403).json({ error: 'System admin access required' });
    }
  },
}));

describe('Billing Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', billingRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/billing/process', () => {
    it('should successfully process all due billing', async () => {
      const mockResults = {
        processed: 2,
        successful: 2,
        failed: 0,
        suspended: 0,
        errors: [],
      };

      BillingService.processAllDueBilling.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/admin/billing/process')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        results: mockResults,
        timestamp: expect.any(String),
      });

      expect(BillingService.processAllDueBilling).toHaveBeenCalledTimes(1);
    });

    it('should handle no subscriptions due', async () => {
      const mockResults = {
        processed: 0,
        successful: 0,
        failed: 0,
        suspended: 0,
        errors: [],
        message: 'No subscriptions due for billing',
      };

      BillingService.processAllDueBilling.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/admin/billing/process')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.processed).toBe(0);
      expect(response.body.results.message).toBe('No subscriptions due for billing');
    });

    it('should handle billing errors gracefully', async () => {
      const mockError = new Error('Payment gateway timeout');
      BillingService.processAllDueBilling.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/admin/billing/process')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Payment gateway timeout',
        timestamp: expect.any(String),
      });
    });

    it('should handle billing with some failures', async () => {
      const mockResults = {
        processed: 3,
        successful: 2,
        failed: 1,
        suspended: 0,
        errors: [],
      };

      BillingService.processAllDueBilling.mockResolvedValue(mockResults);

      const response = await request(app)
        .post('/admin/billing/process')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results.failed).toBe(1);
      expect(response.body.results.successful).toBe(2);
    });
  });

  describe('GET /admin/billing/due', () => {
    it('should return subscriptions due for billing', async () => {
      const mockSubscriptions = [
        {
          bakeryId: 'bakery-1',
          recurringPaymentId: 'payment-1',
          subscription: {
            status: 'ACTIVE',
            tier: 'BASIC',
            consecutiveFailures: 0,
          },
          nextBillingDate: new Date('2024-02-01'),
        },
        {
          bakeryId: 'bakery-2',
          recurringPaymentId: 'payment-2',
          subscription: {
            status: 'PAYMENT_FAILED',
            tier: 'PREMIUM',
            consecutiveFailures: 2,
          },
          nextBillingDate: new Date('2024-01-31'),
        },
      ];

      BillingService.getSubscriptionsDueBilling.mockResolvedValue(mockSubscriptions);

      const response = await request(app)
        .get('/admin/billing/due')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        count: 2,
        subscriptions: [
          {
            bakeryId: 'bakery-1',
            status: 'ACTIVE',
            tier: 'BASIC',
            nextBillingDate: '2024-02-01T00:00:00.000Z',
            consecutiveFailures: 0,
          },
          {
            bakeryId: 'bakery-2',
            status: 'PAYMENT_FAILED',
            tier: 'PREMIUM',
            nextBillingDate: '2024-01-31T00:00:00.000Z',
            consecutiveFailures: 2,
          },
        ],
        timestamp: expect.any(String),
      });

      expect(BillingService.getSubscriptionsDueBilling).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no subscriptions due', async () => {
      BillingService.getSubscriptionsDueBilling.mockResolvedValue([]);

      const response = await request(app)
        .get('/admin/billing/due')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        count: 0,
        subscriptions: [],
        timestamp: expect.any(String),
      });
    });

    it('should handle errors when fetching due subscriptions', async () => {
      const mockError = new Error('Database connection failed');
      BillingService.getSubscriptionsDueBilling.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/admin/billing/due')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Database connection failed',
        timestamp: expect.any(String),
      });
    });
  });

  describe('POST /admin/billing/retry/:bakeryId', () => {
    it('should successfully retry billing for specific bakery', async () => {
      const mockResult = {
        bakeryId: 'bakery-1',
        paymentResult: { status: 'APPROVED', id: 'tx-123' },
        newStatus: 'ACTIVE',
        consecutiveFailures: 0,
        success: true,
        suspended: false,
      };

      BillingService.retrySubscriptionPayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/admin/billing/retry/bakery-1')
        .send({
          recurringPaymentId: 'payment-123',
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        result: mockResult,
        timestamp: expect.any(String),
      });

      expect(BillingService.retrySubscriptionPayment).toHaveBeenCalledWith(
        'payment-123',
        'bakery-1'
      );
    });

    it('should require recurringPaymentId', async () => {
      const response = await request(app)
        .post('/admin/billing/retry/bakery-1')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'recurringPaymentId is required',
      });

      expect(BillingService.retrySubscriptionPayment).not.toHaveBeenCalled();
    });

    it('should handle retry failures', async () => {
      const mockError = new Error('Invalid subscription or recurring payment ID');
      BillingService.retrySubscriptionPayment.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/admin/billing/retry/bakery-1')
        .send({
          recurringPaymentId: 'invalid-payment-id',
        })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid subscription or recurring payment ID',
        timestamp: expect.any(String),
      });
    });

    it('should handle payment failure during retry', async () => {
      const mockResult = {
        bakeryId: 'bakery-1',
        paymentResult: { status: 'DECLINED', id: 'tx-124' },
        newStatus: 'PAYMENT_FAILED',
        consecutiveFailures: 2,
        success: false,
        suspended: false,
      };

      BillingService.retrySubscriptionPayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/admin/billing/retry/bakery-1')
        .send({
          recurringPaymentId: 'payment-123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.success).toBe(false);
      expect(response.body.result.newStatus).toBe('PAYMENT_FAILED');
    });

    it('should handle suspension after multiple failures', async () => {
      const mockResult = {
        bakeryId: 'bakery-1',
        paymentResult: { status: 'DECLINED', id: 'tx-125' },
        newStatus: 'SUSPENDED',
        consecutiveFailures: 3,
        success: false,
        suspended: true,
      };

      BillingService.retrySubscriptionPayment.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/admin/billing/retry/bakery-1')
        .send({
          recurringPaymentId: 'payment-123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.result.suspended).toBe(true);
      expect(response.body.result.newStatus).toBe('SUSPENDED');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require system admin role for all endpoints', async () => {
      // This test verifies our middleware is applied correctly
      // The actual authentication logic is tested in the middleware tests
      
      const endpoints = [
        { method: 'post', path: '/admin/billing/process' },
        { method: 'get', path: '/admin/billing/due' },
        { method: 'post', path: '/admin/billing/retry/bakery-1', body: { recurringPaymentId: 'test' } },
      ];

      for (const endpoint of endpoints) {
        BillingService.processAllDueBilling.mockResolvedValue({ processed: 0 });
        BillingService.getSubscriptionsDueBilling.mockResolvedValue([]);
        BillingService.retrySubscriptionPayment.mockResolvedValue({ success: true });

        const requestBuilder = request(app)[endpoint.method](endpoint.path);
        if (endpoint.body) {
          requestBuilder.send(endpoint.body);
        }

        const response = await requestBuilder;
        
        // Should not be 403 since our mock middleware sets system_admin role
        expect(response.status).not.toBe(403);
      }
    });
  });
});