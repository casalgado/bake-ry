const request = require("supertest");
const express = require("express");
const bakeryRoutes = require("../../routes/bakeryRoutes");
const bakeryController = require("../../controllers/bakeryController");
const { authenticateUser } = require("../../middleware/userAccess");

// Mock the authentication middleware
jest.mock("../../middleware/userAccess", () => ({
  authenticateUser: jest.fn((req, res, next) => next()),
}));

// Mock the bakery controller
jest.mock("../../controllers/bakeryController");

// Create a mock Express app that mimics the structure in index.js
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/bakeries", authenticateUser, bakeryRoutes);
  return app;
};

describe("Bakery Routes", () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /bakeries", () => {
    it("should create a new bakery", async () => {
      const newBakery = { name: "New Bakery", address: "123 New St" };
      bakeryController.createBakery.mockImplementation((req, res) => {
        res.status(201).json(newBakery);
      });

      const response = await request(app).post("/bakeries").send(newBakery);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(newBakery);
      expect(bakeryController.createBakery).toHaveBeenCalled();
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  describe("GET /bakeries", () => {
    it("should get all bakeries", async () => {
      const bakeries = [
        { id: "1", name: "Bakery 1" },
        { id: "2", name: "Bakery 2" },
      ];
      bakeryController.getAllBakeries.mockImplementation((req, res) => {
        res.json(bakeries);
      });

      const response = await request(app).get("/bakeries");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(bakeries);
      expect(bakeryController.getAllBakeries).toHaveBeenCalled();
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  describe("GET /bakeries/:id", () => {
    it("should get a specific bakery", async () => {
      const bakery = { id: "1", name: "Specific Bakery" };
      bakeryController.getBakery.mockImplementation((req, res) => {
        res.json(bakery);
      });

      const response = await request(app).get("/bakeries/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(bakery);
      expect(bakeryController.getBakery).toHaveBeenCalled();
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  describe("PUT /bakeries/:id", () => {
    it("should update a bakery", async () => {
      const updatedBakery = { id: "1", name: "Updated Bakery" };
      bakeryController.updateBakery.mockImplementation((req, res) => {
        res.json(updatedBakery);
      });

      const response = await request(app)
        .put("/bakeries/1")
        .send(updatedBakery);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedBakery);
      expect(bakeryController.updateBakery).toHaveBeenCalled();
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  describe("DELETE /bakeries/:id", () => {
    it("should delete a bakery", async () => {
      bakeryController.deleteBakery.mockImplementation((req, res) => {
        res.status(204).send();
      });

      const response = await request(app).delete("/bakeries/1");

      expect(response.status).toBe(204);
      expect(bakeryController.deleteBakery).toHaveBeenCalled();
      expect(authenticateUser).toHaveBeenCalled();
    });
  });

  // Test for authentication middleware
  it("should use authentication middleware for all bakery routes", async () => {
    await request(app).get("/bakeries");
    expect(authenticateUser).toHaveBeenCalled();
  });
});
