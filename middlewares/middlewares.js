const jwt = require("jsonwebtoken");
const secretKey = "bereket";

// Function to create a standardized error response
const createErrorResponse = (res, code, message, details) => {
  res.status(code).json({
    status: "error",
    code,
    message,
    timestamp: new Date().toISOString(),
    metadata: {
      errorDetails: details,
    },
  });
};

function queryError(res, err) {
  console.error("Error executing query: " + err.stack);
  res.sendStatus(500);
}

function authentication(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return createErrorResponse(res, 401, "Unauthorized", "Missing token");
  }

  try {
    const user = jwt.verify(token.split(" ")[1], secretKey);
    if (user.role === "admin" || user.role === "user") {
      req.user = user;
      next();
    } else {
      createErrorResponse(
        res,
        403,
        "Access denied",
        "Insufficient permissions"
      );
    }
  } catch (err) {
    console.error(err);
    createErrorResponse(res, 401, "Invalid token", err.message);
  }
}

module.exports = {
  queryError,
  authentication,
};
