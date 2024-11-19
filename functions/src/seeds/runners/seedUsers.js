const { BAKERY_ID } = require('../seedConfig');
const BakeryUserService = require('../../services/BakeryUserService');
const clients = require('./../data/clientes.json');

const bakeryUserService = new BakeryUserService();

// Sample user data
const customers = Object.values(clients).filter(e => {
  if (!e.history) return false;
  if (Object.values(e.history).length === 0) return false;
  if (e.address == '' && e.phone == '' && e.email == '') return false;
  return true;
}).map(e => {
  if (e.email == '' || e.email == null || e.email == undefined || e.email == ' ' || e.email == 'no lo dio') e.email = `placeholder@${e.name.split(' ').join('').toLowerCase()}.com`;
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
    name: 'Mike Manager',
    address: '789 Admin Street',
    birthday: '1985-06-20',
    category: 'Management',
    comment: 'General manager',
    phone: '555-0125',
    national_id: 'ID345678',
  },
];

const users = [...customers, ...staff];

async function seedUsers() {
  try {
    console.log('Creating bakery users...');

    // Store created users with their IDs for reference
    const createdUsers = [];
    let progress = '';
    console.log('Creating users...');

    // Create users through service
    for (const userData of users) {
      try {
        const createdUser = await bakeryUserService.create({
          ...userData,
          bakeryId: BAKERY_ID,
          role: 'bakery_customer',
          isActive: true,
        },
        BAKERY_ID,
        );

       
        progress += '✓'; // Checkmark for success
        process.stdout.write('\rProgress: ' + progress);

        createdUsers.push({
          id: createdUser.uid,
          ...createdUser,
        });
      } catch (error) {
        console.error(`Error creating user ${userData.email}:`, error);
        // Continue with next user if one fails
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
