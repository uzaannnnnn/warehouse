const express = require("express");
const {
  listLocations,
  createLocation,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/management.controller");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/requireRole");
const validateRequest = require("../middleware/validateRequest");
const {
  createLocationSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
} = require("../validations/management.validation");

const router = express.Router();

router.use(auth, requireRole("manager", "admin"));

router.get("/locations", listLocations);
router.post("/locations", validateRequest(createLocationSchema), createLocation);

router.get("/users", listUsers);
router.post("/users", validateRequest(createUserSchema), createUser);
router.put("/users/:id", validateRequest(updateUserSchema), updateUser);
router.delete("/users/:id", validateRequest(deleteUserSchema), deleteUser);

module.exports = router;
