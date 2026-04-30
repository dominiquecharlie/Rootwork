const express = require("express");
const cors = require("cors");
const orgsRouter = require("./routes/orgs");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "backend" });
});

app.use("/api/orgs", orgsRouter);

module.exports = app;
