const ingredients = require('./addIngredients');
const recipes = require('./addRecipes');
const settings = require('./addSettings');
const users = require('./addUsers');

const testData = {
  bakery: {
    email: 'test@bakery.com',
    password: 'aoeuao',
    name: 'Betos Bakery',
    role: 'bakery_admin',
    openingHours: {
      monday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      tuesday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      wednesday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      thursday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      friday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      saturday: {
        isOpen: true,
        open: '09:00',
        close: '17:00',
      },
      sunday: {
        isOpen: false,
        open: '',
        close: '',
      },
    },
    socialMedia: {
      facebook: 'https://facebook.com/a',
      instagram: 'https://instagram.com/a',
      tiktok: 'https://tiktok.com/a',
      youtube: 'https://youtube.com/a',
      twitter: 'https://twitter.com/a',
      pinterest: 'https://pinterest.com/a',
    },
  },
  settings: {
    ...settings,
    id: 'default',
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-09T10:54:43.737Z'),
  },
  users: users.map(user => ({
    ...user,
    createdAt: new Date('2024-11-04T01:34:12.149Z'),
    updatedAt: new Date('2024-11-04T01:51:12.733Z'),
  })),
  ingredients: [
    ...ingredients,
  ],
  recipes: [
    ...recipes,
  ],
};

module.exports = testData;
