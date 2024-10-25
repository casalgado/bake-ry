const { admin, db } = require("../../config/firebase");
const userService = require("../../services/userService");

// Mock Firebase Admin SDK
jest.mock("../../config/firebase", () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
}));

describe("User Service", () => {
  let mockAuth;
  let mockFirestore;
  let mockTransaction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock auth methods
    mockAuth = {
      createUser: jest.fn(),
      setCustomUserClaims: jest.fn(),
      verifyIdToken: jest.fn(),
      deleteUser: jest.fn(),
    };

    // Setup mock firestore methods
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      set: jest.fn(),
      update: jest.fn(),
      get: jest.fn(),
    };

    // Setup mock transaction
    mockTransaction = {
      set: jest.fn(),
    };

    // Configure mock implementations
    admin.auth.mockReturnValue(mockAuth);
    admin.firestore.mockReturnValue(mockFirestore);
    db.collection.mockReturnValue(mockFirestore);
    db.runTransaction.mockImplementation(async (callback) => {
      return callback(mockTransaction);
    });
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        role: "baker",
        name: "Test Baker",
        bakeryId: "bakery123",
      };

      mockFirestore.get.mockResolvedValueOnce({ empty: true });
      mockAuth.createUser.mockResolvedValueOnce({
        uid: "user123",
        email: userData.email,
      });

      const result = await userService.createUser(userData);

      expect(mockAuth.createUser).toHaveBeenCalledWith({
        email: userData.email,
        password: userData.password,
      });

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith("user123", {
        role: userData.role,
        bakeryId: userData.bakeryId,
      });

      expect(mockTransaction.set).toHaveBeenCalled();

      expect(result).toEqual({
        uid: "user123",
        email: userData.email,
        role: userData.role,
        name: userData.name,
        bakeryId: userData.bakeryId,
      });
    });

    it("should throw an error if bakeryId is missing for non-admin users", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        role: "baker",
        name: "Test Baker",
      };

      await expect(userService.createUser(userData)).rejects.toThrow(
        "BakeryId is required for non-admin users"
      );
    });

    it("should allow creation without bakeryId for system_admin", async () => {
      const userData = {
        email: "admin@example.com",
        password: "password123",
        role: "system_admin",
        name: "System Admin",
      };

      mockFirestore.get.mockResolvedValueOnce({ empty: true });
      mockAuth.createUser.mockResolvedValueOnce({
        uid: "admin123",
        email: userData.email,
      });

      const result = await userService.createUser(userData);
      expect(result.uid).toBe("admin123");
    });

    it("should throw an error if user already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "password123",
        role: "baker",
        name: "Test Baker",
        bakeryId: "bakery123",
      };

      mockFirestore.get.mockResolvedValueOnce({ empty: false });

      await expect(userService.createUser(userData)).rejects.toThrow(
        "A user with this email already exists in this bakery"
      );
    });
  });

  describe("loginUser", () => {
    it("should login user successfully", async () => {
      const idToken = "valid-token";
      const email = "user@example.com";
      const userId = "user123";

      const mockDecodedToken = {
        uid: userId,
        email: email,
      };

      const mockUserData = {
        email: email,
        name: "Test User",
        role: "baker",
        bakeryId: "bakery123",
      };

      mockAuth.verifyIdToken.mockResolvedValueOnce(mockDecodedToken);
      mockFirestore.get.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: userId,
            data: () => mockUserData,
          },
        ],
      });

      const result = await userService.loginUser(idToken, email);

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith(idToken);
      expect(result).toEqual({
        uid: userId,
        ...mockUserData,
      });
    });

    it("should throw error for invalid token", async () => {
      mockAuth.verifyIdToken.mockRejectedValueOnce({
        code: "auth/invalid-id-token",
      });

      await expect(
        userService.loginUser("invalid-token", "user@example.com")
      ).rejects.toThrow("Invalid authentication token.");
    });

    it("should throw error for expired token", async () => {
      mockAuth.verifyIdToken.mockRejectedValueOnce({
        code: "auth/id-token-expired",
      });

      await expect(
        userService.loginUser("expired-token", "user@example.com")
      ).rejects.toThrow("Session expired. Please login again.");
    });
  });

  describe("getUserById", () => {
    it("should get user successfully", async () => {
      const userId = "user123";
      const mockUserData = {
        email: "user@example.com",
        name: "Test User",
        role: "baker",
        bakeryId: "bakery123",
      };

      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        id: userId,
        data: () => mockUserData,
      });

      const result = await userService.getUserById(userId);

      expect(result).toEqual({
        uid: userId,
        ...mockUserData,
      });
    });

    it("should throw error for non-existent user", async () => {
      mockFirestore.get.mockResolvedValueOnce({
        exists: false,
      });

      await expect(userService.getUserById("nonexistent")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const userId = "user123";
      const updateData = {
        name: "Updated Name",
        phone: "1234567890",
      };

      const mockUserData = {
        email: "user@example.com",
        name: "Updated Name",
        role: "baker",
        bakeryId: "bakery123",
        phone: "1234567890",
      };

      mockFirestore.get
        .mockResolvedValueOnce({ exists: true })
        .mockResolvedValueOnce({
          exists: true,
          data: () => mockUserData,
        });

      const result = await userService.updateUser(userId, updateData);

      expect(mockFirestore.update).toHaveBeenCalled();
      expect(result).toEqual({
        uid: userId,
        ...mockUserData,
      });
    });

    it("should throw error for non-existent user", async () => {
      mockFirestore.get.mockResolvedValueOnce({
        exists: false,
      });

      await expect(
        userService.updateUser("nonexistent", { name: "New Name" })
      ).rejects.toThrow("User not found");
    });
  });
});
