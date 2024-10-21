const bakeryAccess = (req, res, next) => {
  const { user } = req;
  const requestedBakeryId = req.params.bakeryId || req.body.bakeryId;

  if (user.role === "system_admin") {
    // System admins can access all bakeries
    return next();
  }

  if (user.bakeryId !== requestedBakeryId) {
    return res.status(403).json({ error: "Access denied to this bakery" });
  }

  next();
};

module.exports = bakeryAccess;
