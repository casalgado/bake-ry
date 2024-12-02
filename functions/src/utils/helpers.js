const generateId = (length = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length },
    () => chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('');
};

module.exports = {
  generateId,
};
