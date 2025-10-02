// const payuTransactionService = require('../../services/payuTransactionService');

// // Mock the dependencies
// jest.mock('../../config/firebase', () => ({
//   db: {
//     collection: jest.fn(),
//   },
// }));

// jest.mock('../../services/base/serviceFactory', () => {
//   return jest.fn(() => ({
//     create: jest.fn(),
//     getById: jest.fn(),
//     getAll: jest.fn(),
//     patch: jest.fn(),
//   }));
// });

// // Mock fetch for PayU API calls
// global.fetch = jest.fn();

// describe('PayuTransactionService - Subscription Methods', () => {
//   let mockBaseService;
//   const bakeryId = 'test-bakery-id';

//   beforeEach(() => {
//     jest.clearAllMocks();

//     // Get reference to the mocked base service
//     const serviceFactory = require('../../services/base/serviceFactory');
//     mockBaseService = serviceFactory();
//   });

//   describe('createSubscriptionSetup', () => {
//     it('should create a subscription setup successfully', async () => {
//       const subscriptionData = {
//         savedCardId: 'card-token-123',
//         amount: 99000,
//         currency: 'COP',
//         description: 'Monthly Subscription',
//       };

//       const mockCreatedTransaction = {
//         id: 'subscription-123',
//         toClientObject: jest.fn().mockReturnValue({
//           id: 'subscription-123',
//           amount: 99000,
//           status: 'PENDING',
//         }),
//       };

//       mockBaseService.create.mockResolvedValue(mockCreatedTransaction);

//       const result = await payuTransactionService.createSubscriptionSetup(subscriptionData, bakeryId);

//       expect(mockBaseService.create).toHaveBeenCalledWith(
//         expect.objectContaining({
//           bakeryId,
//           tokenId: 'card-token-123',
//           amount: 99000,
//           currency: 'COP',
//           paymentContext: 'SUBSCRIPTION',
//           isRecurring: true,
//           recurringFrequency: 'MONTHLY',
//           status: 'PENDING',
//         }),
//         bakeryId,
//       );

//       expect(result).toEqual({
//         id: 'subscription-123',
//         amount: 99000,
//         status: 'PENDING',
//       });
//     });

//     it('should handle errors during subscription setup creation', async () => {
//       const subscriptionData = {
//         savedCardId: 'card-token-123',
//         amount: 99000,
//       };

//       mockBaseService.create.mockRejectedValue(new Error('Database error'));

//       await expect(
//         payuTransactionService.createSubscriptionSetup(subscriptionData, bakeryId),
//       ).rejects.toThrow('Database error');
//     });
//   });

//   describe('processMonthlyBilling', () => {
//     const recurringPaymentId = 'recurring-123';

//     it('should process monthly billing successfully', async () => {
//       // Mock parent recurring payment
//       const mockParent = {
//         id: recurringPaymentId,
//         isRecurring: true,
//         tokenId: 'card-token-123',
//         amount: 99000,
//         currency: 'COP',
//         description: 'Monthly Subscription',
//         paymentMethod: 'VISA',
//         consecutiveFailures: 0,
//       };

//       // Mock successful payment result
//       const mockPaymentResult = {
//         id: 'payment-instance-123',
//         status: 'APPROVED',
//         amount: 99000,
//       };

//       mockBaseService.getById.mockResolvedValue(mockParent);

//       // Mock the processPayment method
//       const originalProcessPayment = payuTransactionService.processPayment;
//       payuTransactionService.processPayment = jest.fn().mockResolvedValue(mockPaymentResult);

//       mockBaseService.patch.mockResolvedValue({});

//       const result = await payuTransactionService.processMonthlyBilling(recurringPaymentId, bakeryId);

//       expect(mockBaseService.getById).toHaveBeenCalledWith(recurringPaymentId, bakeryId);

