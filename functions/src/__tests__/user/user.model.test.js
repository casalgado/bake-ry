const User = require("../../models/User");

describe("User Model", () => {
  describe("constructor", () => {
    it("should create a user with all properties", () => {
      const now = new Date();
      const userData = {
        id: "user123",
        email: "test@example.com",
        role: "baker",
        bakeryId: "bakery456",
        name: "Test User",
        createdAt: now,
        updatedAt: now,
      };

      const user = new User(userData);

      expect(user.id).toBe(userData.id);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.bakeryId).toBe(userData.bakeryId);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBe(userData.createdAt);
      expect(user.updatedAt).toBe(userData.updatedAt);
    });

    it("should create a user with default timestamps if not provided", () => {
      const userData = {
        id: "user123",
        email: "test@example.com",
        role: "baker",
        bakeryId: "bakery456",
        name: "Test User",
      };

      const user = new User(userData);

      expect(user.id).toBe(userData.id);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.bakeryId).toBe(userData.bakeryId);
      expect(user.name).toBe(userData.name);
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("toFirestore", () => {
    it("should return an object suitable for Firestore", () => {
      const now = new Date();
      const user = new User({
        id: "user123",
        email: "test@example.com",
        role: "baker",
        bakeryId: "bakery456",
        name: "Test User",
        createdAt: now,
        updatedAt: now,
        address: "123 Baker Street",
        birthday: "1990-01-01",
        category: "senior_baker",
        comment: "Specialty: French pastries",
        phone: "555-0123",
        national_id: "AB123456",
      });

      const firestoreData = user.toFirestore();

      expect(firestoreData).toEqual({
        email: "test@example.com",
        role: "baker",
        bakeryId: "bakery456",
        name: "Test User",
        createdAt: now,
        updatedAt: now,
        address: "123 Baker Street",
        birthday: "1990-01-01",
        category: "senior_baker",
        comment: "Specialty: French pastries",
        phone: "555-0123",
        national_id: "AB123456",
      });
      expect(firestoreData).not.toHaveProperty("id");
    });
  });

  describe("fromFirestore", () => {
    it("should create a User instance from Firestore data", () => {
      const now = new Date();
      const firestoreDoc = {
        id: "user123",
        data: () => ({
          email: "test@example.com",
          role: "baker",
          bakeryId: "bakery456",
          name: "Test User",
          createdAt: { toDate: () => now },
          updatedAt: { toDate: () => now },
          address: "123 Baker Street",
          birthday: "1990-01-01",
          category: "senior_baker",
          comment: "Specialty: French pastries",
          phone: "555-0123",
          national_id: "AB123456",
        }),
      };

      const user = User.fromFirestore(firestoreDoc);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe("user123");
      expect(user.email).toBe("test@example.com");
      expect(user.role).toBe("baker");
      expect(user.bakeryId).toBe("bakery456");
      expect(user.name).toBe("Test User");
      expect(user.createdAt).toEqual(now);
      expect(user.updatedAt).toEqual(now);
      expect(user.address).toBe("123 Baker Street");
      expect(user.birthday).toBe("1990-01-01");
      expect(user.category).toBe("senior_baker");
      expect(user.comment).toBe("Specialty: French pastries");
      expect(user.phone).toBe("555-0123");
      expect(user.national_id).toBe("AB123456");
    });
  });
});
