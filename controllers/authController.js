const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const dbConnection = require("../db");
const {
  handleValidationErrors,
} = require("../middlewares/handleValidationErrors");

// Function to create a standardized success response
const createSuccessResponse = (res, message, User_Info, statusCode = 200) => {
  res.status(statusCode).json({
    status: "success",
    code: statusCode,
    message,
    User_Info,
    timestamp: new Date().toISOString(),
    metadata: {
      version: "1.0",
    },
  });
};

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

// POST /api/auth/register
router.post(
  "/register",
  [
    check("firstName").notEmpty().withMessage("First Name is required"),
    check("lastName").notEmpty().withMessage("Last Name is required"),
    check("email").notEmpty().isEmail().withMessage("Valid email is required"),
    check("phoneNumber").notEmpty().withMessage("Phone Number is required"),
    check("username").notEmpty().withMessage("Username is required"),
    check("password").notEmpty().withMessage("Password is required"),
    check("role").notEmpty().withMessage("Role is required"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        phoneNumber,
        username,
        password,
        role,
      } = req.body;

      const [existingUser] = await dbConnection.execute(
        "SELECT * FROM User WHERE email = ?",
        [email]
      );

      if (existingUser.length > 0) {
        return createErrorResponse(
          res,
          400,
          "Bad Request",
          "User with this email already exists."
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await dbConnection.execute(
        "INSERT INTO User (firstName, lastName, email, phoneNumber, username, password, role, lastLoginAt, createdAt, updatedAt, isDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), FALSE)",
        [
          firstName,
          lastName,
          email,
          phoneNumber,
          username,
          hashedPassword,
          role,
        ]
      );

      // Generate JWT token with user details after registration
      const token = jwt.sign(
        {
          userId: newUser.insertId,
          email,
          role,
          // Add more user details as needed
        },
        "bereket"
      );

      createSuccessResponse(
        res,
        "User Account Successfully Created!",
        { userId: newUser.insertId, role, token },
        201
      );
    } catch (error) {
      console.error(error);
      createErrorResponse(
        res,
        500,
        "Internal Server Error",
        "An unexpected error occurred while processing your request."
      );
    }
  }
);

// POST /api/auth/login
router.post(
  "/login",
  [
    check("email").notEmpty().isEmail().withMessage("Valid email is required"),
    check("password").notEmpty().withMessage("Password is required"),
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const [user] = await dbConnection.execute(
        "SELECT * FROM User WHERE email = ?",
        [email]
      );

      if (user.length === 0) {
        return createErrorResponse(
          res,
          401,
          "Unauthorized",
          "Invalid email or password."
        );
      }

      const passwordMatch = await bcrypt.compare(password, user[0].password);
      if (!passwordMatch) {
        return createErrorResponse(
          res,
          401,
          "Unauthorized",
          "Invalid email or password."
        );
      }

      const token = jwt.sign(
        {
          userId: user[0].id,
          email: user[0].email,
          role: user[0].role,
        },
        "bereket"
      );

      createSuccessResponse(
        res,
        "User Has Been Logged In Successfully!",
        { token, userId: user[0].id, role: user[0].role },
        200
      );
    } catch (error) {
      console.error(error);
      createErrorResponse(
        res,
        500,
        "Internal Server Error",
        "An unexpected error occurred while processing your request."
      );
    }
  }
);

module.exports = router;
