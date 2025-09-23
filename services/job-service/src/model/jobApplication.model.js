import mongoose from 'mongoose';
import { generateSecureId } from '../utils/security.js';

const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      validator: (v) => validUUIDRegex.test(v),
      message: 'Invalid job ID format'
    }
  },
  userId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v) => validUUIDRegex.test(v),
      message: 'Invalid user ID format'
    }
  },
  companyId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v) => validUUIDRegex.test(v),
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
    maxlength: 36,
    validate: {
      validator: (v) => !v || validUUIDRegex.test(v),
      message: 'resumeVersion must be a valid resume ID'
    }
  },
  coverLetter: {
    type: String,
    maxlength: 2000,
    validate: {
      validator: (v) => !v || !/<script\b[^<](?:(?!<\/script>)<[^<])*<\/script>/gi.test(v),
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
        validator: (v) => !v || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v),
        message: 'Invalid IP address format'
      }
    },
    userAgent: { type: String, maxlength: 500 }
  },
  notes: [{
    id: { type: String, default: generateSecureId, validate: validUUIDRegex },
    type: { type: String, enum: ['note', 'reminder', 'interview', 'thankYou'], required: true },
    content: { type: String, maxlength: 2000 },
    tags: [{ type: String, maxlength: 50 }],
    isPrivate: { type: Boolean, default: false },
    reminderDate: { type: Date },
    status: { type: String, enum: ['pending', 'completed', 'cancelled', 'rescheduled'] },
    interviewId: { type: String, validate: { validator: (v) => !v || validUUIDRegex.test(v), message: 'Invalid interviewId UUID' } },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],
  attachments: [{
    id: { type: String, default: generateSecureId, validate: validUUIDRegex },
    type: { type: String, enum: ['video', 'portfolio'], required: true },
    fileUrl: { type: String, required: true },
    tags: [{ type: String, maxlength: 50 }],
    categories: [{ type: String, maxlength: 50 }],
    createdAt: { type: Date, default: Date.now }
  }],
  offerDetails: {
    id: { type: String, default: generateSecureId, validate: validUUIDRegex },
    salary: { type: Number, min: 0 },
    equity: { type: Number, min: 0 },
    benefits: [{ type: String, maxlength: 100 }],
    companyName: { type: String, maxlength: 100 },
    competitiveScore: { type: Number, min: 0, max: 100 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }
}, {
  timestamps: true,
  collection: 'job_applications',
  shardKey: { userId: 1 }
});

jobApplicationSchema.index({ jobId: 1, appliedAt: -1 });
jobApplicationSchema.index({ userId: 1, appliedAt: -1 });
jobApplicationSchema.index({ companyId: 1, status: 1 });
jobApplicationSchema.index({ 'notes.id': 1 });
jobApplicationSchema.index({ 'attachments.id': 1 });
jobApplicationSchema.index({ 'offerDetails.id': 1 });

export default mongoose.model('JobApplication', jobApplicationSchema);