require("express-async-errors");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require("./routes");
const config = require("./config/env");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");
const requestContext = require("./middleware/requestContext");
const httpLogger = require("./middleware/httpLogger");

const app = express();

const corsOptions =
  config.corsOrigin.length === 0
    ? { origin: true, credentials: true }
    : {
        origin(origin, callback) {
          if (!origin || config.corsOrigin.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
      };

app.use(requestContext);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(httpLogger);

app.use("/api/v1", routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
