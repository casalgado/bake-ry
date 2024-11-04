const BaseModel = require('./base/BaseModel');

class Bakery extends BaseModel {
  constructor({
    // Basic Info
    id,
    name,
    address,
    phone,
    email,
    operatingHours = {},
    holidays = [],
    ownerId,
    createdAt,
    updatedAt,

    // Business Information
    description,
    website,
    socialMedia = {},

    // Location & Delivery
    deliveryFee,

    // Status
    isActive = true,
    isPaused = false,

    // Customization
    customAttributes = {},
  } = {}) {
    super({ id, createdAt, updatedAt });

    // Basic Info
    this.name = name;
    this.address = address;
    this.phone = phone;
    this.email = email;
    this.operatingHours = operatingHours;
    this.holidays = holidays;
    this.ownerId = ownerId;

    // Business Information
    this.description = description;
    this.website = website;
    this.socialMedia = socialMedia;

    // Location & Delivery
    this.deliveryFee = deliveryFee;

    // Status
    this.isActive = isActive;
    this.isPaused = isPaused;

    // Customization
    this.customAttributes = customAttributes;
  }

  isOpen(date = new Date()) {
    if (this.isPaused || !this.isActive) return false;

    // Convert day to lowercase for matching with operatingHours object
    const day = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const hours = this.operatingHours[day];

    if (!hours || !hours.isOpen) {
      return false;
    }

    try {
      // Get current time in minutes since midnight
      const currentMinutes = date.getHours() * 60 + date.getMinutes();

      // Convert opening hours to minutes since midnight
      const [openHour, openMinute] = hours.open.split(':').map(Number);
      const [closeHour, closeMinute] = hours.close.split(':').map(Number);

      if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) {
        return false;
      }

      const openMinutes = openHour * 60 + openMinute;
      const closeMinutes = closeHour * 60 + closeMinute;

      return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    } catch (error) {
      console.error('Error checking if bakery is open:', error);
      return false;
    }
  }

  toggleStatus(isPaused) {
    this.isPaused = isPaused;
    this.updatedAt = new Date();
  }
}

module.exports = Bakery;
