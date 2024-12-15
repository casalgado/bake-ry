const { BAKERY_ID } = require('../seedConfig');
const bakeryUserService = require('../../services/bakeryUserService');
const clients = require('./../data/clientes.json');

// Sample user data
const customers = Object.values(clients).filter(e => {
  if (!e.history) return false;
  if (Object.values(e.history).length === 0) return false;
  if (e.address == '' && e.phone == '') return false;
  return true;
}).map(e => {
  if (e.email == '' || e.email == null || e.email == undefined || e.email == ' ' || e.email == 'no lo dio') e.email = `placeholder@${e.name.split(' ').join('').toLowerCase()}.com`;
  e.category = Math.floor(Math.random()) > .9 ? 'B2B' : 'B2C';
  if (e.address == '') e.address = 'direccion';
  const cleanItem = { ...e, createdAt: e.since };
  delete cleanItem.history;
  return cleanItem;
});

const staff = [
  {
    email: 'baker1@example.com',
    password: 'password123',
    role: 'bakery_staff',
    name: 'John Baker',
    address: '123 Bakery Lane',
    birthday: '1990-01-01',
    category: 'Baker',
    comment: 'Senior baker, specializes in sourdough',
    phone: '555-0123',
    national_id: 'ID123456',
  },
  {
    email: 'baker2@example.com',
    password: 'password123',
    role: 'bakery_staff',
    name: 'Jane Dough',
    address: '456 Pastry Ave',
    birthday: '1992-03-15',
    category: 'Pastry Chef',
    comment: 'Expert in French pastries',
    phone: '555-0124',
    national_id: 'ID789012',
  },
  {
    email: 'manager@example.com',
    password: 'password123',
    role: 'bakery_admin',
    name: 'Beto',
    address: '789 Admin Street',
    birthday: '1985-06-20',
    category: 'Management',
    comment: 'General manager',
    phone: '555-0125',
    national_id: 'ID345678',
  },
  {
    email: 'delivery1@example.com',
    password: 'password123',
    role: 'delivery_assistant',
    name: 'Josias Perez',
    address: '321 Delivery Road',
    birthday: '1995-04-12',
    category: 'Delivery',
    comment: 'Morning shift delivery driver',
    phone: '555-0126',
    national_id: 'ID901234',
  },
  {
    email: 'delivery2@example.com',
    password: 'password123',
    role: 'delivery_assistant',
    name: 'Alex Lopez',
    address: '654 Transit Way',
    birthday: '1993-08-25',
    category: 'Delivery',
    comment: 'Afternoon shift delivery driver',
    phone: '555-0127',
    national_id: 'ID567890',
  },
  {
    email: 'delivery3@example.com',
    password: 'password123',
    role: 'delivery_assistant',
    name: 'Juan Gomez',
    address: '987 Express Street',
    birthday: '1994-11-30',
    category: 'Delivery',
    comment: 'Evening shift delivery driver',
    phone: '555-0128',
    national_id: 'ID234567',
  },
  {
    email: 'production1@example.com',
    password: 'password123',
    role: 'production_assistant',
    name: 'Lisa Gonzales',
    address: '147 Factory Lane',
    birthday: '1991-07-15',
    category: 'Production',
    comment: 'Morning shift production assistant',
    phone: '555-0129',
    national_id: 'ID678901',
  },
  {
    email: 'production2@example.com',
    password: 'password123',
    role: 'production_assistant',
    name: 'Amanda Martinez',
    address: '258 Assembly Road',
    birthday: '1989-09-03',
    category: 'Production',
    comment: 'Evening shift production assistant',
    phone: '555-0130',
    national_id: 'ID890123',
  },
];

const users = [...customers.slice(200, 210), ...staff];

async function seedUsers() {
  try {
    console.log('Creating bakery users...');

    // Store created users with their IDs for reference
    const createdUsers = [];
    let successCount = 0;
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;

    // Create users through service
    for (const userData of users) {
      try {
        const createdUser = await bakeryUserService.create({
          ...userData,
          bakeryId: BAKERY_ID,
          category: userData.category == 'B2C' || userData.category == 'B2B' ? userData.category : 'PER',
          role: userData.role || 'bakery_customer',
          isActive: true,
        },
        BAKERY_ID,
        );
        process.stdout.write(`\rCreating users... ${spinner[spinnerIndex]} (${successCount}/${users.length})`);
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
        successCount++;
        createdUsers.push({
          id: createdUser.id,
          ...createdUser,
        });
      } catch (error) {
        console.error(`Error creating user ${userData.email}:`, error);
        continue;
      }
    }

    // Write created users to a file for reference
    const fs = require('fs');
    const path = require('path');

    const seedDataDir = path.join(__dirname, '../data');
    fs.writeFileSync(
      path.join(seedDataDir, 'seededUsers.json'),
      JSON.stringify(createdUsers, null, 2),
    );

    console.log('Users seeded successfully');
    return createdUsers;
  } catch (error) {
    console.error('Error seeding users:', error);
    throw error;
  }
}

// Export the function so it can be used by other seeders
module.exports = seedUsers;

// Only run if this is the main file being executed
if (require.main === module) {
  seedUsers();
}
