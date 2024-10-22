const express = require("express");
const { authenticateUser } = require("../middleware/userAccess");
const { requireSystemAdmin } = require("../middleware/userAccess");
const bakeryController = require("../controllers/bakeryController");

const router = express.Router();

// Create bakery (only system admin)
router.post("/", bakeryController.createBakery);

// Get all bakeries
router.get("/", bakeryController.getAllBakeries);

// Get a specific bakery
router.get("/:id", bakeryController.getBakery);

// Update a bakery (only system admin)
router.put("/:id", bakeryController.updateBakery);

// Delete a bakery (only system admin)
router.delete("/:id", bakeryController.deleteBakery);

module.exports = router;

/**
 * 
WITH ROUTE GUARDS

// Create bakery (only system admin)
router.post('/', authenticateUser, requireSystemAdmin, bakeryController.createBakery);

// Get all bakeries
router.get('/', authenticateUser, bakeryController.getAllBakeries);

// Get a specific bakery
router.get('/:id', authenticateUser, bakeryController.getBakery);

// Update a bakery (only system admin)
router.put('/:id', authenticateUser, requireSystemAdmin, bakeryController.updateBakery);

// Delete a bakery (only system admin)
router.delete('/:id', authenticateUser, requireSystemAdmin, bakeryController.deleteBakery);

module.exports = router;
 */
