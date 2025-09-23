// // models/assessmentPractice.model.js
// import mongoose from 'mongoose';

// const AssessmentPracticeSchema = new mongoose.Schema({
//   userId: { type: String, required: true },
//   practiceStats: {
//     totalAssessments: Number,
//     completedAssessments: Number,
//     averageScore: Number,
//     totalInterviews: Number,
//     averageInterviewRating: Number,
//     streak: { lastPracticeDate: Date, currentStreak: Number }
//   },
//   assessments: [{
//     assessmentId: String,
//     skillId: String,
//     difficulty: String,
//     assessmentType: String,
//     timeLimit: Number,
//     questions: [{
//       questionId: String,
//       question: String,
//       options: [String],
//       correctAnswer: String,
//       explanation: String,
//       timeSpent: Number
//     }],
//     answers: [{ questionId: String, answer: String, timeSpent: Number }],
//     results: {
//       score: Number,
//       percentile: Number,
//       correctAnswers: Number,
//       totalQuestions: Number,
//       strengths: [String],
//       weaknesses: [String],
//       recommendations: [String]
//     },
//     status: String,
//     startedAt: Date,
//     completedAt: Date,
//     timeTaken: Number
//   }],
//   mockInterviews: [{
//     sessionId: String,
//     jobRole: String,
//     interviewType: String,
//     experienceLevel: String,
//     scheduledAt: Date,
//     duration: Number,
//     questions: [{
//       questionId: String,
//       question: String,
//       category: String,
//       difficulty: String,
//       answer: String,
//       timeSpent: Number,
//       feedback: Object
//     }],
//     status: String,
//     completedAt: Date,
//     overallFeedback: {
//       communicationScore: Number,
//       technicalScore: Number,
//       confidenceScore: Number,
//       overallRating: Number,
//       strengths: [String],
//       areasForImprovement: [String],
//       nextSteps: [String]
//     }
//   }],
//   updatedAt: Date
// }, { timestamps: true });

// // Define indexes
// AssessmentPracticeSchema.index({ userId: 1 }, { unique: true });
// AssessmentPracticeSchema.index({ 'assessments.assessmentId': 1 });
// AssessmentPracticeSchema.index({ 'mockInterviews.sessionId': 1 });

// export const AssessmentPractice = mongoose.model('AssessmentPractice', AssessmentPracticeSchema);