const Bakery = require("../models/Bakery");

describe("Bakery Model", () => {
  test("should create a valid bakery instance", () => {
    const bakeryData = {
      name: "Test Bakery",
      address: "123 Test St",
      phone: "123-456-7890",
      email: "test@bakery.com",
      operatingHours: "9AM-5PM",
      ownerId: "owner123",
    };

    const bakery = new Bakery(bakeryData);

    expect(bakery).toBeInstanceOf(Bakery);
    expect(bakery.name).toBe(bakeryData.name);
    expect(bakery.address).toBe(bakeryData.address);
    expect(bakery.phone).toBe(bakeryData.phone);
    expect(bakery.email).toBe(bakeryData.email);
    expect(bakery.operatingHours).toBe(bakeryData.operatingHours);
    expect(bakery.ownerId).toBe(bakeryData.ownerId);
    expect(bakery.createdAt).toBeInstanceOf(Date);
    expect(bakery.updatedAt).toBeInstanceOf(Date);
  });

  test("toFirestore method should return correct object", () => {
    const bakery = new Bakery({
      name: "Test Bakery",
      address: "123 Test St",
      phone: "123-456-7890",
      email: "test@bakery.com",
      operatingHours: "9AM-5PM",
      ownerId: "owner123",
    });

    const firestoreObject = bakery.toFirestore();

    expect(firestoreObject).toEqual({
      name: bakery.name,
      address: bakery.address,
      phone: bakery.phone,
      email: bakery.email,
      operatingHours: bakery.operatingHours,
      ownerId: bakery.ownerId,
      createdAt: bakery.createdAt,
      updatedAt: bakery.updatedAt,
    });
  });

  test("fromFirestore method should create correct Bakery instance", () => {
    const createdDate = new Date("2023-01-01");
    const updatedDate = new Date("2023-01-02");

    const firestoreData = {
      name: "Test Bakery",
      address: "123 Test St",
      phone: "123-456-7890",
      email: "test@bakery.com",
      operatingHours: "9AM-5PM",
      ownerId: "owner123",
      createdAt: createdDate,
      updatedAt: updatedDate,
    };

    const doc = {
      id: "testId",
      data: () => firestoreData,
    };

    const bakery = Bakery.fromFirestore(doc);

    expect(bakery).toBeInstanceOf(Bakery);
    expect(bakery.id).toBe("testId");
    expect(bakery.name).toBe(firestoreData.name);
    expect(bakery.address).toBe(firestoreData.address);
    expect(bakery.phone).toBe(firestoreData.phone);
    expect(bakery.email).toBe(firestoreData.email);
    expect(bakery.operatingHours).toBe(firestoreData.operatingHours);
    expect(bakery.ownerId).toBe(firestoreData.ownerId);
    expect(bakery.createdAt).toEqual(createdDate);
    expect(bakery.updatedAt).toEqual(updatedDate);
  });

  test("should handle Date objects in constructor", () => {
    const createdAt = new Date("2023-01-01");
    const updatedAt = new Date("2023-01-02");
    const bakery = new Bakery({
      name: "Test Bakery",
      createdAt,
      updatedAt,
    });

    expect(bakery.createdAt).toEqual(createdAt);
    expect(bakery.updatedAt).toEqual(updatedAt);
  });
});
