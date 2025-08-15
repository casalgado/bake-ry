const createBaseService = require('./base/serviceFactory');
const SystemSettings = require('../models/SystemSettings');

const createSystemSettingsService = () => {
  const baseService = createBaseService('systemSettings', SystemSettings);

  const ensureDefaultSettingsExist = async () => {
    try {
      const docRef = baseService.getCollectionRef().doc('default');
      const doc = await docRef.get();

      if (!doc.exists) {
        console.log('Default system settings not found, creating...');
        const defaultSettings = new SystemSettings({
          id: 'default',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await docRef.set(defaultSettings.toFirestore());
        console.log('Default system settings created successfully');
        return defaultSettings;
      }

      return SystemSettings.fromFirestore(doc);
    } catch (error) {
      console.error('Error ensuring default settings exist:', error);
      throw error;
    }
  };

  const getById = async (id = 'default') => {
    try {
      const settings = await ensureDefaultSettingsExist();
      return settings;
    } catch (error) {
      console.error('Error getting system settings:', error);
      throw error;
    }
  };

  const patch = async (id = 'default', data, parentId = null, editor = null) => {
    try {
      return baseService.patch('default', data, null, editor);
    } catch (error) {
      console.error('Error patching system settings:', error);
      throw error;
    }
  };

  const update = async (id = 'default', data, parentId = null, editor = null) => {
    try {
      return baseService.update('default', data, null, editor);
    } catch (error) {
      console.error('Error updating system settings:', error);
      throw error;
    }
  };

  return {
    getById,
    patch,
    update,
    ensureDefaultSettingsExist,
    getCollectionRef: baseService.getCollectionRef,
  };
};

module.exports = createSystemSettingsService();
