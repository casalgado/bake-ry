const authService = require('../services/authService');
const { ForbiddenError } = require('../utils/errors');

const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await authService.verifyToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    return res
      .status(401)
      .json({ error: 'Invalid token', details: error.message });
  }
};

const requireSystemAdmin = (req, res, next) => {
  try {
    if (req.user.role !== 'system_admin') {
      throw new ForbiddenError('System admin access required');
    }
    next();
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

const requireBakeryAdmin = (req, res, next) => {
  const allowedRoles = ['bakery_admin', 'system_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError('Requires admin role');
  }
  next();
};

const requireBakeryStaffOrAdmin = (req, res, next) => {
  const allowedRoles = ['bakery_staff', 'bakery_admin', 'system_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError('Requires staff or admin role');
  }
  next();
};

const requireBakeryAssistant = (req, res, next) => {
  const allowedRoles = ['bakery_staff', 'bakery_admin', 'system_admin', 'delivery_assistant', 'production_assistant'];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError('Requires at least assistant role');
  }
  next();
};

module.exports = {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
  requireBakeryStaffOrAdmin,
  requireBakeryAssistant,
};
