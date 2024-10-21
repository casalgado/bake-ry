const authService = require("../services/authService");

const authenticateUser = async (req, res, next) => {
  try {
    // Instead of verifying the token, directly mock the decoded token
    const decodedToken = {
      uid: "mockedUserId123", // Mock user ID
      email: "testuser@example.com", // Mock user email
      name: "Test User", // Other user details can be mocked here
    };

    req.user = decodedToken; // Assign mock decoded token to req.user
    next(); // Proceed to the next middleware
  } catch (error) {
    console.error("Error in mock authentication:", error);
    return res.status(401).json({ error: "Mock authentication failed" });
  }

  // Uncomment this to use the actual authentication
  // try {
  //   const idToken = req.headers.authorization?.split("Bearer ")[1];
  //   if (!idToken) {
  //     return res.status(401).json({ error: "No token provided" });
  //   }

  //   const decodedToken = await authService.verifyToken(idToken);
  //   req.user = decodedToken;
  //   next();
  // } catch (error) {
  //   console.error("Error verifying token:", error);
  //   if (error.code === "auth/id-token-expired") {
  //     return res.status(401).json({ error: "Token expired" });
  //   } else if (error.code === "auth/argument-error") {
  //     return res.status(401).json({ error: "Invalid token format" });
  //   }
  //   return res
  //     .status(401)
  //     .json({ error: "Invalid token", details: error.message });
  // }
};

const requireSystemAdmin = (req, res, next) => {
  if (req.user.role !== "system_admin") {
    return res.status(403).json({ error: "System admin access required" });
  }
  next();
};

module.exports = { authenticateUser, requireSystemAdmin };
