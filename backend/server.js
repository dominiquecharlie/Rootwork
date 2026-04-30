const express = require("express");
const cors = require("cors");
const orgsRouter = require("./routes/orgs");
const devRouter = require("./routes/dev");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend" });
});

app.use("/api/orgs", orgsRouter);

if (process.env.NODE_ENV !== "production") {
  app.use("/api/dev", devRouter);
}

module.exports = app;
