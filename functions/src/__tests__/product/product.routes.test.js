const request = require("supertest");
const express = require("express");

// Mock the middlewares
jest.mock("../../middleware/userAccess", () => ({
  authenticateUser: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: "No token provided" });
    }
    const token = req.headers.authorization.split("Bearer ")[1];

    // Mock token verification
    const tokens = {
      "customer-token": { role: "customer", bakeryId: "bakery123" },
      "staff-token": { role: "staff", bakeryId: "bakery123" },
      "admin-token": { role: "admin", bakeryId: "bakery123" },
      "system-admin-token": { role: "system_admin" },
    };

    if (!tokens[token]) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = tokens[token];
    next();
  },
  requireSystemAdmin: (req, res, next) => {
    if (req.user.role !== "system_admin") {
      return res.status(403).json({ error: "Requires system admin role" });
    }
    next();
  },
  requireStaffOrAdmin: (req, res, next) => {
    const allowedRoles = ["staff", "admin", "system_admin"];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Requires staff or admin role" });
    }
    next();
  },
}));

jest.mock("../../middleware/bakeryAccess", () => (req, res, next) => {
  const bakeryId = req.params.bakeryId;
  if (req.user.role === "system_admin") {
    return next();
  }
  if (req.user.bakeryId !== bakeryId) {
    return res.status(403).json({ error: "No access to this bakery" });
  }
  next();
});

// Mock the controller
jest.mock("../../controllers/productController", () => ({
  getProducts: jest.fn((req, res) => res.json([])),
  getProduct: jest.fn((req, res) => res.json({})),
  createProduct: jest.fn((req, res) => res.status(201).json({})),
  updateProduct: jest.fn((req, res) => res.json({})),
  deleteProduct: jest.fn((req, res) => res.status(204).send()),
}));

const productRoutes = require("../../routes/productRoutes");
const productController = require("../../controllers/productController");

describe("Product Routes", () => {
  let app;
  const bakeryId = "bakery123";
  const productId = "product123";

  // Test tokens
  const customerToken = "customer-token";
  const staffToken = "staff-token";
  const adminToken = "admin-token";
  const systemAdminToken = "system-admin-token";

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(productRoutes);
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should reject requests without token", async () => {
      await request(app).get(`/bakeries/${bakeryId}/products`).expect(401);
    });

    it("should reject requests with invalid token", async () => {
      await request(app)
        .get(`/bakeries/${bakeryId}/products`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("should accept requests with valid token", async () => {
      await request(app)
        .get(`/bakeries/${bakeryId}/products`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(200);
    });
  });

  describe("GET /bakeries/:bakeryId/products", () => {
    it("should allow customers to get products from their bakery", async () => {
      await request(app)
        .get(`/bakeries/${bakeryId}/products`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(200);

      expect(productController.getProducts).toHaveBeenCalled();
    });

    it("should deny access to products from different bakery", async () => {
      await request(app)
        .get("/bakeries/different-bakery/products")
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });

    it("should allow system admin to access any bakery products", async () => {
      await request(app)
        .get("/bakeries/any-bakery/products")
        .set("Authorization", `Bearer ${systemAdminToken}`)
        .expect(200);
    });
  });

  describe("GET /bakeries/:bakeryId/products/:id", () => {
    it("should allow customers to get specific product from their bakery", async () => {
      await request(app)
        .get(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(200);

      expect(productController.getProduct).toHaveBeenCalled();
    });

    it("should deny access to product from different bakery", async () => {
      await request(app)
        .get(`/bakeries/different-bakery/products/${productId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe("POST /bakeries/:bakeryId/products", () => {
    const newProduct = {
      name: "New Product",
      price: 9.99,
    };

    it("should allow staff to create product", async () => {
      await request(app)
        .post(`/bakeries/${bakeryId}/products`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send(newProduct)
        .expect(201);

      expect(productController.createProduct).toHaveBeenCalled();
    });

    it("should allow admin to create product", async () => {
      await request(app)
        .post(`/bakeries/${bakeryId}/products`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newProduct)
        .expect(201);
    });

    it("should deny customer from creating product", async () => {
      await request(app)
        .post(`/bakeries/${bakeryId}/products`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send(newProduct)
        .expect(403);
    });

    it("should deny staff from creating product in different bakery", async () => {
      await request(app)
        .post("/bakeries/different-bakery/products")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(newProduct)
        .expect(403);
    });
  });

  describe("PATCH /bakeries/:bakeryId/products/:id", () => {
    const updateData = {
      price: 10.99,
    };

    it("should allow staff to update product", async () => {
      await request(app)
        .patch(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send(updateData)
        .expect(200);

      expect(productController.updateProduct).toHaveBeenCalled();
    });

    it("should deny customer from updating product", async () => {
      await request(app)
        .patch(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send(updateData)
        .expect(403);
    });

    it("should deny staff from updating product in different bakery", async () => {
      await request(app)
        .patch(`/bakeries/different-bakery/products/${productId}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe("DELETE /bakeries/:bakeryId/products/:id", () => {
    it("should allow staff to delete product", async () => {
      await request(app)
        .delete(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(204);

      expect(productController.deleteProduct).toHaveBeenCalled();
    });

    it("should allow admin to delete product", async () => {
      await request(app)
        .delete(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      expect(productController.deleteProduct).toHaveBeenCalled();
    });

    it("should deny customer from deleting product", async () => {
      await request(app)
        .delete(`/bakeries/${bakeryId}/products/${productId}`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    });

    it("should deny staff from deleting product in different bakery", async () => {
      await request(app)
        .delete(`/bakeries/different-bakery/products/${productId}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .expect(403);
    });
  });
});
