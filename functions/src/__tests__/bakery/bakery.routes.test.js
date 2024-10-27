const request = require("supertest");
const express = require("express");
const bakeryRoutes = require("../../routes/bakeryRoutes");
const bakeryController = require("../../controllers/bakeryController");
const {
  authenticateUser,
  requireSystemAdmin,
  requireBakeryAdmin,
} = require("../../middleware/userAccess");
const hasBakeryAccess = require("../../middleware/bakeryAccess");

// Mock middleware and controller
jest.mock("../../middleware/userAccess");
jest.mock("../../middleware/bakeryAccess");
jest.mock("../../controllers/bakeryController");

describe("Bakery Routes", () => {
  let app;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use("/bakeries", bakeryRoutes);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default middleware behavior
    authenticateUser.mockImplementation((req, res, next) => next());
    requireSystemAdmin.mockImplementation((req, res, next) => next());
    requireBakeryAdmin.mockImplementation((req, res, next) => next());
    hasBakeryAccess.mockImplementation((req, res, next) => next());

    // Setup default controller behavior
    bakeryController.getAllBakeries.mockImplementation((req, res) =>
      res.json([])
    );
    bakeryController.getBakery.mockImplementation((req, res) => res.json({}));
    bakeryController.createBakery.mockImplementation((req, res) =>
      res.status(201).json({})
    );
    bakeryController.updateBakery.mockImplementation((req, res) =>
      res.json({})
    );
    bakeryController.deleteBakery.mockImplementation((req, res) =>
      res.status(204).send()
    );
  });

  describe("Middleware Application", () => {
    test("should apply authenticateUser middleware to all routes", async () => {
      // Test all routes
      await request(app).get("/bakeries");
      await request(app).get("/bakeries/123");
      await request(app).post("/bakeries");
      await request(app).patch("/bakeries/123");
      await request(app).delete("/bakeries/123");

      // Verify authenticateUser was called for each request
      expect(authenticateUser).toHaveBeenCalledTimes(5);
    });

    test("should apply requireSystemAdmin to specific routes", async () => {
      await request(app).get("/bakeries");
      await request(app).delete("/bakeries/123");

      expect(requireSystemAdmin).toHaveBeenCalledTimes(2);
    });

    test("should apply requireBakeryAdmin to specific routes", async () => {
      await request(app).post("/bakeries");
      await request(app).patch("/bakeries/123");

      expect(requireBakeryAdmin).toHaveBeenCalledTimes(2);
    });

    test("should apply hasBakeryAccess to specific routes", async () => {
      await request(app).get("/bakeries/123");
      await request(app).patch("/bakeries/123");

      expect(hasBakeryAccess).toHaveBeenCalledTimes(2);
    });
  });

  describe("GET /bakeries", () => {
    test("should return all bakeries for system admin", async () => {
      const mockBakeries = [
        { id: "1", name: "Bakery 1" },
        { id: "2", name: "Bakery 2" },
      ];
      bakeryController.getAllBakeries.mockImplementation((req, res) =>
        res.json(mockBakeries)
      );

      const response = await request(app).get("/bakeries").expect(200);

      expect(response.body).toEqual(mockBakeries);
      expect(requireSystemAdmin).toHaveBeenCalled();
      expect(bakeryController.getAllBakeries).toHaveBeenCalled();
    });

    test("should handle unauthorized access", async () => {
      requireSystemAdmin.mockImplementation((req, res, next) =>
        res.status(403).json({ error: "Unauthorized" })
      );

      await request(app).get("/bakeries").expect(403);

      expect(bakeryController.getAllBakeries).not.toHaveBeenCalled();
    });
  });

  describe("GET /bakeries/:bakeryId", () => {
    test("should return specific bakery when user has access", async () => {
      const mockBakery = { id: "123", name: "Test Bakery" };
      bakeryController.getBakery.mockImplementation((req, res) =>
        res.json(mockBakery)
      );

      const response = await request(app).get("/bakeries/123").expect(200);

      expect(response.body).toEqual(mockBakery);
      expect(hasBakeryAccess).toHaveBeenCalled();
      expect(bakeryController.getBakery).toHaveBeenCalled();
    });

    test("should handle unauthorized access", async () => {
      hasBakeryAccess.mockImplementation((req, res, next) =>
        res.status(403).json({ error: "No access to this bakery" })
      );

      await request(app).get("/bakeries/123").expect(403);

      expect(bakeryController.getBakery).not.toHaveBeenCalled();
    });
  });

  describe("POST /bakeries", () => {
    test("should create new bakery for bakery admin", async () => {
      const mockBakery = { name: "New Bakery", address: "123 Test St" };
      bakeryController.createBakery.mockImplementation((req, res) =>
        res.status(201).json({ id: "123", ...mockBakery })
      );

      const response = await request(app)
        .post("/bakeries")
        .send(mockBakery)
        .expect(201);

      expect(response.body).toEqual(expect.objectContaining(mockBakery));
      expect(requireBakeryAdmin).toHaveBeenCalled();
      expect(bakeryController.createBakery).toHaveBeenCalled();
    });

    test("should handle unauthorized creation attempt", async () => {
      requireBakeryAdmin.mockImplementation((req, res, next) =>
        res.status(403).json({ error: "Not a bakery admin" })
      );

      await request(app)
        .post("/bakeries")
        .send({ name: "Test Bakery" })
        .expect(403);

      expect(bakeryController.createBakery).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /bakeries/:bakeryId", () => {
    test("should update bakery when user has access", async () => {
      const mockUpdate = { name: "Updated Bakery" };
      bakeryController.updateBakery.mockImplementation((req, res) =>
        res.json({ id: "123", ...mockUpdate })
      );

      const response = await request(app)
        .patch("/bakeries/123")
        .send(mockUpdate)
        .expect(200);

      expect(response.body).toEqual(expect.objectContaining(mockUpdate));
      expect(requireBakeryAdmin).toHaveBeenCalled();
      expect(hasBakeryAccess).toHaveBeenCalled();
      expect(bakeryController.updateBakery).toHaveBeenCalled();
    });

    test("should handle unauthorized update attempt", async () => {
      requireBakeryAdmin.mockImplementation((req, res, next) =>
        res.status(403).json({ error: "Not authorized" })
      );

      await request(app)
        .patch("/bakeries/123")
        .send({ name: "Updated Name" })
        .expect(403);

      expect(bakeryController.updateBakery).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /bakeries/:bakeryId", () => {
    test("should delete bakery for system admin", async () => {
      await request(app).delete("/bakeries/123").expect(204);

      expect(requireSystemAdmin).toHaveBeenCalled();
      expect(bakeryController.deleteBakery).toHaveBeenCalled();
    });

    test("should handle unauthorized deletion attempt", async () => {
      requireSystemAdmin.mockImplementation((req, res, next) =>
        res.status(403).json({ error: "Not a system admin" })
      );

      await request(app).delete("/bakeries/123").expect(403);

      expect(bakeryController.deleteBakery).not.toHaveBeenCalled();
    });
  });
});
