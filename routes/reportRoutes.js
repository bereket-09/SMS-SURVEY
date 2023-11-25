const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authentication, authorization } = require('../middlewares/middlewares');

// Reporting Endpoints
// router.get('/reports/survey/:id', authentication, authorization, reportController.generateDetailedReport);
// router.get('/reports/summary/:id', authentication, authorization, reportController.generateSummaryReport);

// // Reporting Endpoints
// router.get('/reports/:id', authentication, authorization, reportController.generateReport);

module.exports = router;