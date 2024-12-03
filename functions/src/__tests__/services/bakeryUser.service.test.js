// __tests__/services/bakeryUserService.test.js

const { db } = require('../../config/firebase');
const { admin } = require('../../config/firebase');
const BakeryUserService = require('../../services/BakeryUserService');
const { BadRequestError } = require('../../utils/errors');

// Mock Firebase Admin SDK
jest.mock('../../config/firebase', () => ({
  db: {
    collection: jest.fn(),
    runTransaction: jest.fn(),
  },
  admin: {
    auth: () => ({
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      setCustomUserClaims: jest.fn(),
    }),
  },
}));

describe('BakeryUserService', () => {
  let service;
  const bakeryId = 'bakery123';
  const mockUser = {
    id: 'user123',
    email: 'test@test.com',
    name: 'Test User',
    role: 'bakery_staff',
    bakeryId: 'bakery123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    service = new BakeryUserService();
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validUserData = {
      email: 'test@test.com',
      password: 'password123',
      name: 'Test User',
      role: 'bakery_staff',
    };

    beforeEach(() => {
      // Setup basic mocks for successful creation
      const mockUsersRef = { doc: jest.fn(), where: jest.fn() };
      const mockUserDoc = { set: jest.fn() };
      const mockStaffRef = { doc: jest.fn() };
      const mockStaffDoc = { set: jest.fn() };
      const mockCollection = jest.fn();
      const mockQuery = { get: jest.fn().mockResolvedValue({ empty: true }) };

      mockUsersRef.doc.mockReturnValue(mockUserDoc);
      mockUsersRef.where.mockReturnValue(mockQuery);
      mockStaffRef.doc.mockReturnValue(mockStaffDoc);

      db.collection.mockImplementation((path) => {
        if (path === 'bakeries') return { doc: () => ({ collection: mockCollection }) };
        return mockUsersRef;
      });
      mockCollection.mockReturnValue(mockStaffRef);

      db.runTransaction.mockImplementation(async (cb) => {
        return await cb({ set: jest.fn(), get: jest.fn() });
      });

      admin.auth().createUser.mockResolvedValue({ uid: 'user123' });
      admin.auth().setCustomUserClaims.mockResolvedValue();
    });

    it('should create a new staff user with all required fields', async () => {
      await service.create(validUserData, bakeryId);

      expect(admin.auth().createUser).toHaveBeenCalledWith({
        email: validUserData.email,
        password: validUserData.password,
      });
      expect(admin.auth().setCustomUserClaims).toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const invalidEmail = { ...validUserData, email: 'invalid-email' };
      await expect(service.create(invalidEmail, bakeryId)).rejects.toThrow(BadRequestError);
    });

    it('should validate password length', async () => {
      const shortPassword = { ...validUserData, password: '123' };
      await expect(service.create(shortPassword, bakeryId)).rejects.toThrow(BadRequestError);
    });

    it('should handle duplicate email error', async () => {
      const mockQuery = { get: jest.fn().mockResolvedValue({ empty: false }) };
      db.collection().where.mockReturnValue(mockQuery);

      await expect(service.create(validUserData, bakeryId)).rejects.toThrow(
        'A user with this email already exists in this bakery',
      );
    });

    it('should create staff entry for assistant roles', async () => {
      const assistantRoles = ['delivery_assistant', 'production_assistant', 'bakery_staff'];

      for (const role of assistantRoles) {
        const userData = { ...validUserData, role };
        await service.create(userData, bakeryId);

        expect(db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('staff').doc).toHaveBeenCalled();
      }
    });

    it('should not create staff entry for non-assistant roles', async () => {
      const userData = { ...validUserData, role: 'bakery_customer' };
      await service.create(userData, bakeryId);

      expect(db.collection('bakeries').doc(bakeryId).collection('settings').doc('default').collection('staff').doc).not.toHaveBeenCalled();
    });

    it('should cleanup Firebase Auth user if Firestore creation fails', async () => {
      db.runTransaction.mockRejectedValue(new Error('Firestore error'));

      await expect(service.create(validUserData, bakeryId)).rejects.toThrow();
      expect(admin.auth().deleteUser).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const userId = 'user123';
    let mockDoc;
    let mockTransaction;
    let mockStaffRef;

    beforeEach(() => {
      mockDoc = {
        exists: true,
        data: () => ({ ...mockUser }),
        id: userId,
      };
      mockStaffRef = { set: jest.fn(), delete: jest.fn() };
      mockTransaction = {
        get: jest.fn().mockResolvedValue(mockDoc),
        update: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
      };

      db.collection.mockImplementation((path) => {
        if (path === 'bakeries') {
          return {
            doc: () => ({
              collection: () => ({
                doc: () => ({
                  collection: () => ({
                    doc: () => mockStaffRef,
                  }),
                }),
              }),
            }),
          };
        }
        return {
          doc: () => ({
            collection: () => ({
              doc: () => mockStaffRef,
            }),
          }),
        };
      });

      db.runTransaction.mockImplementation(async (cb) => cb(mockTransaction));
    });

    describe('Role Updates', () => {
      it('should update between different assistant roles', async () => {
        const assistantRoles = ['delivery_assistant', 'production_assistant', 'bakery_staff'];

        for (const fromRole of assistantRoles) {
          for (const toRole of assistantRoles) {
            if (fromRole === toRole) continue;

            mockDoc.data = () => ({ ...mockUser, role: fromRole });
            await service.update(userId, { role: toRole }, bakeryId);

            expect(mockTransaction.set).toHaveBeenCalledWith(
              mockStaffRef,
              expect.objectContaining({
                role: toRole,
              }),
            );
            expect(mockTransaction.delete).not.toHaveBeenCalled();
          }
        }
      });

      it('should properly handle role change from assistant to non-assistant', async () => {
        const updateData = { role: 'bakery_customer' };
        await service.update(userId, updateData, bakeryId);

        expect(mockTransaction.delete).toHaveBeenCalledWith(mockStaffRef);
        expect(admin.auth().setCustomUserClaims).toHaveBeenCalledWith(userId, {
          role: updateData.role,
          bakeryId,
        });
      });

      it('should properly handle role change from non-assistant to assistant', async () => {
        mockDoc.data = () => ({ ...mockUser, role: 'bakery_customer' });
        const updateData = { role: 'bakery_staff' };

        await service.update(userId, updateData, bakeryId);

        expect(mockTransaction.set).toHaveBeenCalledWith(
          mockStaffRef,
          expect.objectContaining({
            role: updateData.role,
          }),
        );
      });
    });

    describe('Name Updates', () => {
      it('should update staff entry when name changes for assistant roles', async () => {
        const updateData = { name: 'New Name' };
        await service.update(userId, updateData, bakeryId);

        expect(mockTransaction.set).toHaveBeenCalledWith(
          mockStaffRef,
          expect.objectContaining({
            name: 'New Name',
            first_name: 'New',
          }),
        );
      });

      it('should handle multi-part names correctly', async () => {
        const updateData = { name: 'John Middle Doe' };
        await service.update(userId, updateData, bakeryId);

        expect(mockTransaction.set).toHaveBeenCalledWith(
          mockStaffRef,
          expect.objectContaining({
            name: 'John Middle Doe',
            first_name: 'John',
          }),
        );
      });
    });

    describe('Email Updates', () => {
      it('should update email in both Auth and Firestore', async () => {
        const updateData = { email: 'newemail@test.com' };
        await service.update(userId, updateData, bakeryId);

        expect(admin.auth().updateUser).toHaveBeenCalledWith(userId, {
          email: updateData.email,
        });
        expect(mockTransaction.update).toHaveBeenCalled();
      });
    });

    describe('History Recording', () => {
      it('should record history for all changes', async () => {
        const updateData = {
          name: 'New Name',
          role: 'production_assistant',
          email: 'new@test.com',
        };

        await service.update(userId, updateData, bakeryId);

        expect(mockTransaction.set).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            changes: expect.objectContaining({
              name: expect.any(Object),
              role: expect.any(Object),
              email: expect.any(Object),
            }),
          }),
        );
      });

      it('should include editor information in history', async () => {
        const editor = { uid: 'editor123', name: 'Editor', role: 'bakery_admin' };
        await service.update(userId, { name: 'New Name' }, bakeryId, editor);

        expect(mockTransaction.set).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            editor: expect.objectContaining({
              userId: editor.uid,
              name: editor.name,
              role: editor.role,
            }),
          }),
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle transaction failures', async () => {
        db.runTransaction.mockRejectedValue(new Error('Transaction failed'));
        await expect(service.update(userId, { name: 'New Name' }, bakeryId)).rejects.toThrow();
      });

      it('should handle Auth update failures', async () => {
        admin.auth().updateUser.mockRejectedValue(new Error('Auth update failed'));
        await expect(service.update(userId, { email: 'new@test.com' }, bakeryId)).rejects.toThrow();
      });

      it('should handle custom claims update failures', async () => {
        admin.auth().setCustomUserClaims.mockRejectedValue(new Error('Claims update failed'));
        await expect(service.update(userId, { role: 'bakery_staff' }, bakeryId)).rejects.toThrow();
      });
    });
  });

  describe('delete', () => {
    it('should delete user from Auth and record history', async () => {
      const editor = { uid: 'editor123', name: 'Editor', role: 'bakery_admin' };
      await service.delete('user123', 'bakery123', editor);

      expect(admin.auth().deleteUser).toHaveBeenCalledWith('user123');
      expect(db.runTransaction).toHaveBeenCalled();
    });

    it('should handle Auth deletion failure', async () => {
      admin.auth().deleteUser.mockRejectedValue(new Error('Auth deletion failed'));
      await expect(service.delete('user123', 'bakery123')).rejects.toThrow();
    });

    it('should handle Firestore deletion failure', async () => {
      db.runTransaction.mockRejectedValue(new Error('Firestore deletion failed'));
      await expect(service.delete('user123', 'bakery123')).rejects.toThrow();
    });
  });
});
