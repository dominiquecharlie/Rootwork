const express = require("express");
const cors = require("cors");
const orgsRouter = require("./routes/orgs");
const stage01Router = require("./routes/stage01");
const stage02Router = require("./routes/stage02");
const devRouter = require("./routes/dev");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend" });
});

app.use("/api/orgs", orgsRouter);
app.use("/api/stage01", stage01Router);
app.use("/api/stage02", stage02Router);

if (process.env.NODE_ENV !== "production") {
  app.use("/api/dev", devRouter);
}

module.exports = app;
