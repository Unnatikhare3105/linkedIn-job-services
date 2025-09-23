import {
  validateUrl,
  sanitizeInput,
  validId,
} from "../../utils/security.js";
import logger from "./utils/logger.js";
import { ProfessionalDevelopmentService } from "../../services/premium/professionalDevelopment.service.js";
import { HTTP_STATUS, ERROR_MESSAGES } from "../../constants/messages.js";
import CustomError from "../../utils/customError.js";
import CustomSuccess from "../../utils/customSuccess.js";

export const analyzeSkillsGapController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid request data",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);

    const result = await ProfessionalDevelopmentService.analyzeSkillsGap({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No skills gap data found",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Skills gap analysis completed successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Skills gap analysis error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.SKILLS_ANALYSIS_FAILED,
      })
    );
  }
};

export const getSkillsGapAnalysisController = async (req, res) => {
  try {
    const result = await ProfessionalDevelopmentService.getSkillsGapAnalysis(
      req.user.id
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No skills gap analysis found",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Skills gap analysis retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get skills gap error:", error);
    return res.status(error.status || HTTP_STATUS.NOT_FOUND).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.NOT_FOUND,
        success: false,
        message: error.message || ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      })
    );
  }
};

export const generateCareerPathController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid request data",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);

    const result = await ProfessionalDevelopmentService.generateCareerPath({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No career path data generated",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Career path generated successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Career path generation error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.CAREER_PATH_GENERATION_FAILED,
      })
    );
  }
};

export const getCareerPathSuggestionsController = async (req, res) => {
  try {
    const result =
      await ProfessionalDevelopmentService.getCareerPathSuggestions(
        req.user.id
      );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No career path suggestions found",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Career path suggestions retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get career path error:", error);
    return res.status(error.status || HTTP_STATUS.NOT_FOUND).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.NOT_FOUND,
        success: false,
        message: error.message || ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      })
    );
  }
};

export const createSkillAssessmentController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid request data",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.createSkillAssessment({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No assessment created",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Assessment created successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Create assessment error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      })
    );
  }
};

export const submitAssessmentController = async (req, res) => {
  try {
    const { id: assessmentId } = req.params;
    const { answers } = req.body;
    if (
      !answers ||
      !Array.isArray(answers) ||
      answers.length === 0 ||
      !assessmentId
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid answers data or assessment ID",
          data: null,
        })
      );
    }
    if (!validId(assessmentId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid assessment ID format",
          data: null,
        })
      );
    }
    const sanitizedAnswers = sanitizeInput(answers);

    const result = await ProfessionalDevelopmentService.submitAssessment(
      assessmentId,
      req.user.id,
      sanitizedAnswers
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No assessment result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Assessment submitted successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Submit assessment error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.ASSESSMENT_EXPIRED,
      })
    );
  }
};

export const addCertificationController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid certification data",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.addCertification({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No certification result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.CREATED,
        success: true,
        message: "Certification added successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Add certification error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.INVALID_CERTIFICATION_DATA,
      })
    );
  }
};

export const getCertificationsController = async (req, res) => {
  try {
    const result = await ProfessionalDevelopmentService.getCertifications(
      req.user.id
    );
    if (!result || result.length === 0) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No certifications found",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Certifications retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get certifications error:", error);
    return res.status(error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      })
    );
  }
};

export const connectLinkedInLearningController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid LinkedIn Learning connection data",
          data: null,
        })
      );
    }
    if (
      !validateUrl(req.body.linkedInToken) ||
      !validateUrl(req.body.linkedInLearningUrl)
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid LinkedIn Learning URL or token",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.connectLinkedInLearning(
      { ...sanitizedBody, userId: req.user.id }
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No LinkedIn Learning result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "LinkedIn Learning connected successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("LinkedIn connect error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      })
    );
  }
};

export const syncLinkedInCoursesController = async (req, res) => {
  try {
    const result = await ProfessionalDevelopmentService.syncLinkedInCourses(
      req.user.id
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No courses synced",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Courses synced successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("LinkedIn sync error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.COURSE_SYNC_FAILED,
      })
    );
  }
};

export const scheduleMockInterviewController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid mock interview data",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.scheduleMockInterview({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No mock interview result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.CREATED,
        success: true,
        message: "Mock interview scheduled successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Schedule interview error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.INTERVIEW_SCHEDULING_FAILED,
      })
    );
  }
};

