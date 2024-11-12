// This file is used to seed the database with a bakery user and bakery data.
const bakery = {
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
      open: '10:00',
      close: '13:00',
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
};

module.exports = bakery;
