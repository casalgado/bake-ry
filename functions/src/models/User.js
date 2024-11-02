class User {
  constructor({
    id,
    email,
    password,
    role, // can be bakery_customer, bakery_staff, bakery_admin, or system_admin
    bakeryId,
    name,
    createdAt,
    updatedAt,
    address,
    birthday,
    category,
    comment,
    phone,
    national_id,
  }) {
    this.id = id;
    this.email = email;
    this.password = password;
    this.role = role;
    this.bakeryId = bakeryId;
    this.name = name;
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.updatedAt = updatedAt || new Date();
    this.address = address || "";
    this.birthday = birthday || "";
    this.category = category || "";
    this.comment = comment || "";
    this.phone = phone || "";
    this.national_id = national_id || "";
  }

  toFirestore() {
    return {
      email: this.email,
      role: this.role,
      bakeryId: this.bakeryId,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      address: this.address,
      birthday: this.birthday,
      category: this.category,
      comment: this.comment,
      phone: this.phone,
      national_id: this.national_id,
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new User({
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    });
  }
}

module.exports = User;
