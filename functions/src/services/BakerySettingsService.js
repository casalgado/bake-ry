// services/bakerySettingsService.js
const createBaseService = require('./base/serviceFactory');
const { BakerySettings, ProductCategory } = require('../models/BakerySettings');
const { NotFoundError } = require('../utils/errors');

const createBakerySettingsService = () => {
  const baseService = createBaseService('settings', BakerySettings, 'bakeries/{bakeryId}');

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

  const patch = async (id, data, bakeryId) => {
    try {
      const docRef = baseService.getCollectionRef(bakeryId).doc('default');
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Settings not found');
      }

      const currentSettings = BakerySettings.fromFirestore(doc);

      // If we have product categories to update, process them
      if (data.productCategories) {
        data.productCategories = updateProductCategories(
          currentSettings.productCategories || [],
          data.productCategories,
        );
      }

      return baseService.patch('default', data, bakeryId);
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
      return staff.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting staff list:', error);
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
  };
};

// Export a singleton instance
module.exports = createBakerySettingsService();
