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
  listRawMaterials,
  getRawMaterial,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  listRawCategories,
} = require("../controllers/rawMaterial.controller");
const {
  listInvoices,
  getInvoice,
  createInvoice,
  claimInvoiceForProduction,
} = require("../controllers/invoice.controller");
const {
  listProductions,
  getProduction,
  createProduction,
} = require("../controllers/production.controller");
const {
  getProductionBuffer,
  saveProductionBuffer,
} = require("../controllers/productionBuffer.controller");
const {
  listSpeedshopOrders,
  getSpeedshopOrder,
  createSpeedshopOrder,
  updateSpeedshopOrder,
  updateSpeedshopOrderStatus,
  listSpeedshopServices,
} = require("../controllers/speedshopOrder.controller");
const auth = require("../middleware/auth");
const validateRequest = require("../middleware/validateRequest");
const { createProductSchema, updateProductSchema } = require("../validations/product.validation");
const { createInvoiceSchema } = require("../validations/invoice.validation");
const { createProductionSchema } = require("../validations/production.validation");
const {
  createSpeedshopOrderSchema,
  updateSpeedshopOrderSchema,
  updateSpeedshopStatusSchema,
} = require("../validations/speedshopOrder.validation");

const router = express.Router();

router.use(auth);

router.get("/products", listProducts);
router.post("/products", validateRequest(createProductSchema), createProduct);
router.get("/products/:id", getProduct);
router.put("/products/:id", validateRequest(updateProductSchema), updateProduct);
router.delete("/products/:id", deleteProduct);

router.get("/categories", listCategories);

router.get("/raw-products", listRawMaterials);
router.post("/raw-products", validateRequest(createProductSchema), createRawMaterial);
router.get("/raw-products/:id", getRawMaterial);
router.put("/raw-products/:id", validateRequest(updateProductSchema), updateRawMaterial);
router.delete("/raw-products/:id", deleteRawMaterial);

router.get("/raw-categories", listRawCategories);

router.get("/invoices", listInvoices);
router.post("/invoices", validateRequest(createInvoiceSchema), createInvoice);
router.get("/invoices/:id", getInvoice);
router.post("/invoices/:invoiceNumber/claim-production", claimInvoiceForProduction);

router.get("/productions", listProductions);
router.post("/productions", validateRequest(createProductionSchema), createProduction);
router.get("/productions/:id", getProduction);

router.get("/production-buffer", getProductionBuffer);
router.post("/production-buffer", saveProductionBuffer);

router.get("/speedshop/orders", listSpeedshopOrders);
router.post(
  "/speedshop/orders",
  validateRequest(createSpeedshopOrderSchema),
  createSpeedshopOrder,
);
router.get("/speedshop/orders/:id", getSpeedshopOrder);
router.put(
  "/speedshop/orders/:id",
  validateRequest(updateSpeedshopOrderSchema),
  updateSpeedshopOrder,
);
router.patch(
  "/speedshop/orders/:id/status",
  validateRequest(updateSpeedshopStatusSchema),
  updateSpeedshopOrderStatus,
);
router.get("/speedshop/services", listSpeedshopServices);

module.exports = router;
