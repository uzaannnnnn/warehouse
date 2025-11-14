/* eslint-disable no-console */
const mongoose = require("mongoose");
const connectDatabase = require("../config/database");
const Product = require("../models/Product");
const User = require("../models/User");
const Invoice = require("../models/Invoice");
const LoginAudit = require("../models/LoginAudit");

async function clearCollections() {
  await connectDatabase();

  const collections = [
    { model: User, name: "users" },
    { model: Product, name: "products" },
    { model: Invoice, name: "invoices" },
    { model: LoginAudit, name: "login audits" },
  ];

  for (const { model, name } of collections) {
    // eslint-disable-next-line no-await-in-loop
    const result = await model.deleteMany({});
    console.log(`Cleared ${result.deletedCount} document(s) from ${name}`);
  }

  await mongoose.connection.close();
}

clearCollections()
  .then(() => {
    console.log("Database cleared successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to clear database:", error);
    process.exit(1);
  });
