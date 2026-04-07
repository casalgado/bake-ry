/**
 * Date utility functions for handling timezone conversions and formatting
 */

/**
 * Converts a UTC date string to a Colombia local date string (YYYY-MM-DD format)
 * @param {string|Date} zuluDateString - UTC date string or Date object
 * @returns {string} Date in YYYY-MM-DD format in Colombia timezone
 */
function getDateInColombia(zuluDateString) {
  if (!zuluDateString) return null;

  const date = new Date(zuluDateString);
  if (isNaN(date.getTime())) return null;

  // Get the date parts in Colombia timezone
  const colombiaDateParts = date.toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  // en-CA format gives us YYYY-MM-DD directly
  return colombiaDateParts;
}

module.exports = {
  getDateInColombia
};