export const completeMockInterviewController = async (req, res) => {
  try {
    const { id: sessionId } = req.params;
    const { answers } = req.body;
    if (
      !answers ||
      !Array.isArray(answers) ||
      answers.length === 0 ||
      !sessionId
    ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid mock interview data",
          data: null,
        })
      );
    }
    if (!validId(sessionId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid session ID",
          data: null,
        })
      );
    }
    const sanitizedAnswers = sanitizeInput(answers);
    const result = await ProfessionalDevelopmentService.completeMockInterview(
      sessionId,
      req.user.id,
      sanitizedAnswers
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No mock interview result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Mock interview completed successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Complete interview error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.FEEDBACK_GENERATION_FAILED,
      })
    );
  }
};

export const submitResumeForReviewController = async (req, res) => {
  try {
    const resumeFile = req.file;
    if (!resumeFile) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "No resume file uploaded",
          data: null,
        })
      );
    }
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "No resume data provided",
          data: null,
        })
      );
    }
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedMimeTypes.includes(resumeFile.mimetype)) {
      return res.status(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE).json(
        new CustomError({
          statusCode: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
          success: false,
          message: "Unsupported resume file format",
          data: null,
        })
      );
    }

    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.submitResumeForReview(
      { ...sanitizedBody, userId: req.user.id },
      resumeFile
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No resume review result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Resume submitted for review successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Submit resume error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.INVALID_RESUME_FORMAT,
      })
    );
  }
};

export const getResumeReviewController = async (req, res) => {
  try {
    const { id: reviewId } = req.params;
    if (!validId(reviewId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid review ID",
          data: null,
        })
      );
    }
    const result = await this.service.getResumeReview(reviewId, req.user.id);
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No resume review result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Resume review retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get resume review error:", error);
    return res.status(error.status || HTTP_STATUS.NOT_FOUND).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.NOT_FOUND,
        success: false,
        message: error.message || ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      })
    );
  }
};

export const scheduleCoachingSessionController = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "No coaching session data provided",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.scheduleCoachingSession(
      { ...sanitizedBody, userId: req.user.id }
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No coaching session result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.CREATED,
        success: true,
        message: "Coaching session scheduled successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Schedule coaching error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.SESSION_BOOKING_FAILED,
      })
    );
  }
};

export const getCoachingPlanController = async (req, res) => {
  try {
    const result = await ProfessionalDevelopmentService.getCoachingPlan(
      req.user.id
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No coaching plan available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Coaching plan retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get coaching plan error:", error);
    return res.status(error.status || HTTP_STATUS.NOT_FOUND).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.NOT_FOUND,
        success: false,
        message: error.message || ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      })
    );
  }
};

export const analyzeSalaryBenchmarkController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "No salary benchmark data provided",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.analyzeSalaryBenchmark({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No salary benchmark analysis result available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Salary benchmark analysis successful",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Salary benchmark error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.BENCHMARK_CALCULATION_FAILED,
      })
    );
  }
};

export const getNegotiationTipsController = async (req, res) => {
  try {
    const { level, industry } = req.params;
    if (!level || !industry) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Level and industry are required",
          data: null,
        })
      );
    }

    const result = await ProfessionalDevelopmentService.getNegotiationTips(
      level,
      industry
    );
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No negotiation tips available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Negotiation tips retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get negotiation tips error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.SALARY_DATA_UNAVAILABLE,
      })
    );
  }
};

export const generateMarketReportController = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Request body is required",
          data: null,
        })
      );
    }
    const sanitizedBody = sanitizeInput(req.body);
    const result = await ProfessionalDevelopmentService.generateMarketReport({
      ...sanitizedBody,
      userId: req.user.id,
    });
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No market report available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Market report generated successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Market report error:", error);
    return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.BAD_REQUEST,
        success: false,
        message: error.message || ERROR_MESSAGES.SALARY_DATA_UNAVAILABLE,
      })
    );
  }
};

export const getMarketReportController = async (req, res) => {
  try {
    const { id: reportId } = req.params;
    if (!validId(reportId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          success: false,
          message: "Invalid report ID",
          data: null,
        })
      );
    }
    const result = await this.service.getMarketReport(reportId, req.user.id);
    if (!result) {
      return res.status(HTTP_STATUS.NO_CONTENT).json(
        new CustomError({
          statusCode: HTTP_STATUS.NO_CONTENT,
          success: false,
          message: "No market report available",
          data: null,
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        statusCode: HTTP_STATUS.OK,
        success: true,
        message: "Market report retrieved successfully",
        data: result,
      })
    );
  } catch (error) {
    logger.error("Get market report error:", error);
    return res.status(error.status || HTTP_STATUS.NOT_FOUND).json(
      new CustomError({
        statusCode: error.status || HTTP_STATUS.NOT_FOUND,
        success: false,
        message: error.message || ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      })
    );
  }
};
