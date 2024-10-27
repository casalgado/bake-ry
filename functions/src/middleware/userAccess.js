const userService = require("../services/userService");
const { ForbiddenError } = require("../utils/errors");

const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    console.log("Received token:", idToken ? "Present" : "Missing");
    if (!idToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decodedToken = await userService.verifyToken(idToken);
    console.log("Decoded token:", decodedToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    } else if (error.code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token format" });
    }
    return res
      .status(401)
      .json({ error: "Invalid token", details: error.message });
  }
};

const requireSystemAdmin = (req, res, next) => {
  if (req.user.role !== "system_admin") {
    throw new ForbiddenError("System admin access required");
  }
  next();
};

const requireBakeryAdmin = (req, res, next) => {
  console.log("Checking bakery admin access", req.user.role);
  const allowedRoles = ["bakery_admin", "system_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError("Requires admin role");
  }
  next();
};

const requireBakeryStaffOrAdmin = (req, res, next) => {
  const allowedRoles = ["bakery_staff", "bakery_admin", "system_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError("Requires staff or admin role");
  }
  next();
};

module.exports = {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
  requireBakeryStaffOrAdmin,
};
