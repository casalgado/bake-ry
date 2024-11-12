const fs = require('fs');
const path = require('path');

const ENV_FILE_PATH = path.join(__dirname, '../.env.seed.json');

const saveEnvironment = (environment) => {
  try {
    fs.writeFileSync(ENV_FILE_PATH, JSON.stringify(environment, null, 2));
    console.log('Environment saved to .env.seed.json');
  } catch (error) {
    console.error('Error saving environment:', error);
    throw error;
  }
};

const loadEnvironment = () => {
  try {
    if (!fs.existsSync(ENV_FILE_PATH)) {
      throw new Error('Environment file not found. Please run bakery seed first.');
    }
    return JSON.parse(fs.readFileSync(ENV_FILE_PATH));
  } catch (error) {
    console.error('Error loading environment:', error);
    throw error;
  }
};

module.exports = {
  saveEnvironment,
  loadEnvironment,
};
