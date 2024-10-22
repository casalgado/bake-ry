const { admin, db } = require("../../config/firebase");
const userService = require("../../services/userService");

jest.mock("../../config/firebase", () => ({
  admin: {
    auth: jest.fn(),
    firestore: jest.fn(),
  },
  db: {
    collection: jest.fn(),
  },
}));

describe("User Service", () => {
  let mockAuth;
  let mockFirestore;

  beforeEach(() => {
    mockAuth = {
      createUser: jest.fn(),
      setCustomUserClaims: jest.fn(),
      getUserByEmail: jest.fn(),
      verifyIdToken: jest.fn(),
    };
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      set: jest.fn(),
      get: jest.fn(),
      where: jest.fn().mockReturnThis(),
    };

    admin.auth.mockReturnValue(mockAuth);
    admin.firestore.mockReturnValue(mockFirestore);
    db.collection.mockReturnValue(mockFirestore);
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

      mockFirestore.get.mockResolvedValue({ empty: true });
      mockAuth.createUser.mockResolvedValue({
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
      expect(mockFirestore.set).toHaveBeenCalled();
      expect(result).toEqual({
        uid: "user123",
        email: userData.email,
        role: userData.role,
        name: userData.name,
        bakeryId: userData.bakeryId,
      });
    });

    it("should throw an error if user already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "password123",
        role: "baker",
        name: "Existing Baker",
        bakeryId: "bakery123",
      };

      mockFirestore.get.mockResolvedValue({ empty: false });

      await expect(userService.createUser(userData)).rejects.toThrow(
        "A user with this email already exists in this bakery"
      );
    });
  });

  describe("loginUser", () => {
    it("should login a user successfully", async () => {
      const email = "user@example.com";
      const password = "password123";
      const userRecord = { uid: "user123", email };
      const userData = {
        role: "baker",
        name: "Test Baker",
        bakeryId: "bakery123",
      };

      mockAuth.getUserByEmail.mockResolvedValue(userRecord);
      mockFirestore.get.mockResolvedValue({ data: () => userData });

      const result = await userService.loginUser(email, password);

      expect(mockAuth.getUserByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual({
        uid: userRecord.uid,
        email: userRecord.email,
        ...userData,
      });
    });

    it("should throw an error if login fails", async () => {
      const email = "nonexistent@example.com";
      const password = "wrongpassword";

      mockAuth.getUserByEmail.mockRejectedValue(new Error("User not found"));

      await expect(userService.loginUser(email, password)).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("verifyToken", () => {
    it("should verify a token successfully", async () => {
      const idToken = "valid_token";
      const decodedToken = { uid: "user123", email: "user@example.com" };

      mockAuth.verifyIdToken.mockResolvedValue(decodedToken);

      const result = await userService.verifyToken(idToken);

      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith(idToken);
      expect(result).toEqual(decodedToken);
    });

    it("should throw an error if token verification fails", async () => {
      const idToken = "invalid_token";

      mockAuth.verifyIdToken.mockRejectedValue(new Error("Invalid token"));

      await expect(userService.verifyToken(idToken)).rejects.toThrow(
        "Invalid token"
      );
    });
  });
});
