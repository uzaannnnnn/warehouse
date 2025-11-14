const express = require("express");
const authRoutes = require("./auth.routes");
const warehouseRoutes = require("./warehouse.routes");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Service healthy",
    timestamp: new Date().toISOString(),
  });
});

router.use("/auth", authRoutes);
router.use("/warehouse", warehouseRoutes);

module.exports = router;
