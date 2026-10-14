// services/bakerySettingsService.js
const createBaseService = require('./base/serviceFactory');
const { BakerySettings, ProductCategory } = require('../models/BakerySettings');
const { NotFoundError } = require('../utils/errors');
const User = require('../models/User');

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

// Incoming keys win; a key that is an object on both sides is merged one level deep.
// Arrays and dates are replaced whole.
const mergeGroups = (current = {}, incoming) => {
  const merged = { ...current, ...incoming };
  for (const key of Object.keys(incoming)) {
    if (isPlainObject(incoming[key]) && isPlainObject(current[key])) {
      merged[key] = { ...current[key], ...incoming[key] };
    }
  }
  return merged;
};

const createBakerySettingsService = () => {
  const baseService = createBaseService('settings', BakerySettings, 'bakeries/{bakeryId}');
  const usersService = createBaseService('users', User, 'bakeries/{bakeryId}');

  const getById = async (id, bakeryId) => {
    try {
      const doc = await baseService.getCollectionRef(bakeryId).doc('default').get();

      if (!doc.exists) {
        throw new NotFoundError('Settings not found');
      }

      return BakerySettings.fromFirestore(doc);
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  };

  const patch = async (id, data, bakeryId, editor = null) => {
    try {
      const docRef = baseService.getCollectionRef(bakeryId).doc('default');
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Settings not found');
      }

      const currentSettings = BakerySettings.fromFirestore(doc);

      // base patch replaces top-level fields whole and the model refills what is
      // missing from defaults, so merge here: a client sending one group must not
      // reset the others.
      for (const field of ['features', 'branding', 'subscription']) {
        if (data[field]) {
          data[field] = mergeGroups(currentSettings[field], data[field]);
        }
      }

      // When inventory went live (`enabledAt`, set by stockService.getInventoryStart)
      // is the server's record, so a client must not reset it.
      const storedInventory = currentSettings.features?.inventory;
      if (data.features?.inventory && storedInventory) {
        data.features.inventory.enabledAt = storedInventory.enabledAt ?? null;
      }

      // If we have product categories to update, process them
      if (data.productCategories) {
        data.productCategories = updateProductCategories(
          currentSettings.productCategories || [],
          data.productCategories,
        );
      }

      return baseService.patch('default', data, bakeryId, editor);
    } catch (error) {
      console.error('Error patching settings:', error);
      throw error;
    }
  };

  const getStaffList = async (bakeryId) => {
    try {
      const staff = await baseService.getCollectionRef(bakeryId)
        .doc('default')
        .collection('staff')
        .get();
      const admins = await usersService.getRootRef().get();
      console.log('inService admins', admins.docs.map(doc => doc.data()));
      console.log('inService staff', staff.docs.map(doc => doc.data()));
      return [...admins.docs.map(doc => doc.data()).filter(user => user.role !== 'system_admin' && user.bakeryId === bakeryId), ...staff.docs.map(doc => doc.data())];
    } catch (error) {
      console.error('Error getting staff list:', error);
      throw error;
    }

  };

  const getB2bClientsList = async (bakeryId) => {
    try {
      const b2bClients = await baseService.getCollectionRef(bakeryId)
        .doc('default')
        .collection('b2b_clients')
        .get();
      return b2bClients.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting b2b clients list:', error);
      throw error;
    }
  };

  const updateProductCategories = (existingCategories, incomingCategory) => {
    const categoryIndex = existingCategories.findIndex(
      cat => cat.id === incomingCategory.id,
    );

    const updatedCategories = [...existingCategories];

    if (categoryIndex !== -1) {
      // Update existing category while preserving ID
      updatedCategories[categoryIndex] = new ProductCategory({
        ...incomingCategory,
        id: existingCategories[categoryIndex].id,
      });
    } else {
      // Add new category with new ID
      updatedCategories.push(new ProductCategory(incomingCategory));
    }

    return updatedCategories;
  };

  return {
    ...baseService,
    getById,
    patch,
    getStaffList,
    getB2bClientsList,
  };
};

// Export a singleton instance
module.exports = createBakerySettingsService();
