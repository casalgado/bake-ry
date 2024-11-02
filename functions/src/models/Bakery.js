class Bakery {
  constructor({
    id,
    name,
    address,
    phone,
    email,
    operatingHours,
    holidays,
    ownerId,
    createdAt,
    updatedAt,

    // Business Information
    description,
    website,
    socialMedia,
    businessLicense,
    taxId,

    // Location & Delivery
    coordinates, // { lat, lng }
    deliveryRadius,
    deliveryFee,
    parkingAvailable,

    // Operations
    capacity, // Maximum number of customers
    specialties, // Array of specialty items
    cuisineTypes, // Array of cuisine types (e.g., French, Italian)
    dietary, // Array of dietary options (vegan, gluten-free, etc.)

    // Payment & Orders
    acceptedPaymentMethods,
    minimumOrderAmount,
    onlineOrderingEnabled,

    // Ratings & Reviews
    rating,
    reviewCount,
    featuredReviews,

    // Staff & Service
    employeeCount,
    serviceTypes, // Dine-in, Takeout, Delivery, Catering

    // Marketing & Promotions
    loyaltyProgram,
    promotions,
    tags, // Search tags

    // Status
    isActive,
    isPaused,
    pauseReason,

    // Customization
    theme, // Store theme/branding
    customAttributes, // For future extensibility
  }) {
    // Basic Info
    this.id = id;
    this.name = name;
    this.address = address;
    this.phone = phone;
    this.email = email;
    this.operatingHours = operatingHours;
    this.holidays = holidays;
    this.ownerId = ownerId;
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt || new Date();

    // Business Information
    this.description = description;
    this.website = website;
    this.socialMedia = socialMedia || {};
    this.businessLicense = businessLicense;
    this.taxId = taxId;

    // Location & Delivery
    this.coordinates = coordinates;
    this.deliveryRadius = deliveryRadius;
    this.deliveryFee = deliveryFee;
    this.parkingAvailable = parkingAvailable;

    // Operations
    this.capacity = capacity;
    this.specialties = specialties || [];
    this.cuisineTypes = cuisineTypes || [];
    this.dietary = dietary || [];

    // Payment & Orders
    this.acceptedPaymentMethods = acceptedPaymentMethods || [];
    this.minimumOrderAmount = minimumOrderAmount;
    this.onlineOrderingEnabled = onlineOrderingEnabled ?? true;

    // Ratings & Reviews
    this.rating = rating;
    this.reviewCount = reviewCount || 0;
    this.featuredReviews = featuredReviews || [];

    // Staff & Service
    this.employeeCount = employeeCount;
    this.serviceTypes = serviceTypes || [];

    // Marketing & Promotions
    this.loyaltyProgram = loyaltyProgram;
    this.promotions = promotions || [];
    this.tags = tags || [];

    // Status
    this.isActive = isActive ?? true;
    this.isPaused = isPaused ?? false;
    this.pauseReason = pauseReason;

    // Customization
    this.theme = theme || {};
    this.customAttributes = customAttributes || {};
  }

  toFirestore() {
    const data = { ...this };
    delete data.id;
    // Remove undefined values
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Bakery({
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    });
  }

  // Utility methods
  isOpen(date = new Date()) {
    // Implementation for checking if bakery is open
    return true; // Placeholder
  }

  calculateDeliveryFee(distance) {
    if (!this.deliveryRadius || distance > this.deliveryRadius) {
      return null; // Out of delivery range
    }
    return this.deliveryFee || 0;
  }

  updateRating(newRating) {
    this.rating =
      (this.rating * this.reviewCount + newRating) / (this.reviewCount + 1);
    this.reviewCount += 1;
    this.updatedAt = new Date();
  }

  addPromotion(promotion) {
    this.promotions.push({
      ...promotion,
      createdAt: new Date(),
    });
    this.updatedAt = new Date();
  }

  toggleStatus(isPaused, reason) {
    this.isPaused = isPaused;
    this.pauseReason = reason;
    this.updatedAt = new Date();
  }
}

module.exports = Bakery;
