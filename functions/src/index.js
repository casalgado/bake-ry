/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions


const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

 */

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
require("dotenv").config();
const express = require("express");
const { functions } = require("./config/firebase");
const { authenticateUser } = require("./middleware/userAccess");
const { bakeryAccess } = require("./middleware/bakeryAccess");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const bakeryRoutes = require("./routes/bakeryRoutes");
const productRoutes = require("./routes/productRoutes");
// const userRoutes = require("./routes/userRoutes");

const app = express();

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5173", // Vite default development port
    "http://localhost:3000", // Alternative development port
    "https://bake-ry.web.app", // Your production domain (adjust this)
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public routes
app.use("/auth", userRoutes);

// Protected routes
app.use("/bakeries", authenticateUser, bakeryRoutes);
app.use("/products", authenticateUser, productRoutes);
// app.use("/user", authenticateUser, userRoutes);

// Export the Express app as a Firebase Function
exports.bake = functions.https.onRequest(app);
