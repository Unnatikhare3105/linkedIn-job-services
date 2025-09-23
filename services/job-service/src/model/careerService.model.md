// models/careerServices.model.js
import mongoose from 'mongoose';

const CareerServicesSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  resumeReviews: [{
    reviewId: String,
    resumeUrl: String,
    targetRole: String,
    urgency: String,
    status: String,
    submittedAt: Date,
    reviewerId: String,
    feedback: {
      overallRating: Number,
      sections: [{ section: String, rating: Number, comments: String, suggestions: [String] }],
      atsCompatibility: { score: Number, issues: [String], recommendations: [String] },
      improvements: [{ category: String, priority: String, suggestion: String, example: String }],
      finalNotes: String
    },
    completedAt: Date
  }],
  coachingSessions: [{
    sessionId: String,
    coachId: String,
    sessionMode: String,
    scheduledAt: Date,
    duration: Number,
    goals: [String],
    status: String,
    actionItems: [{ itemId: String, description: String, dueDate: Date, status: String }],
    feedback: {
      rating: Number,
      comments: String,
      areasCovered: [String],
      outcomes: [String]
    }
  }],
  coachingPlan: {
    planId: String,
    goals: [String],
    timeline: String,
    milestones: [{ milestone: String, targetDate: Date, status: String, achievedAt: Date, notes: String }],
    progress: Number,
    createdAt: Date,
    lastUpdatedAt: Date
  },
  assignedCoach: {
    coachId: String,
    name: String,
    specializations: [String],
    industries: [String],
    experience: String,
    rating: Number
  },
  updatedAt: Date
}, { timestamps: true });

// Define indexes
CareerServicesSchema.index({ userId: 1 }, { unique: true });
CareerServicesSchema.index({ 'resumeReviews.reviewId': 1 });
CareerServicesSchema.index({ 'coachingSessions.sessionId': 1 });

export const CareerServices = mongoose.model('CareerServices', CareerServicesSchema);