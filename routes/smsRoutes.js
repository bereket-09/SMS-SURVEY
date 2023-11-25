const express = require("express");
const router = express.Router();
const smsController = require("../controllers/smsController");

// SMS Gateway Integration Endpoint
router.post("/sms/receive", smsController.receiveSMS);

module.exports = router;
