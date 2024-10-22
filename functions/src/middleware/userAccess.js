const userService = require("../services/userService");
const { ForbiddenError } = require("../utils/errors");

const authenticateUser = async (req, res, next) => {
  // try {
  //   // Instead of verifying the token, directly mock the decoded token
  //   const decodedToken = {
  //     uid: "mockedUserId123", // Mock user ID
  //     email: "testuser@example.com", // Mock user email
  //     name: "Test User", // Other user details can be mocked here
  //   };

  //   req.user = decodedToken; // Assign mock decoded token to req.user
  //   next(); // Proceed to the next middleware
  // } catch (error) {
  //   console.error("Error in mock authentication:", error);
  //   return res.status(401).json({ error: "Mock authentication failed" });
  // }

  // uncomment this to use firebase auth
  try {
    const idToken = req.headers.authorization?.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decodedToken = await userService.verifyToken(idToken);
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

const requireStaffOrAdmin = (req, res, next) => {
  const allowedRoles = ["staff", "admin", "system_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError("Requires staff or admin role");
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const allowedRoles = ["admin", "system_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    throw new ForbiddenError("Requires admin role");
  }
  next();
};

module.exports = {
  authenticateUser,
  requireSystemAdmin,
  requireStaffOrAdmin,
  requireAdmin,
};
