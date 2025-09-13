const BaseModel = require('./base/BaseModel');
const { parseSpanishName } = require('../utils/helpers');

class User extends BaseModel {
  constructor({
    id,
    email,
    password,
    role,
    bakeryId,
    name,
    legalName = '',
    createdAt,
    updatedAt,
    address = '',
    birthday = '',
    category = '',
    comment = '',
    phone = '',
    nationalId = '',
    isActive = true,
    isDeleted = false,
  }) {
    super({ id, createdAt, updatedAt });

    this.email = email == '' || email == null || email == undefined ? `${Math.random().toString(36).substring(2, 6)}@pendiente.com` : email;
    this.password = password;
    this.role = role;
    this.bakeryId = bakeryId;

    // Clean and set names
    this.firstName = parseSpanishName(name).firstName;
    this.lastName = parseSpanishName(name).lastName;
    this.name = parseSpanishName(name).name;
    this.legalName = legalName.toLowerCase().trim();

    this.address = address;
    this.birthday = birthday;
    this.category = category;
    this.comment = comment;
    this.phone = this.formatPhone(phone);
    this.nationalId = nationalId;
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
