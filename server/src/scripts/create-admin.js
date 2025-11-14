const connectDatabase = require("../config/database");
const User = require("../models/User");
const logger = require("../config/logger");

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    const [rawKey, value] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    acc[key] = value;
    return acc;
  }, {});
}

async function run() {
  const args = parseArgs();
  const email = args.email;
  const password = args.password;
  const name = args.name || "Warehouse Admin";
  const role = args.role || "admin";

  if (!email || !password) {
    logger.error("Usage: npm run seed -- --email=user@example.com --password=StrongPass123!");
    process.exit(1);
  }

  await connectDatabase();

  let user = await User.findOne({ email }).select("+password");

  if (user) {
    user.name = name;
    user.role = role;
    user.password = password;
    await user.save();
    logger.info({ email }, "Existing user updated");
  } else {
    user = await User.create({
      email,
      password,
      name,
      role,
    });
    logger.info({ email }, "New user created");
  }

  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Failed to create admin user");
  process.exit(1);
});
