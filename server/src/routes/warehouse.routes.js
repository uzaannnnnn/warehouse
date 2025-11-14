const express = require("express");
const {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  listCategories,
} = require("../controllers/product.controller");
const {
  listInvoices,
  getInvoice,
  createInvoice,
} = require("../controllers/invoice.controller");
const auth = require("../middleware/auth");
const validateRequest = require("../middleware/validateRequest");
const { createProductSchema, updateProductSchema } = require("../validations/product.validation");
const { createInvoiceSchema } = require("../validations/invoice.validation");

const router = express.Router();

router.use(auth);

router.get("/products", listProducts);
router.post("/products", validateRequest(createProductSchema), createProduct);
router.get("/products/:id", getProduct);
router.put("/products/:id", validateRequest(updateProductSchema), updateProduct);
router.delete("/products/:id", deleteProduct);

router.get("/categories", listCategories);

router.get("/invoices", listInvoices);
router.post("/invoices", validateRequest(createInvoiceSchema), createInvoice);
router.get("/invoices/:id", getInvoice);

module.exports = router;
