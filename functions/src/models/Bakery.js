class Bakery {
  constructor({
    id,
    name,
    address,
    phone,
    email,
    operatingHours,
    ownerId,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.phone = phone;
    this.email = email;
    this.operatingHours = operatingHours;
    this.ownerId = ownerId;
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
  }

  toFirestore() {
    return {
      name: this.name,
      address: this.address,
      phone: this.phone,
      email: this.email,
      operatingHours: this.operatingHours,
      ownerId: this.ownerId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Bakery({
      id: doc.id,
      ...data,
    });
  }
}

module.exports = Bakery;
