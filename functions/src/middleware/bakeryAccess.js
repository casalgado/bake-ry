// Description: Middleware to verify user has access to the specified bakery
const { ForbiddenError } = require('../utils/errors');

// Middleware to verify user has access to the specified bakery
const hasBakeryAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const bakeryId = req.params.bakeryId || req.body.bakeryId;

    // System admins have access to all bakeries
    if (user.role === 'system_admin') {
      return next();
    }

    console.log('user', user);
    console.log('bakeryId', bakeryId);

    // For other roles, check if they belong to the bakery
    if (user.bakeryId !== bakeryId) {
      console.log('User does not have access to this bakery');
      throw new ForbiddenError('User does not have access to this bakery');
    }
    next();
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

module.exports = hasBakeryAccess;
