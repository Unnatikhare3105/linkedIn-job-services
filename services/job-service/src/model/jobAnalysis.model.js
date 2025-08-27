// ===== CORE JOB SCHEMA (jobs collection) =====
import mongoose from 'mongoose';

// ===== JOB ANALYTICS SCHEMA (with upsert-safe operations) =====
const jobAnalyticsSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    index: true
  },
  date: {
    type: String, // YYYY-MM-DD format for better aggregation performance
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  metrics: {
    views: { type: Number, default: 0, min: 0 },
    uniqueViews: { type: Number, default: 0, min: 0 },
    applications: { type: Number, default: 0, min: 0 },
    saves: { type: Number, default: 0, min: 0 },
    shares: { type: Number, default: 0, min: 0 },
    clicks: { type: Number, default: 0, min: 0 }
  },
  sources: {
    direct: { type: Number, default: 0, min: 0 },
    linkedin: { type: Number, default: 0, min: 0 },
    google: { type: Number, default: 0, min: 0 },
    referral: { type: Number, default: 0, min: 0 }
  }
}, {
  timestamps: false,
  collection: 'job_analytics'
});

// Compound index for analytics queries
jobAnalyticsSchema.index({ jobId: 1, date: -1 }, { unique: true });

// Static method for safe upsert operations
jobAnalyticsSchema.statics.incrementMetric = async function(jobId, date, metricPath, count = 1) {
  try {
    await this.updateOne(
      { jobId, date },
      { $inc: { [metricPath]: count } },
      { upsert: true } // Creates document if doesn't exist
    );
  } catch (error) {
    console.error('Failed to increment analytics metric:', error);
  }
};
const JobAnalytics = mongoose.model('JobAnalytics', jobAnalyticsSchema);
export default JobAnalytics;
