import { premiumExtendedService } from '../../services/premium/premiumExtended.service.js';
import logger from '../../utils/logger.js';
import { HTTP_STATUS } from '../../constants/messages.js';
import { validate as uuidValidate } from 'uuid';
import CustomError from '../../utils/CustomError.js';
import CustomSuccess from '../../utils/CustomSuccess.js';

// Validate UUID
const validateUUID = (id, fieldName) => {
  if (!id || !uuidValidate(id)) {
    throw new Error(`Invalid ${fieldName}: must be a valid UUID`);
  }
};

export const createFollowUpReminderController = async (req, res) => {
  try {
    const { applicationId, reminderDate, message, type } = req.body;
    if (!applicationId || !reminderDate || !message || !type) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            error: 'Missing required fields: applicationId, reminderDate, message, type'
        }));
    }
    if(!validateUUID(applicationId, 'Application ID')){
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
            new CustomError({
                success: false,
                error: 'Invalid Application ID'
            })
        );
    }
    const result = await premiumExtendedService.createFollowUpReminder({ ...req.body, userId: req.user.id });
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to create follow-up reminder'
            })
        );
    }
    return res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess({
            success: true,
            message: "Follow-up reminder created successfully",
            data: result
        })
    );
  } catch (err) {
    logger.error(`createFollowUpReminderController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    sendResponse(res, err.message.includes('Validation') || err.message.includes('Invalid') || err.message.includes('limit exceeded') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR, null, err);
  }
};

export const getFollowUpRemindersController = async (req, res) => {
  try {
    const { status } = req.query;
    if (status && !['pending', 'completed', 'cancelled'].includes(status)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
            new CustomError({
                success: false,
                error: 'Invalid status: must be one of pending, completed, cancelled'
            })
        );
    }
    const reminders = await premiumExtendedService.getFollowUpReminders(req.user.id, status);
    if (!reminders) {
        return res.status(HTTP_STATUS.NOT_FOUND).json(
            new CustomError({
                success: false,
                error: 'No follow-up reminders found'
            })
        );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
            success: true,
            message: "Follow-up reminders retrieved successfully",
            data: reminders
        })
    );
  } catch (err) {
    logger.error(`getFollowUpRemindersController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: 'Internal server error',
            data: err.message
        })
    );
  }
};

export const createInterviewController = async (req, res) => {
  try {
    const { applicationId, companyName, position, interviewDate, type } = req.body;
    if (!applicationId || !companyName || !position || !interviewDate || !type) {
      if (!applicationId || !companyName || !position || !interviewDate || !type) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
            new CustomError({
                success: false,
                error: 'Missing required fields: applicationId, companyName, position, interviewDate, type'
            })
        );
    }
    if(!validateUUID(applicationId, 'Application ID')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
            new CustomError({
                success: false,
                error: 'Invalid Application ID'
            })
        );
    }
    const result = await premiumExtendedService.createInterview({ ...req.body, userId: req.user.id });
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to create interview'
            })
        );
    }
    return res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess({
            success: true,
            message: "Interview created successfully",
            data: result
        })
    );
}
  } catch (err) {
    logger.error(`createInterviewController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: 'Internal server error',
            data: err.message
        })
    );
}
};

export const updateInterviewStatusController = async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { status, notes } = req.body;
    if (!interviewId || !status || !notes ) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
            success: false,
            error: 'Missing required fields: interviewId, status, notes'
        })
        );
    }
    if(!validateUUID(interviewId, 'Interview ID')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
            new CustomError({
                success: false,
                error: 'Invalid Interview ID'
            })
        );
    }
    const result = await premiumExtendedService.updateInterviewStatus(interviewId, req.user.id, status, notes);
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to update interview status'
            })
        );
    }
    return res.status(HTTP_STATUS.OK).json(
        new CustomSuccess({
            success: true,
            message: "Interview status updated successfully",
            data: result
        })
    )
  } catch (err) {
    logger.error(`updateInterviewStatusController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
   return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: 'Internal server error',
            data: err.message
        })
    );
};
}

