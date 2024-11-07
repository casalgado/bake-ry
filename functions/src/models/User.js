const BaseModel = require('./base/BaseModel');

class User extends BaseModel {
  constructor({
    id,
    email,
    password,
    role, // can be bakery_customer, bakery_staff, bakery_admin, or system_admin
    bakeryId,
    name,
    createdAt,
    updatedAt,
    address = '',
    birthday = '',
    category = '',
    comment = '',
    phone = '',
    national_id = '',
    isActive = true,
  }) {
    super({ id, createdAt, updatedAt });

    this.email = email;
    this.password = password;
    this.role = role;
    this.bakeryId = bakeryId;
    this.name = name;
    this.address = address;
    this.birthday = birthday;
    this.category = category;
    this.comment = comment;
    this.phone = phone;
    this.national_id = national_id;
    this.isActive = isActive;
  }

  static get dateFields() {
    return [...super.dateFields];
  }

  toFirestore() {
    const data = super.toFirestore();
    delete data.password; // Make sure password is not stored in Firestore
    return data;
  }
}

module.exports = User;
