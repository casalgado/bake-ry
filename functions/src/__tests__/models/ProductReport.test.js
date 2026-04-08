// __tests__/models/ProductReport.test.js

const ProductReport = require("../../models/ProductReport");
const { Order } = require("../../models/Order");

describe("ProductReport", () => {
  // Test data setup based on real structures from test_data/
  const mockB2BClients = [
    {
      id: "028uK6R1xGf4gBdyYpp30cSfIDt2",
      name: "Stephanie Botero Cafe - Luis Botero",
      email: "pendiente@stephanieboterocafe.com",
      phone: "3012348177",
      address: "",
    },
    {
      id: "SUF9kFw8r9hvVxmTQ66w7EuSgZx2",
      name: "Another B2B Client",
      email: "test@b2b.com",
      phone: "123456789",
      address: "Test Address",
    },
  ];

  const mockProducts = [
    {
      id: "tfTjV8pOp1ZDVg4ZQ99R",
      name: "integral",
      collectionId: "GRzDxeAWOj2HBhmlObSy",
      collectionName: "sourdough",
      hasVariations: true,
      isDeleted: false,
      variations: {
        combinations: [
          {
            id: "tJ24gFRsSsgIQ57I",
            name: "Mediano",
            basePrice: 23700,
            currentPrice: 23700,
            isActive: true,
          },
        ],
      },
    },
    {
      id: "product2",
      name: "Simple Product",
      collectionId: "HvG0VIiluQ3ULrgp7QSN",
      collectionName: "pastries",
      hasVariations: false,
      isDeleted: false,
      basePrice: 15000,
      currentPrice: 15000,
    },
  ];

  const mockOrders = [
    new Order({
      id: "order1",
      userId: "028uK6R1xGf4gBdyYpp30cSfIDt2", // B2B client
      dueDate: new Date("2026-04-01"),
      paymentDate: new Date("2026-04-02"),
      isComplimentary: false,
      orderItems: [
        {
          id: "item1",
          productId: "tfTjV8pOp1ZDVg4ZQ99R",
          productName: "integral",
          collectionId: "GRzDxeAWOj2HBhmlObSy",
          collectionName: "sourdough",
          quantity: 1,
          currentPrice: 23700,
          subtotal: 23700,
          isComplimentary: false,
          combination: {
            id: "tJ24gFRsSsgIQ57I",
            name: "Mediano",
            currentPrice: 23700,
          },
        },
      ],
    }),
    new Order({
      id: "order2",
      userId: "regularUser123", // B2C client (not in B2B list)
      dueDate: new Date("2026-04-03"),
      isComplimentary: false,
      orderItems: [
        {
          id: "item2",
          productId: "product2",
          productName: "Simple Product",
          collectionId: "HvG0VIiluQ3ULrgp7QSN",
          collectionName: "pastries",
          quantity: 2,
          currentPrice: 15000,
          subtotal: 30000,
          isComplimentary: false,
        },
      ],
    }),
    new Order({
      id: "order3",
      userId: "user3",
      dueDate: new Date("2026-04-04"),
      paymentMethod: "complimentary", // This makes isComplimentary = true
      orderItems: [],
    }),
  ];

  describe("Constructor", () => {
    describe("with default options", () => {
      it("should create instance with default options", () => {
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
        );

        expect(report.options).toEqual({
          categories: null,
          detailLevel: "product",
          period: null,
          metrics: "both",
          segment: "none",
          dateField: "dueDate",
          defaultDateRangeApplied: false,
        });
      });

      it("should filter out complimentary orders", () => {
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
        );

        expect(report.allOrders).toHaveLength(2);
        expect(report.allOrders[0].id).toBe("order1");
        expect(report.allOrders[1].id).toBe("order2");
      });

      it("should store b2b_clients and all_products for processing", () => {
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
        );

        expect(report.b2b_clients).toEqual(mockB2BClients);
        expect(report.all_products).toEqual(mockProducts);
      });
    });

    describe("with custom options", () => {
      it("should accept and set custom categories", () => {
        const options = { categories: ["cat1", "cat2"] };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.categories).toEqual(["cat1", "cat2"]);
      });

      it("should accept custom detailLevel", () => {
        const options = { detailLevel: "combination" };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.detailLevel).toBe("combination");
      });

      it("should accept custom period", () => {
        const options = { period: "daily" };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.period).toBe("daily");
      });

      it("should accept custom metrics", () => {
        const options = { metrics: "ingresos" };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.metrics).toBe("ingresos");
      });

      it("should accept custom segment", () => {
        const options = { segment: "b2b" };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.segment).toBe("b2b");
      });

      it("should accept custom dateField", () => {
        const options = { dateField: "paymentDate" };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.dateField).toBe("paymentDate");
      });

      it("should accept defaultDateRangeApplied flag", () => {
        const options = { defaultDateRangeApplied: true };
        const report = new ProductReport(
          mockOrders,
          mockB2BClients,
          mockProducts,
          options,
        );

        expect(report.options.defaultDateRangeApplied).toBe(true);
      });
    });

    describe("options validation", () => {
      it("should throw error for invalid detailLevel", () => {
        const options = { detailLevel: "invalid" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow('Invalid detailLevel: must be "product" or "combination"');
      });

      it("should throw error for invalid period", () => {
        const options = { period: "invalid" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow(
          'Invalid period: must be null, "daily", "weekly", or "monthly"',
        );
      });

      it("should throw error for invalid metrics", () => {
        const options = { metrics: "invalid" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow(
          'Invalid metrics: must be "ingresos", "cantidad", or "both"',
        );
      });

      it("should throw error for invalid segment", () => {
        const options = { segment: "invalid" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow('Invalid segment: must be "none", "all", "b2b", or "b2c"');
      });

      it("should throw error for invalid dateField", () => {
        const options = { dateField: "invalidDate" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow("Invalid dateField: must be a valid order date property");
      });

      it("should throw error for invalid categories type", () => {
        const options = { categories: "not-an-array" };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow("Invalid categories: must be an array or null");
      });

      it("should throw error for empty categories array", () => {
        const options = { categories: [] };

        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
        }).toThrow("Invalid categories: array cannot be empty");
      });
    });

    describe("input validation", () => {
      it("should throw error for missing orders", () => {
        expect(() => {
          new ProductReport(null, mockB2BClients, mockProducts);
        }).toThrow("Orders array is required");
      });

      it("should throw error for non-array orders", () => {
        expect(() => {
          new ProductReport("not-array", mockB2BClients, mockProducts);
        }).toThrow("Orders must be an array");
      });

      it("should throw error for missing b2b_clients", () => {
        expect(() => {
          new ProductReport(mockOrders, null, mockProducts);
        }).toThrow("B2B clients array is required");
      });

      it("should throw error for missing products", () => {
        expect(() => {
          new ProductReport(mockOrders, mockB2BClients, null);
        }).toThrow("Products array is required");
      });

      it("should handle empty arrays gracefully", () => {
        expect(() => {
          new ProductReport([], [], []);
        }).not.toThrow();
      });
    });
  });

  describe("flattenOrderItems", () => {
    // Helper factory for creating minimal test orders
    const createOrder = (overrides = {}) =>
      new Order({
        id: "order1",
        userId: "user1",
        dueDate: new Date("2026-04-01"),
        orderItems: [
          {
            id: "item1",
            productId: "product1",
            productName: "Test Product",
            collectionId: "category1",
            collectionName: "Test Category",
            subtotal: 1000,
            quantity: 1,
            currentPrice: 1000,
            isComplimentary: false,
          },
        ],
        ...overrides,
      });

    const createB2BClient = (id) => ({ id });

    it("should extract basic fields from single order item", () => {
      const order = createOrder();
      const b2bClients = [];
      const report = new ProductReport([order], b2bClients, mockProducts);

      const result = report.flattenOrderItems([order], b2bClients);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        orderId: "order1",
        orderItemId: "item1",
        productId: "product1",
        productName: "Test Product",
        categoryId: "category1",
        categoryName: "Test Category",
        ingresos: 1000,
        cantidad: 1,
        currentPrice: 1000,
      });
    });

    it("should identify B2B client correctly", () => {
      const order = createOrder({ userId: "b2b-client-1" });
      const b2bClients = [createB2BClient("b2b-client-1")];
      const report = new ProductReport([order], b2bClients, mockProducts);

      const result = report.flattenOrderItems([order], b2bClients);

      expect(result[0].isB2B).toBe(true);
    });

    it("should identify B2C client correctly", () => {
      const order = createOrder({ userId: "regular-user" });
      const b2bClients = [createB2BClient("b2b-client-1")];
      const report = new ProductReport([order], b2bClients, mockProducts);

      const result = report.flattenOrderItems([order], b2bClients);

      expect(result[0].isB2B).toBe(false);
    });

    it("should handle combination data", () => {
      const order = createOrder({
        orderItems: [
          {
            id: "item1",
            productId: "product1",
            productName: "Test Product",
            collectionId: "category1",
            collectionName: "Test Category",
            subtotal: 2000,
            quantity: 2,
            currentPrice: 1000,
            isComplimentary: false,
            combination: {
              id: "combo1",
              name: "Large",
            },
          },
        ],
      });
      const report = new ProductReport([order], [], mockProducts);

      const result = report.flattenOrderItems([order], []);

      expect(result[0]).toMatchObject({
        combinationId: "combo1",
        combinationName: "Large",
      });
    });

    it("should handle base product without combination", () => {
      const order = createOrder();
      const report = new ProductReport([order], [], mockProducts);

      const result = report.flattenOrderItems([order], []);

      expect(result[0].combinationId).toBeNull();
      expect(result[0].combinationName).toBeNull();
    });

    it("should extract date from order", () => {
      const testDate = new Date("2026-04-05");
      const order = createOrder({ dueDate: testDate });
      const report = new ProductReport([order], [], mockProducts);

      const result = report.flattenOrderItems([order], []);

      expect(result[0].date).toBe("2026-04-04"); // UTC date converted to Colombia timezone
    });

    it("should flatten multiple items from multiple orders", () => {
      const order1 = createOrder({
        id: "order1",
        orderItems: [
          {
            id: "item1",
            productId: "product1",
            subtotal: 1000,
            quantity: 1,
            currentPrice: 1000,
            isComplimentary: false,
          },
        ],
      });
      const order2 = createOrder({
        id: "order2",
        orderItems: [
          {
            id: "item2",
            productId: "product2",
            subtotal: 2000,
            quantity: 2,
            currentPrice: 1000,
            isComplimentary: false,
          },
        ],
      });
      const report = new ProductReport([order1, order2], [], mockProducts);

      const result = report.flattenOrderItems([order1, order2], []);

      expect(result).toHaveLength(2);
      expect(result[0].orderId).toBe("order1");
      expect(result[1].orderId).toBe("order2");
    });

    it("should filter out complimentary items", () => {
      const order = createOrder({
        orderItems: [
          {
            id: "item1",
            productId: "product1",
            subtotal: 1000,
            quantity: 1,
            currentPrice: 1000,
            isComplimentary: false,
          },
          {
            id: "item2",
            productId: "product2",
            subtotal: 2000,
            quantity: 2,
            currentPrice: 1000,
            isComplimentary: true,
          },
        ],
      });
      const report = new ProductReport([order], [], mockProducts);

      const result = report.flattenOrderItems([order], []);

      expect(result).toHaveLength(1);
      expect(result[0].orderItemId).toBe("item1");
    });

    it("should use correct dateField when flattening data", () => {
      // Order1 has dueDate: 2026-04-01, paymentDate: 2026-04-02
      const reportWithDueDate = new ProductReport(
        mockOrders,
        mockB2BClients,
        mockProducts,
        { dateField: "dueDate" },
      );
      const reportWithPaymentDate = new ProductReport(
        mockOrders,
        mockB2BClients,
        mockProducts,
        { dateField: "paymentDate" },
      );

      const dueDateResult = reportWithDueDate.flattenOrderItems(
        [mockOrders[0]],
        [],
      );
      const paymentDateResult = reportWithPaymentDate.flattenOrderItems(
        [mockOrders[0]],
        [],
      );

      // Should use different dates based on dateField
      expect(dueDateResult[0].date).toBe("2026-03-31"); // dueDate 2026-04-01 → Colombia 2026-03-31
      expect(paymentDateResult[0].date).toBe("2026-04-01"); // paymentDate 2026-04-02 → Colombia 2026-04-01
    });

    it("should show what flattened output looks like with mock data", () => {
      const report = new ProductReport(
        mockOrders,
        mockB2BClients,
        mockProducts,
      );
      const result = report.flattenOrderItems(mockOrders, mockB2BClients);

      console.log("=== FLATTENED OUTPUT ===");
      console.log(JSON.stringify(result, null, 2));

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("aggregateByCombination", () => {
    describe("Part 1: Basic Combination Grouping", () => {
      it("should group by combination when product has variations", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            combinationName: "Small",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            combinationName: "Small",
            ingresos: 1500,
            cantidad: 1,
            isB2B: true,
          },
          {
            productId: "p1",
            combinationId: "combo2",
            productName: "Product 1",
            combinationName: "Large",
            ingresos: 2000,
            cantidad: 1,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        // Should have 2 combinations
        expect(result).toHaveLength(2);

        // Find combo1 and combo2
        const combo1 = result.find((r) => r.combinationId === "combo1");
        const combo2 = result.find((r) => r.combinationId === "combo2");

        expect(combo1).toBeDefined();
        expect(combo1.productId).toBe("p1");
        expect(combo1.combinationName).toBe("Small");

        expect(combo2).toBeDefined();
        expect(combo2.productId).toBe("p1");
        expect(combo2.combinationName).toBe("Large");
      });

      it("should group by base product when no combination", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: null,
            productName: "Base Product",
            combinationName: null,
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: null,
            productName: "Base Product",
            combinationName: null,
            ingresos: 1500,
            cantidad: 1,
            isB2B: true,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        expect(result).toHaveLength(1);
        expect(result[0].productId).toBe("p1");
        expect(result[0].combinationId).toBeNull();
        expect(result[0].combinationName).toBeNull();
      });

      it("should handle mixed combination and base products", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            combinationName: "Small",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p2",
            combinationId: null,
            productName: "Product 2",
            combinationName: null,
            ingresos: 2000,
            cantidad: 1,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        expect(result).toHaveLength(2);

        const combo = result.find((r) => r.combinationId === "combo1");
        const base = result.find((r) => r.combinationId === null);

        expect(combo.productId).toBe("p1");
        expect(base.productId).toBe("p2");
      });
    });

    describe("Part 2: Aggregate Metrics Calculation", () => {
      it("should calculate total metrics for combination", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            ingresos: 1500,
            cantidad: 2,
            isB2B: true,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            ingresos: 500,
            cantidad: 1,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          ingresos: 3000, // 1000 + 1500 + 500
          cantidad: 4, // 1 + 2 + 1
          b2bIngresos: 1500, // only the B2B item
          b2cIngresos: 1500, // 1000 + 500
          b2bCantidad: 2, // only the B2B item
          b2cCantidad: 2, // 1 + 1
        });
      });

      it("should handle all B2B items", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            ingresos: 1000,
            cantidad: 1,
            isB2B: true,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            ingresos: 2000,
            cantidad: 1,
            isB2B: true,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        expect(result[0]).toMatchObject({
          ingresos: 3000,
          cantidad: 2,
          b2bIngresos: 3000,
          b2cIngresos: 0,
          b2bCantidad: 2,
          b2cCantidad: 0,
        });
      });

      it("should handle all B2C items", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: null,
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: null,
            ingresos: 500,
            cantidad: 2,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], []);
        const result = report.aggregateByCombination(flatData);

        expect(result[0]).toMatchObject({
          ingresos: 1500,
          cantidad: 3,
          b2bIngresos: 0,
          b2cIngresos: 1500,
          b2bCantidad: 0,
          b2cCantidad: 3,
        });
      });
    });

    describe("Part 3: Period Key Generation", () => {
      it("should generate daily period keys", () => {
        const report = new ProductReport([], [], [], { period: "daily" });

        expect(report.generatePeriodKey("2026-03-21")).toBe("2026-03-21");
        expect(report.generatePeriodKey("2026-12-01")).toBe("2026-12-01");
      });

      it("should generate weekly period keys (Monday to Sunday)", () => {
        const report = new ProductReport([], [], [], { period: "weekly" });

        // March 21, 2026 is a Saturday, should be in week starting March 16 (Monday)
        expect(report.generatePeriodKey("2026-03-21")).toBe(
          "2026-03-16/2026-03-22",
        );

        // March 16, 2026 is a Monday, should be start of its week
        expect(report.generatePeriodKey("2026-03-16")).toBe(
          "2026-03-16/2026-03-22",
        );

        // March 22, 2026 is a Sunday, should be end of same week
        expect(report.generatePeriodKey("2026-03-22")).toBe(
          "2026-03-16/2026-03-22",
        );
      });

      it("should generate monthly period keys", () => {
        const report = new ProductReport([], [], [], { period: "monthly" });

        expect(report.generatePeriodKey("2026-03-21")).toBe("2026-03");
        expect(report.generatePeriodKey("2026-12-01")).toBe("2026-12");
        expect(report.generatePeriodKey("2026-01-31")).toBe("2026-01");
      });

      it("should handle period is null", () => {
        const report = new ProductReport([], [], [], { period: null });

        expect(report.generatePeriodKey("2026-03-21")).toBeNull();
      });
    });

    describe("Part 4: Period Aggregation", () => {
      it("should add periods when period option is set", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            date: "2026-03-21",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            date: "2026-03-21",
            ingresos: 500,
            cantidad: 1,
            isB2B: true,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Product 1",
            date: "2026-03-22",
            ingresos: 2000,
            cantidad: 2,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], [], { period: "daily" });
        const result = report.aggregateByCombination(flatData);

        expect(result).toHaveLength(1);
        expect(result[0].periods).toBeDefined();
        expect(result[0].periods["2026-03-21"]).toEqual({
          ingresos: 1500, // 1000 + 500
          cantidad: 2, // 1 + 1
          b2bIngresos: 500,
          b2cIngresos: 1000,
          b2bCantidad: 1,
          b2cCantidad: 1,
        });
        expect(result[0].periods["2026-03-22"]).toEqual({
          ingresos: 2000,
          cantidad: 2,
          b2bIngresos: 0,
          b2cIngresos: 2000,
          b2bCantidad: 0,
          b2cCantidad: 2,
        });
      });

      it("should not add periods when period is null", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            date: "2026-03-21",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], [], { period: null });
        const result = report.aggregateByCombination(flatData);

        expect(result[0].periods).toBeUndefined();
      });

      it("should handle weekly period aggregation", () => {
        const flatData = [
          {
            productId: "p1",
            combinationId: "combo1",
            date: "2026-03-16",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          }, // Monday
          {
            productId: "p1",
            combinationId: "combo1",
            date: "2026-03-22",
            ingresos: 2000,
            cantidad: 1,
            isB2B: true,
          }, // Sunday (same week)
          {
            productId: "p1",
            combinationId: "combo1",
            date: "2026-03-23",
            ingresos: 3000,
            cantidad: 1,
            isB2B: false,
          }, // Monday (next week)
        ];

        const report = new ProductReport([], [], [], { period: "weekly" });
        const result = report.aggregateByCombination(flatData);

        expect(Object.keys(result[0].periods)).toHaveLength(2);
        expect(result[0].periods["2026-03-16/2026-03-22"]).toEqual({
          ingresos: 3000, // 1000 + 2000
          cantidad: 2,
          b2bIngresos: 2000,
          b2cIngresos: 1000,
          b2bCantidad: 1,
          b2cCantidad: 1,
        });
        expect(result[0].periods["2026-03-23/2026-03-29"]).toEqual({
          ingresos: 3000,
          cantidad: 1,
          b2bIngresos: 0,
          b2cIngresos: 3000,
          b2bCantidad: 0,
          b2cCantidad: 1,
        });
      });
    });

    describe("Part 5: Complete Integration", () => {
      it("should handle complete aggregation with mixed data", () => {
        const flatData = [
          // Product 1, Combination 1 - Multiple dates and B2B/B2C
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Bread",
            combinationName: "Small",
            categoryId: "cat1",
            categoryName: "Bakery",
            date: "2026-03-21",
            ingresos: 1000,
            cantidad: 1,
            isB2B: false,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Bread",
            combinationName: "Small",
            categoryId: "cat1",
            categoryName: "Bakery",
            date: "2026-03-21",
            ingresos: 1500,
            cantidad: 1,
            isB2B: true,
          },
          {
            productId: "p1",
            combinationId: "combo1",
            productName: "Bread",
            combinationName: "Small",
            categoryId: "cat1",
            categoryName: "Bakery",
            date: "2026-03-22",
            ingresos: 2000,
            cantidad: 2,
            isB2B: false,
          },

          // Product 1, Combination 2
          {
            productId: "p1",
            combinationId: "combo2",
            productName: "Bread",
            combinationName: "Large",
            categoryId: "cat1",
            categoryName: "Bakery",
            date: "2026-03-21",
            ingresos: 3000,
            cantidad: 1,
            isB2B: true,
          },

          // Product 2, No combination
          {
            productId: "p2",
            combinationId: null,
            productName: "Cookie",
            combinationName: null,
            categoryId: "cat2",
            categoryName: "Sweets",
            date: "2026-03-22",
            ingresos: 500,
            cantidad: 3,
            isB2B: false,
          },
        ];

        const report = new ProductReport([], [], [], { period: "daily" });
        const result = report.aggregateByCombination(flatData);

        // Should have 3 combinations: p1-combo1, p1-combo2, p2-base
        expect(result).toHaveLength(3);

        // Test Product 1, Combination 1
        const p1combo1 = result.find(
          (r) => r.productId === "p1" && r.combinationId === "combo1",
        );
        expect(p1combo1).toMatchObject({
          productName: "Bread",
          combinationName: "Small",
          categoryName: "Bakery",
          ingresos: 4500, // 1000 + 1500 + 2000
          cantidad: 4, // 1 + 1 + 2
          b2bIngresos: 1500,
          b2cIngresos: 3000, // 1000 + 2000
          b2bCantidad: 1,
          b2cCantidad: 3, // 1 + 2
        });

        // Test periods for p1combo1
        expect(p1combo1.periods["2026-03-21"]).toEqual({
          ingresos: 2500,
          cantidad: 2,
          b2bIngresos: 1500,
          b2cIngresos: 1000,
          b2bCantidad: 1,
          b2cCantidad: 1,
        });
        expect(p1combo1.periods["2026-03-22"]).toEqual({
          ingresos: 2000,
          cantidad: 2,
          b2bIngresos: 0,
          b2cIngresos: 2000,
          b2bCantidad: 0,
          b2cCantidad: 2,
        });

        // Test Product 2, no combination
        const p2base = result.find(
          (r) => r.productId === "p2" && r.combinationId === null,
        );
        expect(p2base).toMatchObject({
          productName: "Cookie",
          combinationName: null,
          ingresos: 500,
          cantidad: 3,
          b2bIngresos: 0,
          b2cIngresos: 500,
          b2bCantidad: 0,
          b2cCantidad: 3,
        });
        expect(p2base.periods["2026-03-22"]).toEqual({
          ingresos: 500,
          cantidad: 3,
          b2bIngresos: 0,
          b2cIngresos: 500,
          b2bCantidad: 0,
          b2cCantidad: 3,
        });
      });
    });
  });

  describe("transformToOutput", () => {
    // Sample combination data from Step 2
    const mockCombinationData = [
      {
        productId: "p1",
        combinationId: "combo1",
        productName: "Bread",
        combinationName: "Small",
        categoryId: "cat1",
        categoryName: "Bakery",
        ingresos: 3000,
        cantidad: 3,
        b2bIngresos: 1000,
        b2cIngresos: 2000,
        b2bCantidad: 1,
        b2cCantidad: 2,
        periods: {
          "2026-03-21": {
            ingresos: 1500,
            cantidad: 2,
            b2bIngresos: 500,
            b2cIngresos: 1000,
            b2bCantidad: 1,
            b2cCantidad: 1,
          },
          "2026-03-22": {
            ingresos: 1500,
            cantidad: 1,
            b2bIngresos: 500,
            b2cIngresos: 1000,
            b2bCantidad: 0,
            b2cCantidad: 1,
          },
        },
      },
    ];

    describe("Part 1: Segment Filtering", () => {
      it("should show totals only when segment is 'none'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applySegmentFiltering(item, "none");

        expect(item).toMatchObject({
          ingresos: 3000,
          cantidad: 3,
        });
        expect(item).not.toHaveProperty("b2bIngresos");
        expect(item).not.toHaveProperty("b2cIngresos");
      });

      it("should show totals with B2B/B2C breakdown when segment is 'all'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applySegmentFiltering(item, "all");

        expect(item).toMatchObject({
          ingresos: 3000,
          cantidad: 3,
          b2bIngresos: 1000,
          b2cIngresos: 2000,
          b2bCantidad: 1,
          b2cCantidad: 2,
        });
      });

      it("should filter to only B2B metrics when segment is 'b2b'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applySegmentFiltering(item, "b2b");

        expect(item).toMatchObject({
          ingresos: 1000, // Only b2bIngresos
          cantidad: 1, // Only b2bCantidad
        });
        expect(item).not.toHaveProperty("b2bIngresos");
        expect(item).not.toHaveProperty("b2cIngresos");
      });

      it("should filter to only B2C metrics when segment is 'b2c'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applySegmentFiltering(item, "b2c");

        expect(item).toMatchObject({
          ingresos: 2000, // Only b2cIngresos
          cantidad: 2, // Only b2cCantidad
        });
        expect(item).not.toHaveProperty("b2bIngresos");
        expect(item).not.toHaveProperty("b2cIngresos");
      });

      it("should apply segment filtering to periods as well", () => {
        const report = new ProductReport([], [], [], {
          segment: "b2b",
          period: "daily",
        });
        const result = report.transformToOutput(mockCombinationData);

        expect(result[0].periods["2026-03-21"]).toEqual({
          ingresos: 500,
          cantidad: 1,
        });
        expect(result[0].periods["2026-03-22"]).toEqual({
          ingresos: 500,
          cantidad: 0,
        });
      });
    });

    describe("Part 2: Metrics Filtering", () => {
      it("should keep only revenue metrics when metrics is 'ingresos' with segment 'all'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applyMetricsFiltering(item, "ingresos");

        expect(item).toMatchObject({
          ingresos: 3000,
          b2bIngresos: 1000,
          b2cIngresos: 2000,
        });
        expect(item).not.toHaveProperty("cantidad");
        expect(item).not.toHaveProperty("b2bCantidad");
        expect(item).not.toHaveProperty("b2cCantidad");
      });

      it("should keep only quantity metrics when metrics is 'cantidad' with segment 'all'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applyMetricsFiltering(item, "cantidad");

        expect(item).toMatchObject({
          cantidad: 3,
          b2bCantidad: 1,
          b2cCantidad: 2,
        });
        expect(item).not.toHaveProperty("ingresos");
        expect(item).not.toHaveProperty("b2bIngresos");
        expect(item).not.toHaveProperty("b2cIngresos");
      });

      it("should keep all metrics when metrics is 'both' with segment 'all'", () => {
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applyMetricsFiltering(item, "both");

        expect(item).toMatchObject({
          ingresos: 3000,
          cantidad: 3,
          b2bIngresos: 1000,
          b2cIngresos: 2000,
          b2bCantidad: 1,
          b2cCantidad: 2,
        });
      });

      it("should keep only revenue totals when metrics is 'ingresos' with segment 'none'", () => {
        // Apply both segment filtering (removes B2B/B2C) and metrics filtering (removes quantity)
        const item = JSON.parse(JSON.stringify(mockCombinationData[0]));
        ProductReport.applySegmentFiltering(item, "none");
        ProductReport.applyMetricsFiltering(item, "ingresos");

        expect(item).toMatchObject({
          ingresos: 3000,
        });
        expect(item).not.toHaveProperty("cantidad");
        expect(item).not.toHaveProperty("b2bIngresos");
        expect(item).not.toHaveProperty("b2cIngresos");
        expect(item).not.toHaveProperty("b2bCantidad");
        expect(item).not.toHaveProperty("b2cCantidad");
      });

      it("should apply metrics filtering to periods as well", () => {
        const report = new ProductReport([], [], [], {
          metrics: "ingresos",
          segment: "all",
          period: "daily",
        });
        const result = report.transformToOutput(mockCombinationData);

        expect(result[0].periods["2026-03-21"]).toEqual({
          ingresos: 1500,
          b2bIngresos: 500,
          b2cIngresos: 1000,
        });
        expect(result[0].periods["2026-03-21"]).not.toHaveProperty("cantidad");
      });
    });

    describe("Part 3: Detail Level Grouping", () => {
      const mockCombinationDataForGrouping = [
        {
          productId: "p1",
          combinationId: "combo1",
          productName: "Bread",
          combinationName: "Small",
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 1500,
          cantidad: 2,
          b2bIngresos: 500,
          b2cIngresos: 1000,
          b2bCantidad: 1,
          b2cCantidad: 1,
          periods: {
            "2026-03-21": {
              ingresos: 1000,
              cantidad: 1,
              b2bIngresos: 300,
              b2cIngresos: 700,
              b2bCantidad: 0,
              b2cCantidad: 1,
            },
            "2026-03-22": {
              ingresos: 500,
              cantidad: 1,
              b2bIngresos: 200,
              b2cIngresos: 300,
              b2bCantidad: 1,
              b2cCantidad: 0,
            },
          },
        },
        {
          productId: "p1",
          combinationId: "combo2",
          productName: "Bread",
          combinationName: "Large",
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 2500,
          cantidad: 3,
          b2bIngresos: 1000,
          b2cIngresos: 1500,
          b2bCantidad: 1,
          b2cCantidad: 2,
          periods: {
            "2026-03-21": {
              ingresos: 1500,
              cantidad: 2,
              b2bIngresos: 600,
              b2cIngresos: 900,
              b2bCantidad: 1,
              b2cCantidad: 1,
            },
            "2026-03-22": {
              ingresos: 1000,
              cantidad: 1,
              b2bIngresos: 400,
              b2cIngresos: 600,
              b2bCantidad: 0,
              b2cCantidad: 1,
            },
          },
        },
        {
          productId: "p2",
          combinationId: null,
          productName: "Cookie",
          combinationName: null,
          categoryId: "cat2",
          categoryName: "Sweets",
          ingresos: 800,
          cantidad: 4,
          b2bIngresos: 200,
          b2cIngresos: 600,
          b2bCantidad: 1,
          b2cCantidad: 3,
          periods: {
            "2026-03-22": {
              ingresos: 800,
              cantidad: 4,
              b2bIngresos: 200,
              b2cIngresos: 600,
              b2bCantidad: 1,
              b2cCantidad: 3,
            },
          },
        },
      ];

      it("should keep combinations when detailLevel is 'combination'", () => {
        const result = ProductReport.applyDetailLevelGrouping(
          mockCombinationDataForGrouping,
          "combination",
        );

        // Should have 3 items (2 combinations + 1 base product)
        expect(result).toHaveLength(3);
        expect(
          result.find(
            (r) => r.productId === "p1" && r.combinationId === "combo1",
          ),
        ).toBeDefined();
        expect(
          result.find(
            (r) => r.productId === "p1" && r.combinationId === "combo2",
          ),
        ).toBeDefined();
        expect(
          result.find((r) => r.productId === "p2" && r.combinationId === null),
        ).toBeDefined();
      });

      it("should group combinations into products when detailLevel is 'product'", () => {
        const result = ProductReport.applyDetailLevelGrouping(
          mockCombinationDataForGrouping,
          "product",
        );

        // Should have 2 products (p1 and p2)
        expect(result).toHaveLength(2);

        // Find product p1 (should combine combo1 + combo2)
        const p1 = result.find((r) => r.productId === "p1");
        expect(p1).toMatchObject({
          productId: "p1",
          combinationId: null,
          productName: "Bread",
          combinationName: null,
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 4000, // 1500 + 2500
          cantidad: 5, // 2 + 3
          b2bIngresos: 1500, // 500 + 1000
          b2cIngresos: 2500, // 1000 + 1500
          b2bCantidad: 2, // 1 + 1
          b2cCantidad: 3, // 1 + 2
        });

        // Find product p2 (already a base product)
        const p2 = result.find((r) => r.productId === "p2");
        expect(p2).toMatchObject({
          productId: "p2",
          combinationId: null,
          productName: "Cookie",
          combinationName: null,
          ingresos: 800,
          cantidad: 4,
        });
      });

      it("should group to product level with segment 'none' (no breakdown fields)", () => {
        // First apply segment filtering to remove B2B/B2C fields, then group
        const segmentFiltered = mockCombinationDataForGrouping.map((item) => {
          const copy = JSON.parse(JSON.stringify(item));
          ProductReport.applySegmentFiltering(copy, "none");
          return copy;
        });
        const result = ProductReport.applyDetailLevelGrouping(
          segmentFiltered,
          "product",
        );

        const p1 = result.find((r) => r.productId === "p1");
        expect(p1).toMatchObject({
          productId: "p1",
          combinationId: null,
          productName: "Bread",
          ingresos: 4000, // 1500 + 2500
          cantidad: 5, // 2 + 3
        });
        // Should not have breakdown fields
        expect(p1).not.toHaveProperty("b2bIngresos");
        expect(p1).not.toHaveProperty("b2cIngresos");
      });

      it("should aggregate periods when grouping to product level", () => {
        const report = new ProductReport([], [], [], {
          detailLevel: "product",
          segment: "all",
          period: "daily",
        });
        const result = report.transformToOutput(mockCombinationDataForGrouping);

        const p1 = result.find((r) => r.productId === "p1");

        // Periods should be combined: combo1 + combo2 per date
        expect(p1.periods["2026-03-21"]).toEqual({
          ingresos: 2500, // 1000 + 1500
          cantidad: 3, // 1 + 2
          b2bIngresos: 900, // 300 + 600
          b2cIngresos: 1600, // 700 + 900
          b2bCantidad: 1, // 0 + 1
          b2cCantidad: 2, // 1 + 1
        });

        expect(p1.periods["2026-03-22"]).toEqual({
          ingresos: 1500, // 500 + 1000
          cantidad: 2, // 1 + 1
          b2bIngresos: 600, // 200 + 400
          b2cIngresos: 900, // 300 + 600
          b2bCantidad: 1, // 1 + 0
          b2cCantidad: 1, // 0 + 1
        });
      });
    });

    describe("Part 4: Category Filtering", () => {
      const mockCombinationDataForCategories = [
        {
          productId: "p1",
          combinationId: "combo1",
          productName: "Bread",
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 1000,
          cantidad: 2,
        },
        {
          productId: "p2",
          combinationId: null,
          productName: "Cookie",
          categoryId: "cat2",
          categoryName: "Sweets",
          ingresos: 500,
          cantidad: 1,
        },
        {
          productId: "p3",
          combinationId: "combo2",
          productName: "Cake",
          categoryId: "cat2",
          categoryName: "Sweets",
          ingresos: 800,
          cantidad: 1,
        },
        {
          productId: "p4",
          combinationId: null,
          productName: "Sandwich",
          categoryId: "cat3",
          categoryName: "Savory",
          ingresos: 600,
          cantidad: 1,
        },
      ];

      it("should return all items when categories is null", () => {
        const result = ProductReport.applyCategoryFiltering(
          mockCombinationDataForCategories,
          null,
        );

        expect(result).toHaveLength(4);
      });

      it("should filter by single category", () => {
        const result = ProductReport.applyCategoryFiltering(
          mockCombinationDataForCategories,
          ["cat1"],
        );

        expect(result).toHaveLength(1);
        expect(result[0].categoryId).toBe("cat1");
        expect(result[0].productName).toBe("Bread");
      });

      it("should filter by multiple categories", () => {
        const result = ProductReport.applyCategoryFiltering(
          mockCombinationDataForCategories,
          ["cat1", "cat3"],
        );

        expect(result).toHaveLength(2);

        const categoryIds = result.map((r) => r.categoryId);
        expect(categoryIds).toContain("cat1");
        expect(categoryIds).toContain("cat3");
        expect(categoryIds).not.toContain("cat2");
      });

      it("should return empty array when filtering by non-existent category", () => {
        const result = ProductReport.applyCategoryFiltering(
          mockCombinationDataForCategories,
          ["nonexistent"],
        );

        expect(result).toHaveLength(0);
      });

      it("should filter after detail level grouping", () => {
        // Test that category filtering works after product-level grouping
        const result = ProductReport.applyCategoryFiltering(
          mockCombinationDataForCategories,
          ["cat2"],
        );

        // Should have 2 products (p2 and p3 are separate products in cat2, p1 and p4 filtered out)
        expect(result).toHaveLength(2);

        const productIds = result.map((r) => r.productId);
        expect(productIds).toContain("p2");
        expect(productIds).toContain("p3");

        // All should be in cat2
        result.forEach((item) => {
          expect(item.categoryId).toBe("cat2");
        });
      });
    });

    describe("Part 5: Final Output Formatting", () => {
      const mockDataForFinalFormatting = [
        {
          productId: "p1",
          combinationId: null,
          productName: "Bread",
          combinationName: null,
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 500,
          cantidad: 2,
          b2bIngresos: 200,
          b2cIngresos: 300,
          b2bCantidad: 1,
          b2cCantidad: 1,
          periods: {
            "2026-03-21": {
              ingresos: 300,
              cantidad: 1,
              b2bIngresos: 100,
              b2cIngresos: 200,
              b2bCantidad: 1,
              b2cCantidad: 0,
            },
            "2026-03-22": {
              ingresos: 200,
              cantidad: 1,
              b2bIngresos: 100,
              b2cIngresos: 100,
              b2bCantidad: 0,
              b2cCantidad: 1,
            },
          },
        },
        {
          productId: "p2",
          combinationId: "combo1",
          productName: "Cookie",
          combinationName: "Large",
          categoryId: "cat1",
          categoryName: "Bakery",
          ingresos: 0,
          cantidad: 0,
          b2bIngresos: 0,
          b2cIngresos: 0,
          b2bCantidad: 0,
          b2cCantidad: 0,
          periods: {},
        },
      ];

      it("should calculate avgPrice correctly", () => {
        const result = ProductReport.applyFinalFormatting(
          mockDataForFinalFormatting,
        );

        expect(result[0]).toHaveProperty("avgPrice", 250); // 500 / 2 = 250
        expect(result[1]).toHaveProperty("avgPrice", 0); // 0 / 0 = 0
      });

      it("should add avgPrice field for all segments", () => {
        const testCases = ["none", "all", "b2b", "b2c"];

        testCases.forEach((segment) => {
          const result = ProductReport.applyFinalFormatting(
            mockDataForFinalFormatting,
          );

          result.forEach((item) => {
            expect(item).toHaveProperty("avgPrice");
            expect(typeof item.avgPrice).toBe("number");
          });
        });
      });

      it("should sort products by totalIngresos descending", () => {
        const unsortedData = [
          {
            productId: "p1",
            combinationId: null,
            productName: "Low Sales",
            categoryId: "cat1",
            categoryName: "Bakery",
            ingresos: 100,
            cantidad: 1,
          },
          {
            productId: "p2",
            combinationId: null,
            productName: "High Sales",
            categoryId: "cat1",
            categoryName: "Bakery",
            ingresos: 1000,
            cantidad: 2,
          },
          {
            productId: "p3",
            combinationId: null,
            productName: "Medium Sales",
            categoryId: "cat1",
            categoryName: "Bakery",
            ingresos: 500,
            cantidad: 1,
          },
        ];

        const result = ProductReport.applyFinalFormatting(unsortedData);

        expect(result[0].productName).toBe("High Sales");
        expect(result[1].productName).toBe("Medium Sales");
        expect(result[2].productName).toBe("Low Sales");
        expect(result[0].totalIngresos).toBe(1000);
        expect(result[1].totalIngresos).toBe(500);
        expect(result[2].totalIngresos).toBe(100);
      });

      it("should rename ingresos to totalIngresos and cantidad to totalCantidad", () => {
        const result = ProductReport.applyFinalFormatting(
          mockDataForFinalFormatting,
        );

        result.forEach((item) => {
          expect(item).toHaveProperty("totalIngresos");
          expect(item).toHaveProperty("totalCantidad");
          expect(item).not.toHaveProperty("ingresos");
          expect(item).not.toHaveProperty("cantidad");
        });
      });

      it("should preserve period structure without renaming", () => {
        const result = ProductReport.applyFinalFormatting(
          mockDataForFinalFormatting,
        );

        const itemWithPeriods = result.find((item) => item.productId === "p1");
        expect(itemWithPeriods).toHaveProperty("periods");
        expect(itemWithPeriods.periods["2026-03-21"]).toHaveProperty(
          "ingresos",
        );
        expect(itemWithPeriods.periods["2026-03-21"]).toHaveProperty(
          "cantidad",
        );
        expect(itemWithPeriods.periods["2026-03-21"]).not.toHaveProperty(
          "totalIngresos",
        );
      });

      it("should handle empty periods correctly", () => {
        const result = ProductReport.applyFinalFormatting(
          mockDataForFinalFormatting,
        );

        const emptyItem = result.find((item) => item.productId === "p2");
        expect(emptyItem).toHaveProperty("periods");
        expect(emptyItem.periods).toEqual({});
      });
    });
  });

  // Integration tests for common option combinations
  describe("Integration Tests - Full Pipeline", () => {
    let mockOrders, mockB2BClients, mockProducts;

    beforeEach(() => {
      mockOrders = [
        {
          id: "order1",
          userId: "b2b-client-1",
          dueDate: "2026-03-21T10:00:00Z",
          isComplimentary: false,
          orderItems: [
            {
              id: "item1",
              productId: "p1",
              productName: "Sourdough Bread",
              collectionId: "cat1",
              collectionName: "Bakery",
              quantity: 2,
              subtotal: 1000,
              currentPrice: 500,
              isComplimentary: false,
              combination: { id: "combo1", name: "Large" },
            },
            {
              id: "item2",
              productId: "p2",
              productName: "Chocolate Chip Cookie",
              collectionId: "cat2",
              collectionName: "Desserts",
              quantity: 5,
              subtotal: 1500,
              currentPrice: 300,
              isComplimentary: false,
              combination: null,
            },
          ],
        },
        {
          id: "order2",
          userId: "regular-customer",
          dueDate: "2026-03-21T14:00:00Z",
          isComplimentary: false,
          orderItems: [
            {
              id: "item3",
              productId: "p1",
              productName: "Sourdough Bread",
              collectionId: "cat1",
              collectionName: "Bakery",
              quantity: 1,
              subtotal: 600,
              currentPrice: 600,
              isComplimentary: false,
              combination: { id: "combo2", name: "Medium" },
            },
            {
              id: "item4",
              productId: "p3",
              productName: "Croissant",
              collectionId: "cat1",
              collectionName: "Bakery",
              quantity: 3,
              subtotal: 900,
              currentPrice: 300,
              isComplimentary: false,
              combination: null,
            },
          ],
        },
      ];

      mockB2BClients = [{ id: "b2b-client-1" }];

      mockProducts = [
        { id: "p1", name: "Sourdough Bread" },
        { id: "p2", name: "Chocolate Chip Cookie" },
        { id: "p3", name: "Croissant" },
      ];
    });

    it("should handle product-level B2B segment with revenue-only metrics", () => {
      const options = {
        detailLevel: "product",
        segment: "b2b",
        metrics: "ingresos",
        categories: null,
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      expect(result.products).toHaveLength(3); // All products (p1, p2, p3) but filtered to B2B values

      // Find p1 which should have B2B sales
      const p1 = result.products.find(p => p.productId === "p1");
      expect(p1).toMatchObject({
        productId: "p1",
        productName: "Sourdough Bread",
        combinationId: null,
        totalIngresos: 1000, // Only B2B revenue from combo1
      });
      // avgPrice should not exist when metrics='ingresos' (quantity data removed)
      expect(p1.avgPrice).toBeUndefined();
      expect(p1).not.toHaveProperty("totalCantidad"); // Metrics filtered to ingresos only
      expect(p1).not.toHaveProperty("b2bIngresos"); // Segment filtered to B2B only

      // Find p2 which has B2B sales and p3 which doesn't
      const p2 = result.products.find(p => p.productId === "p2");
      expect(p2).toMatchObject({
        productId: "p2",
        totalIngresos: 1500, // B2B revenue from order1
      });
      expect(p2.avgPrice).toBeUndefined(); // No avgPrice for revenue-only metrics

      const p3 = result.products.find(p => p.productId === "p3");
      expect(p3).toMatchObject({
        productId: "p3",
        totalIngresos: 0, // No B2B sales (only in B2C order2)
      });
      expect(p3.avgPrice).toBeUndefined(); // No avgPrice for revenue-only metrics
    });

    it("should handle combination-level B2C segment with both metrics", () => {
      const options = {
        detailLevel: "combination",
        segment: "b2c",
        metrics: "both",
        categories: null,
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      // Should have 4 combinations: p1-combo1 (B2B->0), p1-combo2 (B2C), p2-base (B2B->0), p3-base (B2C)
      expect(result.products).toHaveLength(4);

      const p1Combo2 = result.products.find(p => p.productId === "p1" && p.combinationId === "combo2");
      expect(p1Combo2).toMatchObject({
        productId: "p1",
        combinationId: "combo2",
        combinationName: "Medium",
        avgPrice: 600,
        totalIngresos: 600,
        totalCantidad: 1,
      });

      const p2Base = result.products.find(p => p.productId === "p2");
      expect(p2Base).toMatchObject({
        productId: "p2",
        combinationId: null,
        avgPrice: 0, // 0 revenue / 0 quantity = 0 (valid avgPrice calculation)
        totalIngresos: 0, // B2B item filtered to B2C = 0
        totalCantidad: 0,
      });

      const p3Base = result.products.find(p => p.productId === "p3");
      expect(p3Base).toMatchObject({
        productId: "p3",
        combinationId: null,
        avgPrice: 300,
        totalIngresos: 900,
        totalCantidad: 3,
      });
    });

    it("should handle category filtering with all segment breakdown", () => {
      const options = {
        detailLevel: "product",
        segment: "all",
        metrics: "both",
        categories: ["cat1"], // Only Bakery items
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      // Should have 2 products: p1 (Bakery) and p3 (Bakery), p2 filtered out
      expect(result.products).toHaveLength(2);

      const p1 = result.products.find(p => p.productId === "p1");
      expect(p1).toMatchObject({
        productId: "p1",
        categoryId: "cat1",
        categoryName: "Bakery",
        avgPrice: 533.3333333333334, // 1600 / 3 (total revenue / total quantity)
        totalIngresos: 1600, // 1000 + 600
        totalCantidad: 3, // 2 + 1
        b2bIngresos: 1000,
        b2cIngresos: 600,
        b2bCantidad: 2,
        b2cCantidad: 1,
      });

      const p3 = result.products.find(p => p.productId === "p3");
      expect(p3).toMatchObject({
        productId: "p3",
        categoryId: "cat1",
        avgPrice: 300,
        totalIngresos: 900,
        totalCantidad: 3,
        b2bIngresos: 0,
        b2cIngresos: 900,
        b2bCantidad: 0,
        b2cCantidad: 3,
      });
    });

    it("should handle quantity-only metrics with no segment breakdown", () => {
      const options = {
        detailLevel: "combination",
        segment: "none",
        metrics: "cantidad",
        categories: null,
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      expect(result.products).toHaveLength(4); // All combinations

      result.products.forEach(product => {
        expect(product).toHaveProperty("totalCantidad");
        // For quantity-only metrics, totalIngresos might be undefined or absent
        expect(product.totalIngresos).toBeUndefined();
        expect(product.b2bCantidad).toBeUndefined();
        expect(product.b2cCantidad).toBeUndefined();
        expect(product.avgPrice).toBeUndefined(); // No price calc for quantity-only
      });

      const p1Combo1 = result.products.find(p => p.productId === "p1" && p.combinationId === "combo1");
      expect(p1Combo1).toMatchObject({
        productId: "p1",
        combinationId: "combo1",
        totalCantidad: 2,
      });
    });

    it("should properly sort results by totalIngresos in final formatting", () => {
      const options = {
        detailLevel: "product",
        segment: "none",
        metrics: "both",
        categories: null,
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      // Products should be sorted by totalIngresos descending
      expect(result.products).toHaveLength(3);
      expect(result.products[0].totalIngresos).toBeGreaterThanOrEqual(result.products[1].totalIngresos);
      expect(result.products[1].totalIngresos).toBeGreaterThanOrEqual(result.products[2].totalIngresos);

      // Verify the highest revenue product is p1 (1600 total)
      expect(result.products[0].productId).toBe("p1");
      expect(result.products[0].totalIngresos).toBe(1600);
    });

    it("should include intermediate data in metadata for debugging", () => {
      const options = {
        detailLevel: "product",
        segment: "all",
        metrics: "both",
        categories: null,
      };

      const report = new ProductReport(mockOrders, mockB2BClients, mockProducts, options);
      const result = report.generateReport();

      expect(result.metadata).toHaveProperty("intermediateData");
      expect(result.metadata.intermediateData).toHaveProperty("step1_flattened");
      expect(result.metadata.intermediateData).toHaveProperty("step2_aggregated");
      expect(result.metadata.intermediateData).toHaveProperty("step3_transformed");

      // Verify step1 flattened data has correct structure
      const step1 = result.metadata.intermediateData.step1_flattened;
      expect(step1).toHaveLength(4); // 4 order items
      expect(step1[0]).toHaveProperty("productId");
      expect(step1[0]).toHaveProperty("combinationId");
      expect(step1[0]).toHaveProperty("isB2B");
      expect(step1[0]).toHaveProperty("ingresos");
      expect(step1[0]).toHaveProperty("cantidad");
    });
  });
});
