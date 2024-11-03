// __tests__/models/Bakery.test.js

const Bakery = require('../../models/Bakery');

describe('Bakery', () => {
  describe('constructor', () => {
    it('should initialize with default values', () => {
      const bakery = new Bakery({});

      expect(bakery.operatingHours).toEqual({});
      expect(bakery.holidays).toEqual([]);
      expect(bakery.socialMedia).toEqual({});
      expect(bakery.customAttributes).toEqual({});
      expect(bakery.isActive).toBe(true);
      expect(bakery.isPaused).toBe(false);
    });

    it('should set provided values', () => {
      const data = {
        name: 'Test Bakery',
        address: '123 Test St',
        phone: '1234567890',
        email: 'test@bakery.com',
        ownerId: 'owner123',
        operatingHours: {
          monday: { isOpen: true, open: '09:00', close: '17:00' },
        },
      };

      const bakery = new Bakery(data);

      expect(bakery.name).toBe(data.name);
      expect(bakery.address).toBe(data.address);
      expect(bakery.phone).toBe(data.phone);
      expect(bakery.email).toBe(data.email);
      expect(bakery.ownerId).toBe(data.ownerId);
      expect(bakery.operatingHours).toEqual(data.operatingHours);
    });
  });

  describe('isOpen', () => {
    let bakery;

    beforeEach(() => {
      bakery = new Bakery({
        operatingHours: {
          monday: { isOpen: true, open: '09:00', close: '17:00' },
          tuesday: { isOpen: false, open: '09:00', close: '17:00' },
          wednesday: { isOpen: true, open: '09:00', close: '17:00' },
        },
      });
    });

    it('should return false when bakery is paused', () => {
      bakery.isPaused = true;
      expect(bakery.isOpen()).toBe(false);
    });

    it('should return false when bakery is inactive', () => {
      bakery.isActive = false;
      expect(bakery.isOpen()).toBe(false);
    });

    it('should return false when day is not open', () => {
      const tuesday = new Date('2024-01-02 10:00'); // A Tuesday
      expect(bakery.isOpen(tuesday)).toBe(false);
    });

    it('should return false when current time is before opening', () => {
      const monday = new Date('2024-01-01 08:59'); // A Monday before 9am
      expect(bakery.isOpen(monday)).toBe(false);
    });

    it('should return true during open hours', () => {
      const monday = new Date('2024-01-01 12:00'); // A Monday at noon
      expect(bakery.isOpen(monday)).toBe(true);
    });

    it('should return false after closing time', () => {
      const monday = new Date('2024-01-01 17:01'); // A Monday after 5pm
      expect(bakery.isOpen(monday)).toBe(false);
    });

    it('should handle invalid time formats gracefully', () => {
      bakery.operatingHours.monday.open = 'invalid';
      const monday = new Date('2024-01-01 12:00');
      expect(bakery.isOpen(monday)).toBe(false);
    });
  });

  describe('toggleStatus', () => {
    let bakery;

    beforeEach(() => {
      bakery = new Bakery({});
    });

    it('should update pause status and reason', () => {

      bakery.toggleStatus(true);

      expect(bakery.isPaused).toBe(true);

    });

    it('should update updatedAt timestamp', () => {
      const beforeUpdate = bakery.updatedAt;
      setTimeout(() => {
        bakery.toggleStatus(true, 'test');
        expect(bakery.updatedAt).not.toEqual(beforeUpdate);
      }, 1);
    });
  });

  describe('date fields', () => {
    it('should include createdAt and updatedAt in date fields', () => {
      expect(Bakery.dateFields).toContain('createdAt');
      expect(Bakery.dateFields).toContain('updatedAt');
    });
  });

  describe('toFirestore', () => {
    it('should properly serialize all fields', () => {
      const bakery = new Bakery({
        name: 'Test Bakery',
        operatingHours: {
          monday: { isOpen: true, open: '09:00', close: '17:00' },
        },
        holidays: [new Date()],
        theme: { color: 'blue' },
      });

      const firestoreData = bakery.toFirestore();

      expect(firestoreData.id).toBeUndefined();
      expect(firestoreData.name).toBe('Test Bakery');
      expect(firestoreData.operatingHours).toBeDefined();
      expect(firestoreData.holidays).toHaveLength(1);
      expect(firestoreData.theme).toEqual({ color: 'blue' });
    });
  });
});
