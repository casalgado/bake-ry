const BaseModel = require('./base/BaseModel');

class User extends BaseModel {
  constructor({
    id,
    email,
    password,
    role, // can be bakery_customer, bakery_staff, bakery_admin, or system_admin
    bakeryId,
    name,
    firstName,
    lastName,
    createdAt,
    updatedAt,
    address = '',
    birthday = '',
    category = '',
    comment = '',
    phone = '',
    national_id = '',
    isActive = true,
    isDeleted = false,
  }) {
    super({ id, createdAt, updatedAt });

    this.email = email;
    this.password = password;
    this.role = role;
    this.bakeryId = bakeryId;

    this.firstName = firstName;
    this.lastName = lastName;
    this.name = name;
    this.address = address;
    this.birthday = birthday;
    this.category = category;
    this.comment = comment;
    this.phone = this.formatPhone(phone);
    this.national_id = national_id;
    this.isActive = isActive;
    this.isDeleted = isDeleted;
  }

  static get dateFields() {
    return [...super.dateFields];
  }

  formatPhone(phone) {
    if (!phone) return '';

    // Convert to string if it's a number
    const phoneStr = phone.toString();

    // Remove all non-numeric characters
    const cleaned = phoneStr.replace(/[^\d]/g, '');

    // If there are no digits, return empty string
    if (!cleaned) return '';

    // Return the cleaned string
    return cleaned;
  }

  toFirestore() {
    const data = super.toFirestore();
    delete data.password; // Make sure password is not stored in Firestore
    return data;
  }
}

module.exports = User;
