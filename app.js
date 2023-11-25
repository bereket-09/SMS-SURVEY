const express = require("express");
const app = express();

// Middleware configurations
app.use(express.json());

// Route configurations
const authRoutes = require("./controllers/authController");
const surveyRoutes = require("./controllers/surveyController");
// const reportRoutes = require("./controllers/reportController");
const smsRoutes = require("./controllers/smsController");

app.use("/api/auth", authRoutes);
app.use("/api/surveys", surveyRoutes);
// app.use("/api/reports", reportRoutes);
// app.use("/api/manage-sms", smsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

module.exports = app;
