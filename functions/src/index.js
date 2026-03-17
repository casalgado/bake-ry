require('dotenv').config();
const express = require('express');
const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const whatsappRoutes = require("./routes/whatsappRoutes");
const bakeryRoutes = require("./routes/bakeryRoutes");
const productRoutes = require("./routes/productRoutes");
const ingredientRoutes = require("./routes/ingredientRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const bakeryUserRoutes = require("./routes/bakeryUserRoutes");
const bakerySettingsRoutes = require("./routes/bakerySettingsRoutes");
const orderRoutes = require("./routes/orderRoutes");
const productCollectionRoutes = require("./routes/productCollectionRoutes");
const payuRoutes = require("./routes/payuRoutes");
const billingRoutes = require("./routes/billingRoutes");
const systemSettingsRoutes = require("./routes/systemSettingsRoutes");

const requestLogger = require("./middleware/requestLogger");

const app = express();

// CORS configuration
const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Public routes
app.use("/auth", authRoutes);
app.use("/whatsapp", whatsappRoutes);

// Protected routes
app.use("/bakeries", bakeryRoutes);
app.use("/bakeries", productRoutes);
app.use("/bakeries", ingredientRoutes);
app.use("/bakeries", recipeRoutes);
app.use("/bakeries", bakeryUserRoutes);
app.use("/bakeries", bakerySettingsRoutes);
app.use("/bakeries", orderRoutes);
app.use("/bakeries", productCollectionRoutes);
app.use("/bakeries", payuRoutes);

// Admin routes (not bakery-scoped)
app.use("/", systemSettingsRoutes);
app.use("/", billingRoutes);

// Export the Express app as a Firebase Function v2 with scaling configuration
exports.bake = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
    maxInstances: 10, // Limit max instances to control costs
    concurrency: 80, // Allow up to 80 concurrent requests per instance
    region: "us-central1",
  },
  app,
);
