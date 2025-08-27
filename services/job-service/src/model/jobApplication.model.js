// ===== JOB APPLICATIONS SCHEMA =====
import mongoose from 'mongoose';

import { generateSecureId } from '../utils/security.js';

const jobApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: generateSecureId
  },
  jobId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'Invalid job ID format'
    }
  },
  userId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'Invalid user ID format'
    }
  },
  companyId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'Invalid company ID format'
    }
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'shortlisted', 'interviewed', 'rejected', 'hired'],
    default: 'submitted',
    index: true
  },
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  resumeVersion: {
    type: String,
    maxlength: 36, // Resume ID reference instead of string
    validate: {
      validator: function(v) {
        return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
      },
      message: 'resumeVersion must be a valid resume ID'
    }
  },
  coverLetter: {
    type: String,
    maxlength: 2000,
    validate: {
      validator: function(v) {
        return !v || !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v);
      },
      message: 'Cover letter contains unsafe content'
    }
  },
  source: {
    type: String,
    enum: ['direct', 'linkedin', 'referral', 'job-board'],
    default: 'direct'
  },
  metadata: {
    ipAddress: {
      type: String,
      validate: {
        validator: function(v) {
          return !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
        },
        message: 'Invalid IP address format'
      }
    },
    userAgent: {
      type: String,
      maxlength: 500
    }
  }
}, {
  timestamps: true,
  collection: 'job_applications'
});

// Optimized indexes for applications
jobApplicationSchema.index({ jobId: 1, appliedAt: -1 });
jobApplicationSchema.index({ userId: 1, appliedAt: -1 });
jobApplicationSchema.index({ companyId: 1, status: 1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;