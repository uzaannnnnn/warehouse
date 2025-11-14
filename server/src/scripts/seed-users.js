const fs = require("fs");
const path = require("path");
const connectDatabase = require("../config/database");
const User = require("../models/User");
const logger = require("../config/logger");

function parseArgs() {
  return process.argv.slice(2).reduce((acc, arg) => {
    const [rawKey, ...rest] = arg.split("=");
    const key = rawKey.replace(/^--/, "");
    acc[key] = rest.join("=") || true;
    return acc;
  }, {});
}

function resolveUsers(args) {
  if (args.email && args.password) {
    const role = args.role || "manager";
    return [
      {
        name: args.name || "Seeded User",
        email: args.email,
        password: args.password,
        role,
        avatarUrl: args.avatarUrl,
      },
    ];
  }

  const seedFile = args.file
    ? path.resolve(process.cwd(), args.file)
    : path.join(__dirname, "../../data/users.json");

  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found at ${seedFile}`);
  }

  const raw = fs.readFileSync(seedFile, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Seed file must contain an array of users");
  }
  return parsed;
}

async function upsertUser(data) {
  const email = data.email?.toLowerCase().trim();

  if (!email || !data.password) {
    logger.warn({ data }, "Skipped user without email/password");
    return "skipped";
  }

  const payload = {
    name: data.name?.trim() || email,
    role: data.role || "manager",
    password: data.password,
    avatarUrl: data.avatarUrl,
  };

  let user = await User.findOne({ email }).select("+password");

  if (user) {
    user.name = payload.name;
    user.role = payload.role;
    if (payload.avatarUrl) {
      user.avatarUrl = payload.avatarUrl;
    }
    if (payload.password) {
      user.password = payload.password;
    }
    await user.save();
    return "updated";
  }

  await User.create({
    email,
    ...payload,
  });
  return "created";
}

async function run() {
  const args = parseArgs();
  const rolesFilter = args.roles
    ? args.roles.split(",").map((role) => role.trim().toLowerCase()).filter(Boolean)
    : null;

  const users = resolveUsers(args);

  const filteredUsers = rolesFilter
    ? users.filter((user) => rolesFilter.includes((user.role || "manager").toLowerCase()))
    : users;

  if (!filteredUsers.length) {
    logger.warn("No users to seed for the specified criteria");
    process.exit(0);
  }

  await connectDatabase();

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
  };

  for (const user of filteredUsers) {
    // eslint-disable-next-line no-await-in-loop
    const result = await upsertUser(user);
    stats[result] += 1;
  }

  logger.info({ stats }, "User seed completed");
  process.exit(0);
}

run().catch((error) => {
  logger.error({ err: error }, "Failed to seed users");
  process.exit(1);
});
