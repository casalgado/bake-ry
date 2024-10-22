const Bakery = require("../../models/Bakery");

describe("Bakery Model", () => {
  const mockBakeryData = {
    // Basic Info
    name: "Sweet Delight Artisan Bakery",
    address: {
      street: "123 Maple Avenue",
      city: "Portland",
      state: "OR",
      zipCode: "97201",
      country: "USA",
    },
    phone: "+1-503-555-0123",
    email: "hello@sweetdelightbakery.com",
    operatingHours: {
      monday: { open: "07:00", close: "19:00" },
      tuesday: { open: "07:00", close: "19:00" },
      wednesday: { open: "07:00", close: "19:00" },
      thursday: { open: "07:00", close: "19:00" },
      friday: { open: "07:00", close: "20:00" },
      saturday: { open: "08:00", close: "20:00" },
      sunday: { open: "08:00", close: "16:00" },
    },
    ownerId: "usr_987654321",
    createdAt: new Date("2023-01-15T08:00:00Z"),
    updatedAt: new Date("2024-03-20T14:30:00Z"),

    // Business Information
    description:
      "Artisanal bakery specializing in French pastries and organic sourdough breads. Family-owned since 2023.",
    website: "https://sweetdelightbakery.com",
    socialMedia: {
      instagram: "@sweetdelightpdx",
      facebook: "SweetDelightBakeryPDX",
      tiktok: "@sweetdelightbakes",
    },
    businessLicense: "BL-PDX-2023-456789",
    taxId: "87-1234567",

    // Location & Delivery
    coordinates: {
      lat: 45.523064,
      lng: -122.676483,
    },
    deliveryRadius: 5.0, // miles
    deliveryFee: 5.99,
    parkingAvailable: true,

    // Operations
    capacity: 30,
    specialties: [
      "Croissants",
      "Sourdough Bread",
      "French Macarons",
      "Custom Wedding Cakes",
    ],
    cuisineTypes: ["French", "American", "European"],
    dietary: ["Vegan Options", "Gluten-Free Options", "Nut-Free Options"],

    // Payment & Orders
    acceptedPaymentMethods: [
      "VISA",
      "MasterCard",
      "American Express",
      "Apple Pay",
      "Google Pay",
    ],
    minimumOrderAmount: 15.0,
    onlineOrderingEnabled: true,

    // Ratings & Reviews
    rating: 4.8,
    reviewCount: 127,
    featuredReviews: [
      {
        id: "rev_123",
        author: "Sarah M.",
        rating: 5,
        text: "Best croissants in Portland! Perfectly flaky and buttery.",
        date: new Date("2024-03-15"),
      },
      {
        id: "rev_124",
        author: "Michael R.",
        rating: 5,
        text: "Their sourdough bread is exceptional. Worth the trip across town!",
        date: new Date("2024-03-18"),
      },
    ],

    // Staff & Service
    employeeCount: 12,
    serviceTypes: [
      "Dine-in",
      "Takeout",
      "Delivery",
      "Catering",
      "Special Orders",
    ],

    // Marketing & Promotions
    loyaltyProgram: {
      name: "Sweet Rewards",
      pointsPerDollar: 1,
      rewardThreshold: 100,
    },
    promotions: [
      {
        id: "promo_123",
        title: "Early Bird Special",
        description: "20% off all pastries before 9am",
        validUntil: new Date("2024-12-31"),
        createdAt: new Date("2024-01-01"),
      },
    ],
    tags: [
      "bakery",
      "pastries",
      "french",
      "organic",
      "sourdough",
      "wedding cakes",
      "portland",
    ],

    // Status
    isActive: true,
    isPaused: false,
    pauseReason: null,

    // Customization
    theme: {
      primaryColor: "#FE938C",
      secondaryColor: "#E6B89C",
      fontFamily: "Montserrat",
      logo: "sweet-delight-logo.png",
    },
    customAttributes: {
      sustainabilityScore: 4.5,
      certifications: ["Organic", "Local First"],
      preferredVendors: ["Portland Flour Co.", "Oregon Dairy Farms"],
    },
  };

  test("should create a valid bakery instance with all fields", () => {
    const bakery = new Bakery(mockBakeryData);

    expect(bakery).toBeInstanceOf(Bakery);
    // Test basic info
    expect(bakery.id).toBe(mockBakeryData.id);
    expect(bakery.name).toBe(mockBakeryData.name);
    expect(bakery.address).toEqual(mockBakeryData.address);
    expect(bakery.phone).toBe(mockBakeryData.phone);
    expect(bakery.email).toBe(mockBakeryData.email);
    expect(bakery.operatingHours).toEqual(mockBakeryData.operatingHours);
    expect(bakery.ownerId).toBe(mockBakeryData.ownerId);

    // Test business information
    expect(bakery.description).toBe(mockBakeryData.description);
    expect(bakery.website).toBe(mockBakeryData.website);
    expect(bakery.socialMedia).toEqual(mockBakeryData.socialMedia);
    expect(bakery.businessLicense).toBe(mockBakeryData.businessLicense);
    expect(bakery.taxId).toBe(mockBakeryData.taxId);

    // Test arrays and objects
    expect(bakery.specialties).toEqual(mockBakeryData.specialties);
    expect(bakery.coordinates).toEqual(mockBakeryData.coordinates);
    expect(bakery.featuredReviews).toEqual(mockBakeryData.featuredReviews);

    // Test default values
    expect(bakery.createdAt).toBeInstanceOf(Date);
    expect(bakery.updatedAt).toBeInstanceOf(Date);
    expect(bakery.isActive).toBe(true);
    expect(bakery.isPaused).toBe(false);
  });

  test("should create instance with minimal required fields", () => {
    const minimalData = {
      name: "Test Bakery",
      ownerId: "owner123",
    };

    const bakery = new Bakery(minimalData);

    expect(bakery).toBeInstanceOf(Bakery);
    expect(bakery.name).toBe(minimalData.name);
    expect(bakery.ownerId).toBe(minimalData.ownerId);
    expect(bakery.specialties).toEqual([]);
    expect(bakery.promotions).toEqual([]);
    expect(bakery.socialMedia).toEqual({});
    expect(bakery.customAttributes).toEqual({});
  });

  test("toFirestore method should return correct object with all fields", () => {
    const bakery = new Bakery(mockBakeryData);
    const firestoreObject = bakery.toFirestore();

    // Verify all fields are present except id
    expect(firestoreObject.id).toBeUndefined();
    expect(firestoreObject.name).toBe(mockBakeryData.name);
    expect(firestoreObject.address).toEqual(mockBakeryData.address);
    expect(firestoreObject.specialties).toEqual(mockBakeryData.specialties);
    expect(firestoreObject.coordinates).toEqual(mockBakeryData.coordinates);
    expect(firestoreObject.featuredReviews).toEqual(
      mockBakeryData.featuredReviews
    );
  });

  test("fromFirestore method should create correct Bakery instance", () => {
    const doc = {
      id: mockBakeryData.id,
      data: () => ({
        ...mockBakeryData,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      }),
    };

    const bakery = Bakery.fromFirestore(doc);

    expect(bakery).toBeInstanceOf(Bakery);
    expect(bakery.id).toBe(mockBakeryData.id);
    expect(bakery.name).toBe(mockBakeryData.name);
    expect(bakery.address).toEqual(mockBakeryData.address);
    expect(bakery.coordinates).toEqual(mockBakeryData.coordinates);
    expect(bakery.createdAt).toEqual(new Date("2024-01-01"));
    expect(bakery.updatedAt).toEqual(new Date("2024-01-02"));
  });

  describe("Utility Methods", () => {
    let bakery;

    beforeEach(() => {
      bakery = new Bakery(mockBakeryData);
    });

    test("calculateDeliveryFee should return correct fee", () => {
      expect(bakery.calculateDeliveryFee(3)).toBe(5.99);
      expect(bakery.calculateDeliveryFee(6)).toBeNull(); // Outside delivery radius
    });

    test("updateRating should calculate correct average", () => {
      bakery.rating = 4.0;
      bakery.reviewCount = 1;
      bakery.updateRating(5.0);

      expect(bakery.rating).toBe(4.5);
      expect(bakery.reviewCount).toBe(2);
      expect(bakery.updatedAt).toBeInstanceOf(Date);
    });

    test("addPromotion should add promotion correctly", () => {
      const newPromotion = {
        title: "New Promotion",
        description: "Test",
      };

      bakery.addPromotion(newPromotion);

      expect(bakery.promotions).toHaveLength(2);
      expect(bakery.promotions[1].title).toBe(newPromotion.title);
      expect(bakery.promotions[1].createdAt).toBeInstanceOf(Date);
    });

    test("toggleStatus should update status correctly", () => {
      bakery.toggleStatus(true, "Holiday");

      expect(bakery.isPaused).toBe(true);
      expect(bakery.pauseReason).toBe("Holiday");
      expect(bakery.updatedAt).toBeInstanceOf(Date);
    });
  });
});
