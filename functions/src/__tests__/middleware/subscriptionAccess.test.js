// const {
//   requireActiveSubscription,
//   requirePaidSubscription,
//   addSubscriptionHeaders,
// } = require('../../middleware/subscriptionAccess');

// describe('Subscription Access Middleware', () => {
//   let req, res, next;

//   beforeEach(() => {
//     req = {
//       method: 'POST',
//       user: {
//         subscriptionStatus: 'ACTIVE',
//         subscriptionTier: 'BASIC',
//       },
//     };
//     res = {
//       status: jest.fn().mockReturnThis(),
//       json: jest.fn(),
//       set: jest.fn(),
//     };
//     next = jest.fn();
//   });

//   describe('requireActiveSubscription', () => {
//     const middleware = requireActiveSubscription();

//     it('should allow ALWAYS_FREE tier regardless of status', () => {
//       req.user.subscriptionTier = 'ALWAYS_FREE';
//       req.user.subscriptionStatus = 'SUSPENDED';

//       middleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should allow GET requests regardless of subscription status', () => {
//       req.method = 'GET';
//       req.user.subscriptionStatus = 'SUSPENDED';

//       middleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should allow ACTIVE subscription for write operations', () => {
//       req.user.subscriptionStatus = 'ACTIVE';

//       middleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should allow TRIAL subscription for write operations', () => {
//       req.user.subscriptionStatus = 'TRIAL';

//       middleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should allow PAYMENT_FAILED subscription for write operations', () => {
//       req.user.subscriptionStatus = 'PAYMENT_FAILED';

//       middleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should block SUSPENDED subscription for write operations', () => {
//       req.user.subscriptionStatus = 'SUSPENDED';

//       middleware(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'Active subscription required for this operation',
//         subscriptionStatus: 'SUSPENDED',
//         subscriptionTier: 'BASIC',
//         code: 'SUBSCRIPTION_REQUIRED',
//       });
//     });

//     it('should block CANCELLED subscription for write operations', () => {
//       req.user.subscriptionStatus = 'CANCELLED';

//       middleware(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'Active subscription required for this operation',
//         subscriptionStatus: 'CANCELLED',
//         subscriptionTier: 'BASIC',
//         code: 'SUBSCRIPTION_REQUIRED',
//       });
//     });

//     it('should handle middleware errors gracefully', () => {
//       req.user = null; // This will cause an error

//       middleware(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'Unable to verify subscription access',
//         code: 'SUBSCRIPTION_CHECK_ERROR',
//       });
//     });

//     it('should allow read operations when specified in allowedOperations', () => {
//       const readOnlyMiddleware = requireActiveSubscription(['read']);
//       req.method = 'POST';
//       req.user.subscriptionStatus = 'SUSPENDED';

//       readOnlyMiddleware(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });
//   });

//   describe('requirePaidSubscription', () => {
//     it('should allow ALWAYS_FREE tier', () => {
//       req.user.subscriptionTier = 'ALWAYS_FREE';
//       req.user.subscriptionStatus = 'TRIAL';

//       requirePaidSubscription(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should allow ACTIVE subscription', () => {
//       req.user.subscriptionStatus = 'ACTIVE';

//       requirePaidSubscription(req, res, next);

//       expect(next).toHaveBeenCalled();
//       expect(res.status).not.toHaveBeenCalled();
//     });

//     it('should block TRIAL subscription', () => {
//       req.user.subscriptionStatus = 'TRIAL';

//       requirePaidSubscription(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'Paid subscription required for this feature',
//         subscriptionStatus: 'TRIAL',
//         subscriptionTier: 'BASIC',
//         code: 'PAID_SUBSCRIPTION_REQUIRED',
//       });
//     });

//     it('should block PAYMENT_FAILED subscription', () => {
//       req.user.subscriptionStatus = 'PAYMENT_FAILED';

//       requirePaidSubscription(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//     });

//     it('should handle errors gracefully', () => {
//       req.user = null;

//       requirePaidSubscription(req, res, next);

//       expect(next).not.toHaveBeenCalled();
//       expect(res.status).toHaveBeenCalledWith(403);
//       expect(res.json).toHaveBeenCalledWith({
//         error: 'Unable to verify paid subscription access',
//         code: 'SUBSCRIPTION_CHECK_ERROR',
//       });
//     });
//   });

//   describe('addSubscriptionHeaders', () => {
//     it('should add subscription headers when user data is available', () => {
//       req.user = {
//         subscriptionStatus: 'ACTIVE',
//         subscriptionTier: 'PREMIUM',
//       };

//       addSubscriptionHeaders(req, res, next);

//       expect(res.set).toHaveBeenCalledWith('X-Subscription-Status', 'ACTIVE');
//       expect(res.set).toHaveBeenCalledWith('X-Subscription-Tier', 'PREMIUM');
//       expect(next).toHaveBeenCalled();
//     });

//     it('should not add headers when user data is missing', () => {
//       req.user = {};

//       addSubscriptionHeaders(req, res, next);

//       expect(res.set).not.toHaveBeenCalled();
//       expect(next).toHaveBeenCalled();
//     });

//     it('should continue even if header setting fails', () => {
//       req.user = {
//         subscriptionStatus: 'ACTIVE',
//         subscriptionTier: 'BASIC',
//       };
//       res.set = jest.fn(() => { throw new Error('Header error'); });

//       addSubscriptionHeaders(req, res, next);

//       expect(next).toHaveBeenCalled();
//     });
//   });
// });