//       expect(payuTransactionService.processPayment).toHaveBeenCalledWith(
//         expect.objectContaining({
//           tokenId: 'card-token-123',
//           amount: 99000,
//           currency: 'COP',
//           paymentContext: 'SUBSCRIPTION',
//         }),
//         bakeryId,
//       );

//       // Should link payment to parent
//       expect(mockBaseService.patch).toHaveBeenCalledWith(
//         'payment-instance-123',
//         expect.objectContaining({
//           parentRecurringId: recurringPaymentId,
//           isRecurring: false,
//         }),
//         bakeryId,
//       );

//       // Should update parent status to ACTIVE
//       expect(mockBaseService.patch).toHaveBeenCalledWith(
//         recurringPaymentId,
//         expect.objectContaining({
//           status: 'ACTIVE',
//           consecutiveFailures: 0,
//         }),
//         bakeryId,
//       );

//       expect(result).toEqual(mockPaymentResult);

//       // Restore original method
//       payuTransactionService.processPayment = originalProcessPayment;
//     });

//     it('should handle failed payment and increment failure count', async () => {
//       const mockParent = {
//         id: recurringPaymentId,
//         isRecurring: true,
//         tokenId: 'card-token-123',
//         amount: 99000,
//         consecutiveFailures: 1,
//       };

//       const mockPaymentResult = {
//         id: 'payment-instance-123',
//         status: 'DECLINED',
//         amount: 99000,
//       };

//       mockBaseService.getById.mockResolvedValue(mockParent);

//       const originalProcessPayment = payuTransactionService.processPayment;
//       payuTransactionService.processPayment = jest.fn().mockResolvedValue(mockPaymentResult);

//       mockBaseService.patch.mockResolvedValue({});

//       const result = await payuTransactionService.processMonthlyBilling(recurringPaymentId, bakeryId);

//       // Should increment failure count
//       expect(mockBaseService.patch).toHaveBeenCalledWith(
//         recurringPaymentId,
//         expect.objectContaining({
//           consecutiveFailures: 2,
//         }),
//         bakeryId,
//       );

//       expect(result).toEqual(mockPaymentResult);

//       payuTransactionService.processPayment = originalProcessPayment;
//     });

//     it('should reject non-recurring payments', async () => {
//       const mockParent = {
//         id: recurringPaymentId,
//         isRecurring: false, // Not a recurring payment
//       };

//       mockBaseService.getById.mockResolvedValue(mockParent);

//       await expect(
//         payuTransactionService.processMonthlyBilling(recurringPaymentId, bakeryId),
//       ).rejects.toThrow('Payment is not a recurring subscription');
//     });

//     it('should reject payments without stored token', async () => {
//       const mockParent = {
//         id: recurringPaymentId,
//         isRecurring: true,
//         tokenId: null, // No stored payment method
//       };

//       mockBaseService.getById.mockResolvedValue(mockParent);

//       await expect(
//         payuTransactionService.processMonthlyBilling(recurringPaymentId, bakeryId),
//       ).rejects.toThrow('No payment method stored for subscription');
//     });
//   });

//   describe('getSubscriptionPayments', () => {
//     const recurringPaymentId = 'recurring-123';

//     it('should get subscription payments successfully', async () => {
//       const mockPayments = {
//         items: [
//           {
//             id: 'payment-1',
//             parentRecurringId: recurringPaymentId,
//             paymentContext: 'SUBSCRIPTION',
//             toClientObject: jest.fn().mockReturnValue({ id: 'payment-1', amount: 99000 }),
//           },
//           {
//             id: 'payment-2',
//             parentRecurringId: recurringPaymentId,
//             paymentContext: 'SUBSCRIPTION',
//             toClientObject: jest.fn().mockReturnValue({ id: 'payment-2', amount: 99000 }),
//           },
//         ],
//         pagination: {
//           page: 1,
//           perPage: 10,
//           total: 2,
//         },
//       };

//       mockBaseService.getAll.mockResolvedValue(mockPayments);

