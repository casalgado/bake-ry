const generateId = (length = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length },
    () => chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
};

const parseSpanishName = (fullName, category) => {
  // Handle empty input
  if (!fullName) {
    return { firstName: '', lastName: '', type: 'unknown' };
  }

  // Business names are kept as typed
  if (category === 'B2B') {
    const name = fullName.replace(/\s+/g, ' ').trim();
    return { firstName: name, lastName: '', name };
  }

  // Clean the input while preserving diacritics and ñ
  let cleanName = fullName
    .replace(/\.$/, '')      // Remove trailing period
    .replace(/\s+/g, ' ')    // Normalize multiple spaces
    .trim()
    .toLowerCase();

  // Handle parenthetical information
  cleanName = cleanName.replace(/\s*\([^)]*\)/g, '');

  // Handle single word names
  const parts = cleanName.split(' ').filter(Boolean);
  // Accent-free copy for matching only; output keeps the original spelling
  const plain = parts.map(p => p.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (parts.length === 1) {
    return {
      firstName: capitalize(parts[0]),
      lastName: '',
      name: capitalize(parts[0]),
    };
  }

  let firstName = '';
  let lastName = '';

  // Handle special compound names with "del/de la"
  if (plain[0] === 'maria' && plain[1] === 'del' && parts[2]) {
    firstName = `${parts[0]} ${parts[1]} ${parts[2]}`;
    lastName = parts.slice(3).join(' ');
  }
  // Handle other compound first names
  else if (['maria', 'jose', 'juan', 'ana', 'luis', 'carlos'].includes(plain[0]) && parts.length > 2) {
    firstName = `${parts[0]} ${parts[1]}`;
    lastName = parts.slice(2).join(' ');
  }
  // Handle cases with "de", "de la", "de las", "de los"
  else if (parts.length >= 2 && parts[1] === 'de') {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }
  // Default case
  else {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  // Clean up and return
  return {
    firstName: capitalize(firstName),
    lastName: capitalize(lastName).replace(/\b(De|Del|La|Las|Los)\b/g, match => match.toLowerCase()),
    name: `${capitalize(firstName)} ${capitalize(lastName).replace(/\b(De|Del|La|Las|Los)\b/g, match => match.toLowerCase())}`,
  };
};

// Helper function to capitalize words
const capitalize = (str) => {
  if (!str && str !== 0) return '';

  // Convert to string if it's not already
  const text = String(str);
  return text.split(' ')
    .map(word => {
      // Don't capitalize connectors and prepositions
      if (['de', 'del', 'la', 'las', 'los', 'y', 'e', 'sin', 'el'].includes(word)) {
        return word;
      }
      // Don't capitalize words that start with 'x' followed by a number
      if (/^x\d/.test(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

module.exports = {
  generateId,
  parseSpanishName,
  capitalize,
};
