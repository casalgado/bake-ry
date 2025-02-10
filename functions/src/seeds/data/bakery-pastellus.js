// This file is used to seed the database with a bakery user and bakery data.
const bakery = {
  email: 'pastellus@gmail.com',
  password: 'pastellus',
  name: 'Andrea Ochoa',
  firstName: 'Andrea',
  lastName: 'Ochoa',
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
    facebook: '',
    instagram: 'https://instagram.com/es_alimento',
    tiktok: '',
    youtube: '',
    twitter: '',
    pinterest: '',
  },
};

module.exports = bakery;
