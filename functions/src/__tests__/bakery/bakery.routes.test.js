const request = require('supertest');
const express = require('express');
const router = require('../../routes/bakeryRoutes');
const {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
} = require('../../middleware/userAccess');
const hasBakeryAccess = require('../../middleware/bakeryAccess');

// Mock middleware
jest.mock('../../middleware/userAccess', () => ({
  authenticateUser: jest.fn((req, res, next) => next()),
  requireSystemAdmin: jest.fn((req, res, next) => next()),
  requireBakeryAdmin: jest.fn((req, res, next) => next()),
}));

jest.mock('../../middleware/bakeryAccess', () =>
  jest.fn((req, res, next) => next()),
);

describe('Bakery Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/bakeries', router);
  });

  describe('Authentication', () => {
    it('should apply authentication middleware to all routes', async () => {
      await request(app).get('/bakeries');
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  describe('GET /', () => {
    it('should require system admin', async () => {
      await request(app).get('/bakeries');
      expect(requireSystemAdmin).toHaveBeenCalled();
    });
  });

  describe('DELETE /:bakeryId', () => {
    it('should require system admin', async () => {
      await request(app).delete('/bakeries/123');
      expect(requireSystemAdmin).toHaveBeenCalled();
    });
  });

  describe('POST /', () => {
    it('should require bakery admin', async () => {
      await request(app).post('/bakeries');
      expect(requireBakeryAdmin).toHaveBeenCalled();
    });
  });

  describe('PATCH /:bakeryId', () => {
    it('should require bakery admin and bakery access', async () => {
      await request(app).patch('/bakeries/123');
      expect(requireBakeryAdmin).toHaveBeenCalled();
      expect(hasBakeryAccess).toHaveBeenCalled();
    });
  });

  describe('GET /:bakeryId', () => {
    it('should require bakery access', async () => {
      await request(app).get('/bakeries/123');
      expect(hasBakeryAccess).toHaveBeenCalled();
    });
  });
});
