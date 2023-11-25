const express = require("express");

const router = express.Router();
const { authentication } = require("../middlewares/middlewares");
const { check, validationResult } = require("express-validator");
const {
  handleValidationErrors,
} = require("../middlewares/handleValidationErrors");
const dbConnection = require("../db");
const { DateTime } = require("luxon");

//...................................... ADD NEW SURVEY ...........................
// POST /New Survey
router.post(
  "/add-survey",
  authentication,
  [
    check("title").notEmpty().withMessage("Title is required"),
    check("description").notEmpty().withMessage("Description is required"),
    check("startDate").notEmpty().withMessage("startDate is required"),
    check("endDate").notEmpty().withMessage("endDate is required"),
    check("senderId").notEmpty().withMessage("Invalid sender ID"),
    // Add more validation checks for other properties
  ],
  handleValidationErrors,
  async (req, res) => {
    let surveyId; // Declare surveyId here
    let id = req.user.userId;
    try {
      const {
        title,
        description,
        participants,
        welcomeMessage, // Added for welcomeMessage
        endingMessage, // Added for endingMessage
        QuestionGroupID,
        startDate,
        endDate,
        senderId, // Added for senderId
      } = req.body;

      // Assuming startDate and endDate are strings in "YYYY-MM-DD hh:mm:ss" format
      const luxonStartDate = DateTime.fromFormat(
        startDate,
        "yyyy-MM-dd HH:mm:ss"
      );
      const luxonEndDate = DateTime.fromFormat(endDate, "yyyy-MM-dd HH:mm:ss");

      // Convert Luxon DateTime objects to JavaScript Date objects
      const formattedStartDate = luxonStartDate.toJSDate();
      const formattedEndDate = luxonEndDate.toJSDate();

      // Validation and formatting of participants
      const validParticipants = [];
      const invalidParticipants = [];
      const uniqueParticipants = new Set();
      const duplicatedParticipants = new Set();

      for (const participant of participants) {
        const formattedUser = formatUser(participant.msisdn);

        if (validateUser(formattedUser)) {
          if (!uniqueParticipants.has(formattedUser)) {
            uniqueParticipants.add(formattedUser);
            validParticipants.push({
              surveyId, // Use the declared surveyId here
              userId: id,
              msisdn: formattedUser,
            });
          } else {
            duplicatedParticipants.add(formattedUser);
          }
        } else {
          invalidParticipants.push(participant.msisdn);
        }
      }

      // Check if totalSuccess is zero and totalParticipants is above zero
      if (validParticipants.length === 0 && participants.length > 0) {
        createErrorResponse(
          res,
          400,
          "Operation failed. No valid participants to add.",
          {
            totalParticipants: participants.length,
            totalSuccess: 0,
            totalInvalid: invalidParticipants.length,
            invalidParticipants,
          }
        );
        return;
      }

      console.log(
        "Result ",
        title,
        description,
        startDate,
        endDate,
        welcomeMessage,
        endingMessage,
        validParticipants.length,
        id,
        QuestionGroupID,
        senderId // Log senderId
      );

      // Insert survey into Survey table
      const insertSurveyQuery = `
        INSERT INTO Survey (title, description, startDate, endDate, welcomeMessage, endingMessage, totalParticipants, createdBy, QuestionGroupID, senderId, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', NOW(), NOW());
      `;

      const [surveyResult] = await dbConnection.execute(insertSurveyQuery, [
        title,
        description,
        formattedStartDate,
        formattedEndDate,
        welcomeMessage || "", // Insert empty string or provided value
        endingMessage || "", // Insert empty string or provided value
        validParticipants.length,
        id,
        QuestionGroupID,
        senderId,
      ]);

      surveyId = surveyResult.insertId; // Assign the value to the declared surveyId

      // Insert valid participants into Participant table
      await insertParticipantsIntoDB(
        validParticipants,
        surveyResult.insertId,
        id,
        QuestionGroupID
      );

      createSuccessResponse(res, {
        message: "Survey created successfully",
        surveyId: surveyResult.insertId,
        totalParticipants: participants.length,
        totalSuccess: validParticipants.length,
        totalDuplicated: duplicatedParticipants.size,
        duplicatedParticipants: Array.from(duplicatedParticipants),
        totalInvalid: invalidParticipants.length,
        invalidParticipants,
      });
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

//.................................... Get INFO ABOUT SURVEY .................................

// GET /survey/:id/details
router.get(
  "/:id/details",
  authentication,
  [check("id").notEmpty().isNumeric().withMessage("Invalid survey ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      const surveyId = req.params.id;

      // Part 1: Retrieve survey details
      const [surveyDetails] = await dbConnection.execute(
        "SELECT * FROM Survey WHERE id = ?",
        [surveyId]
      );

      if (surveyDetails.length === 0) {
        return createErrorResponse(
          res,
          404,
          "Survey not found",
          "No survey found with the provided ID."
        );
      }

      // Part 2: Retrieve total questions count for the survey
      const [totalQuestionsResult] = await dbConnection.execute(
        "SELECT COUNT(*) AS totalQuestions FROM QuestionGroupMapping WHERE groupId = ?",
        [surveyDetails[0].QuestionGroupID]
      );

      // Part 3: Retrieve total users responded count for the survey
      const [totalUsersResponded] = await dbConnection.execute(
        "SELECT COUNT(DISTINCT participantId) AS totalUsers FROM Response WHERE surveyId = ?",
        [surveyId]
      );

      // Part 4: Retrieve total responses made towards this survey
      const [totalResponsesResult] = await dbConnection.execute(
        "SELECT COUNT(participantId) AS totalResponses FROM Response WHERE surveyId = ?",
        [surveyId]
      );

      // Part 5: Retrieve questions and user response counts
      const [questionDetails] = await dbConnection.execute(
        `
        SELECT 
          Q.id AS questionId,
          QGM.ranking AS questionRank,
          Q.questionText,
          COUNT(DISTINCT R.participantId) AS userResponseCount
        FROM QuestionGroupMapping QGM
        JOIN Question Q ON QGM.questionId = Q.id
        LEFT JOIN Response R ON Q.id = R.questionId AND R.surveyId = ?
        WHERE QGM.groupId = ?
        GROUP BY Q.id, QGM.ranking;
        `,
        [surveyId, surveyDetails[0].QuestionGroupID]
      );

      // Part 6: Retrieve total participants count for the survey
      // const [totalParticipantsResult] = await dbConnection.execute(
      //   "SELECT COUNT(DISTINCT userId) AS totalParticipants FROM Participant WHERE surveyId = ?",
      //   [surveyId]
      // );

      createSuccessResponse(res, {
        surveyDetails: surveyDetails[0],
        totalQuestions: totalQuestionsResult[0].totalQuestions,
        totalResponses: totalResponsesResult[0].totalResponses,
        total_Users_Responded: totalUsersResponded[0].totalUsers,
        questionDetails,
        // totalParticipants: totalParticipantsResult[0].totalParticipants,
      });
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

// GET /api/surveys/created-by/:user_id
router.get("/list-created-by", authentication, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Logic to retrieve surveys created by a specific user
    const [surveys] = await dbConnection.execute(
      "SELECT * FROM Survey WHERE createdBy = ?",
      [userId]
    );

    createSuccessResponse(res, { totalCount: surveys.length, surveys });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// GET /api/surveys/list-all
router.get("/list-all", authentication, async (req, res) => {
  try {
    // Logic to retrieve details of all surveys
    const [surveys] = await dbConnection.execute("SELECT * FROM Survey");

    createSuccessResponse(res, { totalCount: surveys.length, surveys });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// GET /api/responses/:survey_id
router.get("/responses/:survey_id", authentication, async (req, res) => {
  try {
    const surveyId = req.params.survey_id;

    // Fetch QuestionGroupID for the survey
    const [surveyDetails] = await dbConnection.execute(
      "SELECT QuestionGroupID FROM Survey WHERE id = ?",
      [surveyId]
    );
    const questionGroupId = surveyDetails[0].QuestionGroupID;

    // Fetch questions for the QuestionGroupID
    const [questions] = await dbConnection.execute(
      "SELECT Q.id AS questionId, Q.questionText FROM QuestionGroupMapping QGM JOIN Question Q ON QGM.questionId = Q.id WHERE QGM.groupId = ?",
      [questionGroupId]
    );

    // Fetch responses for the survey
    const [responses] = await dbConnection.execute(
      "SELECT R.participantId, R.questionId, R.response FROM Response R WHERE R.surveyId = ?",
      [surveyId]
    );

    // Organize responses by question
    const groupedResponses = {};

    questions.forEach((question) => {
      const { questionId, questionText } = question;
      groupedResponses[questionId] = {
        questionText,
        totalResponses: 0, // Initialize total responses count for each question
        responses: [],
      };

      // Filter responses for the current question
      const questionResponses = responses.filter(
        (response) => response.questionId === questionId
      );
      groupedResponses[questionId].totalResponses = questionResponses.length;
      groupedResponses[questionId].responses = questionResponses.map(
        (response) => ({
          participantId: response.participantId,
          responseText: response.response,
        })
      );
    });

    // Calculate the overall total count for all questions
    const overallTotalResponses = questions.reduce(
      (total, question) =>
        total + groupedResponses[question.questionId].totalResponses,
      0
    );

    createSuccessResponse(res, { groupedResponses, overallTotalResponses });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// GET /api/surveys/participants/:id
router.get("/participants/:id", authentication, async (req, res) => {
  try {
    const surveyId = req.params.id;

    // Retrieve participants of a specific survey
    const [participants] = await dbConnection.execute(
      "SELECT * FROM Participant WHERE surveyId = ?",
      [surveyId]
    );

    // Retrieve scheduled messages for the survey
    const [scheduledMessages] = await dbConnection.execute(
      "SELECT * FROM ScheduledMessage WHERE surveyId = ?",
      [surveyId]
    );

    // Create a map to store scheduled messages information by participant ID
    const scheduledMessagesMap = new Map();

    scheduledMessages.forEach((message) => {
      const {
        participantId,
        totalQuestions,
        currentQuestionRank,
        remainingQuestions,
        messageStatus,
        scheduledTime,
      } = message;

      if (!scheduledMessagesMap.has(participantId)) {
        scheduledMessagesMap.set(participantId, []);
      }

      scheduledMessagesMap.get(participantId).push({
        totalQuestions,
        currentQuestionRank,
        remainingQuestions,
        messageStatus,
        scheduledTime,
      });
    });

    // Enhance participant information with scheduled messages data
    const enhancedParticipants = participants.map((participant) => {
      const { id: participantId } = participant;
      const messagesData = scheduledMessagesMap.get(participantId) || [];
      const currentQuestion =
        messagesData.length > 0
          ? messagesData[messagesData.length - 1].currentQuestionRank
          : null;
      const questionsLeft =
        messagesData.length > 0
          ? messagesData[messagesData.length - 1].remainingQuestions
          : null;

      return {
        ...participant,

        currentQuestion,
        questionsLeft,
        scheduledMessages: messagesData,
      };
    });

    // Calculate total participants for the survey
    const totalParticipants = participants.length;

    createSuccessResponse(res, {
      participants: enhancedParticipants,
      totalParticipants,
    });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// GET /api/participant-responses/:msisdn
router.get(
  "/participant-responses/:msisdn",
  authentication,
  async (req, res) => {
    try {
      const participantMsisdn = req.params.msisdn;

      // Retrieve surveys in which the participant is involved
      const [surveys] = await dbConnection.execute(
        "SELECT * FROM Survey WHERE id IN (SELECT DISTINCT surveyId FROM Participant WHERE msisdn = ?)",
        [participantMsisdn]
      );

      // Create a list to store survey information with participant responses
      const surveyResponses = [];

      // Iterate through each survey and fetch participant responses
      for (const survey of surveys) {
        const surveyId = survey.id;

        // Step 1: Retrieve QuestionGroupID from the Survey table
        const questionGroupId = survey.QuestionGroupID;

        // Step 2: Fetch question IDs from QuestionGroupMapping based on the group ID
        const [questionMappings] = await dbConnection.execute(
          "SELECT questionId FROM QuestionGroupMapping WHERE groupId = ? ORDER BY ranking",
          [questionGroupId]
        );

        // Extract question IDs from the result
        const questionIds = questionMappings.map(
          (mapping) => mapping.questionId
        );

        // Step 3: Query the Question table using the list of question IDs
        const [questions] = await dbConnection.execute(
          "SELECT * FROM Question WHERE id IN (?)",
          [questionIds]
        );

        // Step 4: Query participant responses for the current survey from the Response table
        const [participantResponses] = await dbConnection.execute(
          "SELECT r.*, q.questionText FROM Response r " +
            "INNER JOIN Question q ON r.questionId = q.id " +
            "WHERE r.surveyId = ? AND r.participantId = ? AND r.questionId IN (?) ORDER BY r.questionId",
          [surveyId, participantMsisdn, questionIds]
        );

        // Create a list to store questions with participant responses
        const surveyQuestions = [];

        // Iterate through each question and format the data
        for (const question of questions) {
          const questionId = question.id;

          const matchingResponse = participantResponses.find(
            (response) => response.questionId === questionId
          );

          if (matchingResponse) {
            surveyQuestions.push({
              questionId,
              questionText: matchingResponse.questionText,
              responseText: matchingResponse.response,
            });
          }
        }

        // Create an object with survey information, questions, and participant responses
        const surveyInfo = {
          surveyId,
          title: survey.title,
          description: survey.description,
          startDate: survey.startDate,
          endDate: survey.endDate,
          QuestionGroupID: questionGroupId,
          questions: surveyQuestions,
        };

        // Push the survey information to the list
        surveyResponses.push(surveyInfo);
      }

      createSuccessResponse(res, { participantResponses: surveyResponses });
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

// POST /api/surveys/participants/add-new
router.post(
  "/participants/add-new",
  authentication, // Middleware for authentication
  [
    // Validation middleware for the request body
    check("participants")
      .isArray({ min: 1 })
      .withMessage("Participants must be an array with at least one element"),
    check("surveyId").notEmpty().isNumeric().withMessage("Invalid survey ID"),

    // Add more specific validation rules for each participant property if needed
  ],
  handleValidationErrors, // Middleware to handle validation errors
  async (req, res) => {
    try {
      const { participants, surveyId } = req.body;

      // Validate, format, and filter participants
      const validParticipants = [];
      const invalidParticipants = [];
      const existingParticipants = new Set();

      for (const participant of participants) {
        const formattedUser = formatUser(participant.msisdn);

        if (validateUser(formattedUser)) {
          // Check if the participant is not already part of the survey
          const [existingParticipant] = await dbConnection.execute(
            "SELECT id FROM Participant WHERE surveyId = ? AND msisdn = ?",
            [surveyId, formattedUser]
          );

          if (existingParticipant && existingParticipant.length > 0) {
            existingParticipants.add(formattedUser);
          } else {
            validParticipants.push({ surveyId, msisdn: formattedUser });
          }
        } else {
          invalidParticipants.push(participant.msisdn);
        }
      }

      // Fetch QuestionGroupId from the survey
      const [surveyResult] = await dbConnection.execute(
        "SELECT QuestionGroupId FROM Survey WHERE id = ?",
        [surveyId]
      );

      if (!surveyResult || surveyResult.length === 0) {
        throw new Error(`Survey with id ${surveyId} not found.`);
      }

      const fetchedQuestionGroupId = surveyResult[0].QuestionGroupId;

      if (!fetchedQuestionGroupId) {
        throw new Error(
          `QuestionGroupId not found for survey with id ${surveyId}.`
        );
      }

      // Insert valid participants into the Participant table
      await insertParticipantsIntoDB(
        validParticipants,
        surveyId,
        req.user.userId, // Assuming user ID is stored in req.user.userId
        fetchedQuestionGroupId
      );

      createSuccessResponse(
        res,
        {
          message: "Participants added successfully",
          totalParticipants: participants.length,
          totalSuccess: validParticipants.length,
          totalExisting: existingParticipants.size,
          existingParticipants: Array.from(existingParticipants),
          totalInvalid: invalidParticipants.length,
          invalidParticipants,
        },
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

// DELETE /api/surveys/participants/:id
router.delete("/participants/:surveyId", authentication, async (req, res) => {
  try {
    const surveyId = req.params.surveyId;
    const { participantIds } = req.body;

    // Delete participants from the Participant table
    await dbConnection.execute(
      "DELETE FROM Participant WHERE surveyId = ? AND id IN (?)",
      [surveyId, participantIds]
    );

    createSuccessResponse(res, {
      message: "Participants removed successfully",
    });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// GET /api/questionnaires/:id/detail
router.get("/questionnaires/:id/detail", authentication, async (req, res) => {
  try {
    const questionnaireId = req.params.id;

    // Retrieve questionnaire details
    const [questionnaireDetails] = await dbConnection.execute(
      "SELECT id, questionText, type, createdAt, updatedAt FROM Question WHERE id = ?",
      [questionnaireId]
    );

    if (questionnaireDetails.length === 0) {
      createErrorResponse(res, 404, "Questionnaire not found", null);
      return;
    }

    const [groupIds] = await dbConnection.execute(
      "SELECT GROUP_CONCAT(DISTINCT groupId) as groupIds FROM QuestionGroupMapping WHERE questionId = ?",
      [questionnaireId]
    );

    const [responseCount] = await dbConnection.execute(
      "SELECT COUNT(DISTINCT r.id) as responseCount FROM Response r WHERE questionId = ?",
      [questionnaireId]
    );

    // Additional details or formatting can be added as needed

    createSuccessResponse(res, {
      questionnaireDetails: questionnaireDetails[0],
      groupIds: groupIds[0].groupIds,
      responseCount: responseCount[0].responseCount,
    });
  } catch (error) {
    console.error(error);
    createErrorResponse(
      res,
      500,
      "Internal Server Error",
      "An unexpected error occurred while processing your request."
    );
  }
});

// PUT /api/questions/:id
router.put(
  "/questionnaires/:id/update",
  authentication,
  [
    check("id").notEmpty().isNumeric().withMessage("Invalid question ID"),
    check("questionText").notEmpty().withMessage("Question text is required"),
    check("type").notEmpty().withMessage("Question type is required"),
    // Add more validation checks for other fields if needed
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const questionId = req.params.id;
      const { questionText, type } = req.body;

      // Update question in the database
      const [updateResult] = await dbConnection.execute(
        "UPDATE Question SET questionText = ?, type = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        [questionText, type, questionId]
      );

      if (updateResult.affectedRows === 0) {
        createErrorResponse(res, 404, "Question not found", null);
        return;
      }

      createSuccessResponse(res, { message: "Question updated successfully" });
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

// PUT /api/questions/:questionId/options
router.put(
  "/questionnaires/:id/update",
  authentication,
  [
    check("id").notEmpty().isNumeric().withMessage("Invalid question ID"),
    check("questionText").notEmpty().withMessage("Question text is required"),
    check("type").notEmpty().withMessage("Question type is required"),
    // Add more validation checks for other fields if needed
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const questionId = req.params.id;
      const { questionText, type } = req.body;

      // Update question in the database
      const [updateResult] = await dbConnection.execute(
        "UPDATE Question SET questionText = ?, type = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
        [questionText, type, questionId]
      );

      if (updateResult.affectedRows === 0) {
        createErrorResponse(res, 404, "Question not found", null);
        return;
      }

      createSuccessResponse(res, { message: "Question updated successfully" });
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





// GET /test
router.get(
  "/test",
  authentication,
  [check("id").notEmpty().isNumeric().withMessage("Invalid survey ID")],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Logic to retrieve the progress of a specific survey
      // Insert your code here...

      createSuccessResponse(res, { progress: "/* your progress data */" });
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

// Function to validate the user value
function validateUser(user) {
  const regex = /^(07\d{8}|2517\d{8}|\+2517\d{8}|7\d{8})$/;
  return regex.test(user);
}

// Function to format the user value to 2517xxxxxxxx
function formatUser(user) {
  const regex = /^(07\d{8}|2517\d{8}|\+2517\d{8}|7\d{8})$/;
  const match = regex.exec(user);
  if (match) {
    const phoneNumber = match[0].replace(/\D/g, ""); // Remove non-digit characters
    if (phoneNumber.startsWith("07")) {
      return `2517${phoneNumber.slice(2)}`;
    } else if (phoneNumber.startsWith("7")) {
      return `2517${phoneNumber.slice(1)}`;
    } else if (phoneNumber.startsWith("2517")) {
      return phoneNumber;
    } else if (phoneNumber.startsWith("+2517")) {
      return phoneNumber.slice(1);
    }
  }
  return user;
}

// Function to create a standardized success response
const createSuccessResponse = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    status: "success",
    code: statusCode,
    message: "Operation successful",
    data,
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

// ................................................................. Create a Survey ........................................

// Function to insert participants into the Participant table
async function insertParticipantsIntoDB(
  participants,
  surveyId,
  userId,
  QuestionGroupId
) {
  console.log(surveyId, userId, QuestionGroupId);

  // Fetch totalQuestions from QuestionGroup
  const [questionGroupResult] = await dbConnection.execute(
    "SELECT totalQuestions FROM QuestionGroup WHERE id = ?",
    [QuestionGroupId]
  );

  if (!questionGroupResult || questionGroupResult.length === 0) {
    throw new Error(`QuestionGroup with id ${QuestionGroupId} not found.`);
  }

  const totalQuestions = questionGroupResult[0].totalQuestions;

  console.log("totalQuestions", totalQuestions);
  // Check if totalQuestions is not available
  if (totalQuestions === undefined || totalQuestions === null) {
    throw new Error(
      `Total questions not found for QuestionGroup with id ${QuestionGroupId}.`
    );
  }

  const insertQuery = `
    INSERT INTO Participant (surveyId, userId, msisdn, status, responseCount, deliveryStatus, completionPercentage, scheduledAt, completionTime, createdAt, updatedAt)
    VALUES (?, ?, ?, 'Not Started', 0, 'Not Sent', 0, NOW(), NOW(), NOW(), NOW());
  `;

  const insertScheduledMessageQuery = `
    INSERT INTO ScheduledMessage (participantId, surveyId, questionGroupId, totalQuestions, currentQuestionRank, remainingQuestions, messageStatus, scheduledTime, sentAt, deliveryAttempts, responseTime, responseStatus, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 0, ?, 'Pending', NOW(), NOW(), 0, NOW(), 'Not Responded', NOW(), NOW());
  `;

  for (const participant of participants) {
    try {
      const [participantResult] = await dbConnection.execute(insertQuery, [
        surveyId,
        userId,
        participant.msisdn,
      ]);
      const participantId = participantResult.insertId;

      await dbConnection.execute(insertScheduledMessageQuery, [
        participantId,
        surveyId,
        QuestionGroupId,
        totalQuestions,
        totalQuestions,
      ]);
    } catch (error) {
      console.error("Error inserting participant:", error);
      // Handle the error, log, or throw as needed
    }
  }
}

module.exports = router;
