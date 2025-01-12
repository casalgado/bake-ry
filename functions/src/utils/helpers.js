const generateId = (length = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length },
    () => chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
};

const parseSpanishName = (fullName) => {
  // Handle empty input
  if (!fullName) {
    return { firstName: '', lastName: '', type: 'unknown' };
  }

  // Clean the input
  fullName = fullName.replace(/ñ/g, '__n__').replace(/Ñ/g, '__N__');  // Preserve ñ/Ñ
  fullName = fullName.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\.$/, '')  // Remove trailing period
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()
    .toLowerCase();
  fullName = fullName.replace(/__n__/g, 'ñ').replace(/__N__/g, 'ñ');

  // Handle parenthetical information
  fullName = fullName.replace(/\s*\([^)]*\)/g, '');

  // Handle single word names
  const parts = fullName.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: capitalize(parts[0]),
      lastName: '',
    };
  }

  let firstName = '';
  let lastName = '';

  // Handle special compound names with "del/de la"
  if (parts[0] === 'maria' && parts[1] === 'del' && parts[2]) {
    firstName = `${parts[0]} ${parts[1]} ${parts[2]}`;
    lastName = parts.slice(3).join(' ');
  }
  // Handle other compound first names
  else if (['maria', 'jose', 'juan', 'ana', 'luis', 'carlos'].includes(parts[0]) && parts[1]) {
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
  if (!str) return '';
  return str.split(' ')
    .map(word => {
      // Don't capitalize connectors and prepositions
      if (['de', 'del', 'la', 'las', 'los', 'y', 'e', 'sin', 'el'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

module.exports = {
  generateId,
  parseSpanishName,
};
