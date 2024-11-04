const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/authRoutes');
const userController = require('../../controllers/userController');

jest.mock('../../controllers/userController');

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('User Routes', () => {
  describe('POST /auth/register', () => {
    it('should call the register controller', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        role: 'baker',
        name: 'Test Baker',
        bakeryId: 'bakery123',
      };

      userController.register.mockImplementation((req, res) => {
        res.status(201).json({ message: 'User registered successfully' });
      });

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(userController.register).toHaveBeenCalled();
      expect(response.body).toEqual({
        message: 'User registered successfully',
      });
    });
  });

  describe('POST /auth/login', () => {
    it('should call the login controller', async () => {
      const loginData = {
        email: 'user@example.com',
        password: 'password123',
      };

      userController.loginUser.mockImplementation((req, res) => {
        res.json({ token: 'fake_token' });
      });

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(userController.loginUser).toHaveBeenCalled();
      expect(response.body).toEqual({ token: 'fake_token' });
    });
  });
});
