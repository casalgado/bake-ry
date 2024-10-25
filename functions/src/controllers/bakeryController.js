const bakeryService = require("../services/bakeryService");

const bakeryController = {
  async createBakery(req, res) {
    try {
      const { uid, bakeryId } = req.user;

      // Check if user already has a bakery
      if (bakeryId) {
        return res.status(403).json({
          error:
            "User already has a bakery assigned and cannot create another one",
        });
      }

      const bakeryData = {
        ...req.body,
        ownerId: uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const newBakery = await bakeryService.createBakery(bakeryData);
      res.status(201).json(newBakery);
    } catch (error) {
      console.error("Error creating bakery:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async getBakery(req, res) {
    try {
      const { id } = req.params;
      const bakery = await bakeryService.getBakeryById(id);
      if (bakery) {
        res.json(bakery);
      } else {
        res.status(404).json({ error: "Bakery not found" });
      }
    } catch (error) {
      console.error("Error getting bakery:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async getAllBakeries(req, res) {
    try {
      const bakeries = await bakeryService.getAllBakeries();
      res.json(bakeries);
    } catch (error) {
      console.error("Error getting all bakeries:", error);
      res.status(500).json({ error: error.message });
    }
  },

  async updateBakery(req, res) {
    try {
      const { id } = req.params;
      const bakeryData = req.body;
      const updatedBakery = await bakeryService.updateBakery(id, bakeryData);
      if (updatedBakery) {
        res.json(updatedBakery);
      } else {
        res.status(404).json({ error: "Bakery not found" });
      }
    } catch (error) {
      console.error("Error updating bakery:", error);
      res.status(400).json({ error: error.message });
    }
  },

  async deleteBakery(req, res) {
    try {
      const { id } = req.params;
      await bakeryService.deleteBakery(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bakery:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = bakeryController;
