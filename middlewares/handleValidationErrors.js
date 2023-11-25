const { validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => error.msg);

    // You can add additional information to the response body
    const responseBody = {
      status: "error",
      code: 400,
      message: "Validation failed",
      errors: errorMessages,
      timestamp: new Date().toISOString(),
      metadata: {
        requestDetails: {
          method: req.method,
          path: req.path,
          body: req.body,
        },
      },
    };

    return res.status(400).json(responseBody);
  }

  next();
};

module.exports = { handleValidationErrors };