export const createOfferController = async (req, res) => {
  try {
    const { applicationId, companyName, position } = req.body;
    if (!applicationId || !companyName || !position) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: applicationId, companyName, position'
        })
      );
    }
    if (!validateUUID(applicationId, 'Application ID')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid Application ID'
        })
      );
    }
    const result = await premiumExtendedService.createOffer({ ...req.body, userId: req.user.id });
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to create offer'
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        success: true,
        message: "Offer created successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`createOfferController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const compareOffersController = async (req, res) => {
  try {
    const { offerIds } = req.body;
    if (!Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'offerIds must be a non-empty array'
        })
      );
    }
    if(!validateUUID(offerIds, 'Offer ID')) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json(
          new CustomError({
            success: false,
            error: 'Invalid Offer ID'
          })
        );
    }
    const result = await premiumExtendedService.compareOffers(req.user.id, offerIds);
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to compare offers'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        success: true,
        message: "Offers compared successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`compareOffersController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const createApplicationNoteController = async (req, res) => {
  try {
    const { applicationId, content } = req.body;
    if (!applicationId || !content) {
     return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: applicationId, content'
        })
      );
    }
    if (!validateUUID(applicationId, 'Application ID')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid Application ID'
        })
      );
    }
    const result = await premiumExtendedService.createApplicationNote({ ...req.body, userId: req.user.id });
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to create application note'
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        success: true,
        message: "Application note created successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`createApplicationNoteController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const getApplicationNotesController = async (req, res) => {
  try {
    const { applicationId } = req.params;
    if(!validateUUID(applicationId, 'Application ID')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid Application ID'
        })
      );
    }
    const notes = await premiumExtendedService.getApplicationNotes(applicationId, req.user.id);
    if (!notes) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(
        new CustomError({
          success: false,
          error: 'No application notes found'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        success: true,
        message: "Application notes retrieved successfully",
        data: notes
      })
    );
  } catch (err) {
    logger.error(`getApplicationNotesController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const createBatchApplicationController = async (req, res) => {
  try {
    const { jobIds, templateId } = req.body;
    if (!Array.isArray(jobIds) || jobIds.length === 0 || !templateId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: jobIds (non-empty array), templateId'
        })
      );
    }
    if(!validateUUID(templateId, 'Template ID') || !validateUUID(jobIds, 'Job ID')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid Template ID or Job ID'
        })
      );
    }
    const result = await premiumExtendedService.createBatchApplication({ ...req.body, userId: req.user.id });
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to create batch application'
        })
      );
    }
    return res.status(HTTP_STATUS.ACCEPTED).json(
      new CustomSuccess({
        success: true,
        message: "Batch application created successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`createBatchApplicationController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const createApplicationTemplateController = async (req, res) => {
  try {
    const { name, coverLetter } = req.body;
    if (!name || !coverLetter) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: name, coverLetter'
        })
      );
    }
    const result = await premiumExtendedService.createApplicationTemplate({ ...req.body, userId: req.user.id });
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to create application template'
        })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        success: true,
        message: "Application template created successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`createApplicationTemplateController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const updateQuickApplySettingsController = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required field: settings'
        })
      );
    }
    const result = await premiumExtendedService.updateQuickApplySettings(req.user.id, req.body);
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to update quick apply settings'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        success: true,
        message: "Quick apply settings updated successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`updateQuickApplySettingsController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: 'Internal server error',
            data: err.message
        })
    );
  }
};

export const calculateApplicationScoreController = async (req, res) => {
  try {
    const { applicationId } = req.params;
    if (!applicationId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required field: applicationId' })
      );
    }
    if (!validateUUID(applicationId, 'Application ID')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid Application ID format'
        })
      );
    }
    const score = await premiumExtendedService.calculateApplicationScore(applicationId, req.user.id);
    if (!score) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to calculate application score'
        })
      );
    }
    return res.status(HTTP_STATUS.OK).json(
      new CustomSuccess({
        success: true,
        message: "Application score calculated successfully",
        data: score
      })
    );
  } catch (err) {
    logger.error(`calculateApplicationScoreController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const exportApplicationDataController = async (req, res) => {
  try {
    const { format, filters = {} } = req.body;
    if (!['json', 'csv', 'excel'].includes(format)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Invalid format: must be one of json, csv, excel' })
      );
    }
    const result = await premiumExtendedService.exportApplicationData(req.user.id, format, filters);
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
          success: false,
          error: 'Failed to export application data'
        })
      );
    }
    return res.status(HTTP_STATUS.ACCEPTED).json(
      new CustomSuccess({
        success: true,
        message: "Application data exported successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`exportApplicationDataController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') || err.message.includes('limit exceeded') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      new CustomError({
        success: false,
        error: 'Internal server error',
        data: err.message
      })
    );
  }
};

