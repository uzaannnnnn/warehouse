const express = require("express");
const { login } = require("../controllers/auth.controller");
const validateRequest = require("../middleware/validateRequest");
const { loginSchema } = require("../validations/auth.validation");
const { loginLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

router.post("/login", loginLimiter, validateRequest(loginSchema), login);

module.exports = router;
