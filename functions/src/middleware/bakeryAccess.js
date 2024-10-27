const { admin } = require("../config/firebase");
const { ForbiddenError } = require("../utils/errors");

// Middleware to verify user has access to the specified bakery
const hasBakeryAccess = async (req, res, next) => {
  try {
    console.log("Checking bakery access");
    const user = req.user;
    const bakeryId = req.params.bakeryId || req.body.bakeryId;

    console.log("User:", user);
    console.log("Bakery ID:", bakeryId);

    // System admins have access to all bakeries
    if (user.role === "system_admin") {
      return next();
    }

    // For other roles, check if they belong to the bakery
    if (user.bakeryId !== bakeryId) {
      console.log("User does not have access to this bakery");
      throw new ForbiddenError("User does not have access to this bakery");
    }

    next();
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

module.exports = hasBakeryAccess;