//       const result = await payuTransactionService.getSubscriptionPayments(recurringPaymentId, bakeryId);

//       expect(mockBaseService.getAll).toHaveBeenCalledWith(bakeryId, {
//         filters: {
//           parentRecurringId: recurringPaymentId,
//           paymentContext: 'SUBSCRIPTION',
//         },
//       });

//       expect(result.items).toHaveLength(2);
//       expect(result.items[0]).toEqual({ id: 'payment-1', amount: 99000 });
//       expect(result.pagination.total).toBe(2);
//     });

//     it('should pass query parameters correctly', async () => {
//       const query = {
//         pagination: { page: 2, perPage: 5 },
//         sort: { field: 'createdAt', direction: 'desc' },
//         filters: { status: 'APPROVED' },
//       };

//       mockBaseService.getAll.mockResolvedValue({ items: [] });

//       await payuTransactionService.getSubscriptionPayments(recurringPaymentId, bakeryId, query);

//       expect(mockBaseService.getAll).toHaveBeenCalledWith(bakeryId, {
//         pagination: { page: 2, perPage: 5 },
//         sort: { field: 'createdAt', direction: 'desc' },
//         filters: {
//           parentRecurringId: recurringPaymentId,
//           paymentContext: 'SUBSCRIPTION',
//           status: 'APPROVED',
//         },
//       });
//     });
//   });

//   describe('getSubscriptionsDueForBilling', () => {
//     it('should find subscriptions due for billing', async () => {
//       const { db } = require('../../config/firebase');

//       // Mock Firestore collection structure
//       const mockBakeriesSnapshot = {
//         docs: [
//           { id: 'bakery-1' },
//           { id: 'bakery-2' },
//         ],
//       };

//       const mockRecurringPayments = {
//         items: [
//           {
//             id: 'recurring-payment-1',
//             paymentContext: 'SUBSCRIPTION',
//             isRecurring: true,
//           },
//         ],
//       };

//       const mockSettingsDoc = {
//         exists: true,
//         data: jest.fn().mockReturnValue({
//           subscription: {
//             status: 'TRIAL',
//             tier: 'BASIC',
//             subscriptionStartDate: new Date('2024-01-01'),
//             recurringPaymentId: 'recurring-payment-1',
//           },
//         }),
//       };

//       db.collection.mockReturnValue({
//         get: jest.fn().mockResolvedValue(mockBakeriesSnapshot),
//       });

//       mockBaseService.getAll.mockResolvedValue(mockRecurringPayments);

//       // Mock settings document
//       const mockSettingsRef = {
//         get: jest.fn().mockResolvedValue(mockSettingsDoc),
//       };

//       // Set up chain of collection calls
//       db.collection
//         .mockReturnValueOnce({
//           get: jest.fn().mockResolvedValue(mockBakeriesSnapshot),
//         })
//         .mockImplementation((path) => {
//           if (path.includes('settings')) {
//             return {
//               doc: jest.fn().mockReturnValue(mockSettingsRef),
//             };
//           }
//           return { get: jest.fn() };
//         });

//       // Mock BakerySettings to return needsBilling = true
//       const mockBakerySettings = {
//         needsBilling: jest.fn().mockReturnValue(true),
//         getNextBillingDate: jest.fn().mockReturnValue(new Date()),
//       };
//       jest.doMock('../../models/BakerySettings', () => ({
//         BakerySettings: jest.fn().mockImplementation(() => mockBakerySettings),
//       }));

//       const results = await payuTransactionService.getSubscriptionsDueForBilling();

//       expect(Array.isArray(results)).toBe(true);
//     });

//     it('should handle errors gracefully', async () => {
//       const { db } = require('../../config/firebase');

//       db.collection.mockReturnValue({
//         get: jest.fn().mockRejectedValue(new Error('Database error')),
//       });

//       await expect(
//         payuTransactionService.getSubscriptionsDueForBilling(),
//       ).rejects.toThrow('Database error');
//     });
//   });
// });
