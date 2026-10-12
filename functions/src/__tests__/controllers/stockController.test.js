const stockController = require('../../controllers/stockController');
const stockService = require('../../services/stockService');

jest.mock('../../services/stockService');

// The admin tools that find and repair shipped orders whose stock never moved.
describe('Stock controller: order check and repair', () => {
  let res;
  const params = { bakeryId: 'bakery123' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  afterEach(() => jest.restoreAllMocks());

  describe('verifyOrders', () => {
    it('lists the mismatched orders, with the service default window when no days are given', async () => {
      stockService.findUnreconciledOrders.mockResolvedValue([{ orderId: 'o1', diffs: [] }]);

      await stockController.verifyOrders({ params, query: {} }, res);

      expect(stockService.findUnreconciledOrders).toHaveBeenCalledWith('bakery123', { days: undefined });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([{ orderId: 'o1', diffs: [] }]);
    });

    it('passes a window in days through', async () => {
      stockService.findUnreconciledOrders.mockResolvedValue([]);

      await stockController.verifyOrders({ params, query: { days: '7' } }, res);

      expect(stockService.findUnreconciledOrders).toHaveBeenCalledWith('bakery123', { days: 7 });
    });

    it.each(['-3', '0', 'abc', 'Infinity'])('refuses days = %s', async (days) => {
      await stockController.verifyOrders({ params, query: { days } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(stockService.findUnreconciledOrders).not.toHaveBeenCalled();
    });
  });

  describe('reconcileOrders', () => {
    it('repairs with the editor from the request', async () => {
      stockService.reconcileUnreconciledOrders.mockResolvedValue({ repaired: ['o1'], failed: [] });
      const req = { params, body: { days: 14 }, user: { uid: 'u1', email: 'a@b.c', role: 'bakery_admin' } };

      await stockController.reconcileOrders(req, res);

      expect(stockService.reconcileUnreconciledOrders).toHaveBeenCalledWith('bakery123', {
        days: 14,
        editor: { userId: 'u1', email: 'a@b.c', role: 'bakery_admin' },
      });
      expect(res.json).toHaveBeenCalledWith({ repaired: ['o1'], failed: [] });
    });

    it('refuses a negative window and repairs nothing', async () => {
      await stockController.reconcileOrders({ params, body: { days: -1 }, user: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(stockService.reconcileUnreconciledOrders).not.toHaveBeenCalled();
    });
  });
});
