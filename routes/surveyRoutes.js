const express = require("express");
const router = express.Router();
const surveyController = require("../controllers/surveyController");
const { authentication, authorization } = require("../middlewares/middlewares");

// Survey Management Endpoints
router.post(
  "/surveys/import",
  authentication,
  authorization,
  surveyController.importSurveyData
);
router.get(
  "/surveys/progress/:id",
  authentication,
  authorization,
  surveyController.getSurveyProgress
);
router.get(
  "/surveys/responses/:id",
  authentication,
  authorization,
  surveyController.getSurveyResponses
);

// Questionnaire Management Endpoints
router.get(
  "/questionnaires/:id",
  authentication,
  authorization,
  surveyController.getQuestionnaireDetails
);
router.put(
  "/questionnaires/:id",
  authentication,
  authorization,
  surveyController.updateQuestionnaire
);
router.delete(
  "/questionnaires/:id",
  authentication,
  authorization,
  surveyController.deleteQuestionnaire
);

// Survey Participants Management Endpoints
router.get(
  "/surveys/participants/:id",
  authentication,
  authorization,
  surveyController.getSurveyParticipants
);
router.post(
  "/surveys/participants/:id",
  authentication,
  authorization,
  surveyController.addSurveyParticipants
);
router.delete(
  "/surveys/participants/:id",
  authentication,
  authorization,
  surveyController.removeSurveyParticipants
);

// Filtering and Sorting Endpoints
router.get(
  "/surveys/filter/:criteria",
  authentication,
  authorization,
  surveyController.filterSurveys
);
router.get(
  "/surveys/sort/:criteria",
  authentication,
  authorization,
  surveyController.sortSurveys
);

// Survey Management Endpoints
router.post(
  "/surveys",
  authentication,
  authorization,
  surveyController.createSurvey
);
router.get(
  "/surveys/:id",
  authentication,
  authorization,
  surveyController.getSurveyDetails
);
router.put(
  "/surveys/:id",
  authentication,
  authorization,
  surveyController.updateSurvey
);
router.delete(
  "/surveys/:id",
  authentication,
  authorization,
  surveyController.deleteSurvey
);

router.get(
  "/reports/:id",
  authentication,
  authorization,
  surveyController.generateReport
);

module.exports = router;
