const BaseService = require('./base/BaseService');
const { BakerySettings, ProductCategory } = require('../models/BakerySettings');
const { NotFoundError } = require('../utils/errors');

class BakerySettingsService extends BaseService {
  constructor() {
    super('settings', BakerySettings, 'bakeries/{bakeryId}');
  }

  async getById(id, bakeryId) {
    console.log('bakeryId', bakeryId);
    try {
      const doc = await this.getCollectionRef(bakeryId).doc('default').get();

      if (!doc.exists) {
        throw new NotFoundError('Settings not found');
      }

      return BakerySettings.fromFirestore(doc);
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  async patch(id, data, bakeryId) {
    try {
      const docRef = this.getCollectionRef(bakeryId).doc('default');
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new NotFoundError('Settings not found');
      }

      const currentSettings = BakerySettings.fromFirestore(doc);

      // If we have product categories to update, process them
      if (data.productCategories) {
        data.productCategories = this.updateProductCategories(
          currentSettings.productCategories || [],
          data.productCategories,
        );
      }

      return super.patch('default', data, bakeryId);
    } catch (error) {
      console.error('Error patching settings:', error);
      throw error;
    }
  }

  async getStaffList(bakeryId) {
    try {
      const staff = await this.getCollectionRef(bakeryId).doc('default').collection('staff').get();
      return staff.docs.map(doc => doc.data());
    } catch (error) {
      console.error('Error getting staff list:', error);
      throw error;
    }
  }

  updateProductCategories(existingCategories, incomingCategory) {
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
  }

}

module.exports = BakerySettingsService;