export const createThankYouNoteController = async (req, res) => {
  try {
    const { interviewId, message } = req.body;
    if (!interviewId || !message) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: interviewId, message' })
      );
    }
    validateUUID(interviewId, 'Interview ID');
    const result = await premiumExtendedService.createThankYouNote(interviewId, req.user.id, message);
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to create thank you note'
            })
        );
    }
    return res.status(HTTP_STATUS.CREATED).json(
      new CustomSuccess({
        success: true,
        message: "Thank you note created successfully",
        data: result
      })
    );
  } catch (err) {
    logger.error(`createThankYouNoteController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Validation') || err.message.includes('Invalid') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: err.message || 'Internal server error'
        })
    );
  }
};

export const saveVideoIntroductionController = async (req, res) => {
  try {
    const { title, description, file } = req.body;  
    if (!req.file?.buffer) {
      throw new Error('Video file is required');
    }
    if (!['video/mp4', 'video/webm'].includes(req.file.mimetype)) {
      throw new Error('Invalid file type: must be mp4 or webm');
    }
    if (req.file.size > 100 * 1024 * 1024) {
      throw new Error('File size exceeds 100MB limit');
    }
    if (!title) {
      throw new Error('Missing required field: title');
    }
    const result = await premiumExtendedService.saveVideoIntroduction(req.body, req.file.buffer);
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to save video introduction'
            })
        );
    }
    return res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess({
            success: true,
            message: "Video introduction saved successfully",
            data: result
        })
    );
  } catch (err) {
    logger.error(`saveVideoIntroductionController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') || err.message.includes('required') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: err.message || 'Internal server error'
        })
    );
  }
};

export const savePortfolioAttachmentController = async (req, res) => {
  try {
    const { title, description, file } = req.body;
    if (!req.file?.buffer) {
      throw new Error('Portfolio file is required');
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(req.file.mimetype)) {
      throw new Error('Invalid file type: must be pdf, jpeg, or png');
    }
    if (req.file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds 50MB limit');
    }
    if (!title) {
      throw new Error('Missing required field: title');
    }
    const result = await premiumExtendedService.savePortfolioAttachment(req.body, req.file.buffer);
    if (!result) {
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            new CustomError({
                success: false,
                error: 'Failed to save portfolio attachment'
            })
        );
    }
    return res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess({
            success: true,
            message: "Portfolio attachment saved successfully",
            data: result
        })
    );
  } catch (err) {
    logger.error(`savePortfolioAttachmentController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(err.message.includes('Invalid') || err.message.includes('required') ? HTTP_STATUS.BAD_REQUEST : HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({
            success: false,
            error: err.message || 'Internal server error'
        })
    );
  }
};

export const createReferenceController = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(
        new CustomError({
          success: false,
          error: 'Missing required fields: name, email' })
      );
    }
    const result = await premiumExtendedService.createReference({ ...req.body, userId: req.user.id });
    if (!result) {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({ 
            success: false,
            error: 'Failed to create reference' })
      );
    }
    return res.status(HTTP_STATUS.CREATED).json(
        new CustomSuccess({ 
            success: true,
            message: "Reference created successfully",
            data: result
        })
    );
  } catch (err) {
    logger.error(`createReferenceController failed: ${err.message}`, {
      userId: req.user.id,
      method: req.method,
      path: req.path,
    });
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        new CustomError({ 
            success: false,
            error: err.message || 'Internal server error' })
    )
  }
};