const BaseModel = require('./base/BaseModel');

class User extends BaseModel {
  constructor({
    id,
    email,
    password,
    role,
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

    // Clean and set names
    this.firstName = this.formatName(firstName);
    this.lastName = this.formatName(lastName);
    this.name = this.formatName(name);

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

  formatName(name) {
    if (!name) return '';

    // List of Spanish prepositions and articles that should not be capitalized
    const lowerCaseWords = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'i'];

    // Clean the input
    let cleanName = name
      .replace(/ñ/g, '__n__')
      .replace(/Ñ/g, '__N__');  // Preserve ñ/Ñ

    cleanName = cleanName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/\.$/, '')  // Remove trailing period
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim()
      .toLowerCase();

    cleanName = cleanName
      .replace(/__n__/g, 'ñ')
      .replace(/__N__/g, 'Ñ'); // Restore ñ/Ñ

    // Remove parenthetical information
    cleanName = cleanName.replace(/\s*\([^)]*\)/g, '');

    // Split into words
    const words = cleanName.split(' ');

    // Capitalize words appropriately
    const capitalizedWords = words.map((word, index) => {
      // Special cases for lowercase words
      const isLowerCaseWord = lowerCaseWords.includes(word);

      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }

      // Handle compound prepositions (de la, de los, de las)
      if (word === 'la' || word === 'las' || word === 'los') {
        const previousWord = words[index - 1];
        if (previousWord === 'de') {
          return word;
        }
      }

      // Keep prepositions and articles lowercase unless they're the first word
      if (isLowerCaseWord) {
        return word;
      }

      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1);
    });

    return capitalizedWords.join(' ');
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
