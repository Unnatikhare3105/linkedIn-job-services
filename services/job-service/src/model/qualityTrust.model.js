import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { schemaOperationLatency, schemaOperationErrors } from "../utils/metrics.js";

const qualityTrustSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => uuidv4(),
    },
    type: {
      type: String,
      enum: {
        values: ["company_verification", "spam_check", "salary_verification", "duplicate_check", "quality_assessment"],
        message: "Invalid verification type",
      },
      required: [true, "Verification type is required"],
      index: true,
    },
    companyId: {
      type: String,
      ref: "Company",
      index: { sparse: true },
      default: uuidv4,
      validate: {
        validator: function (v) {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: "Invalid companyId",
      },
    },
    jobId: {
      type: String,
      ref: "Job",
      index: { sparse: true },
      default: uuidv4,
      validate: {
        validator: function (v) {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: "Invalid jobId",
      },
    },
    userId: {
      type: String,
      ref: "User",
      index: { sparse: true },
      default: uuidv4,
      validate: {
        validator: function (v) {
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: "Invalid userId",
      },
    },
    verifiedBy: {
      type: String,
      ref: "User",

      validate: {
        validator: function (v) {
          return !v || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
        },
        message: "Invalid verifiedBy",
      },
    },
    verificationChecks: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          return !v || (typeof v === "object" && JSON.stringify(v).length < 10000);
        },
        message: "VerificationChecks data too large (max 10KB)",
      },
    },
    spamScore: {
      type: Number,
      min: [0, "Spam score cannot be negative"],
      max: [100, "Spam score cannot exceed 100"],
      index: { sparse: true },
    },
    isSpam: {
      type: Boolean,
      index: { sparse: true },
      default: false,
    },
    checks: {
      type: mongoose.Schema.Types.Mixed,
      validate: {
        validator: function (v) {
          return !v || (typeof v === "object" && JSON.stringify(v).length < 5000);
        },
        message: "Checks data too large (max 5KB)",
      },
    },
    providedSalary: {
      amount: { type: Number, min: 0 },
      currency: {
        type: String,
        maxlength: 3,
        validate: {
          validator: function (v) {
            return !v || /^[A-Z]{3}$/.test(v);
          },
          message: "Currency must be a valid ISO 4217 code (e.g., USD, EUR)",
        },
      },
      period: { type: String, enum: ["hourly", "monthly", "yearly"] },
      verified: { type: Boolean, default: false },
    },
    marketData: {
      minSalary: { type: Number, min: 0 },
      maxSalary: { type: Number, min: 0 },
      medianSalary: { type: Number, min: 0 },
      dataSource: { type: String, maxlength: 100 },
      confidence: { type: Number, min: 0, max: 100 },
    },
    verification: {
      status: { type: String, enum: ["verified", "pending", "failed"] },
      method: { type: String, maxlength: 50 },
      confidence: { type: Number, min: 0, max: 100 },
      notes: { type: String, maxlength: 500 },
    },
    isDuplicate: {
      type: Boolean,
      default: false,
      index: { sparse: true },
    },
    hasSimilarRecent: {
      type: Boolean,
      default: false,
      index: { sparse: true },
    },
    existingApplications: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Application",
      validate: {
        validator: function (v) {
          return !v || v.length <= 100;
        },
        message: "Too many existing applications (max 100)",
      },
    },
    similarApplications: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Application",
      validate: {
        validator: function (v) {
          return !v || v.length <= 50;
        },
        message: "Too many similar applications (max 50)",
      },
    },
    metrics: {
      completeness: { type: Number, min: 0, max: 100, default: 0 },
      accuracy: { type: Number, min: 0, max: 100, default: 0 },
      relevance: { type: Number, min: 0, max: 100, default: 0 },
      freshness: { type: Number, min: 0, max: 100, default: 0 },
      reliability: { type: Number, min: 0, max: 100, default: 0 },
    },
    overallScore: {
      type: Number,
      min: [0, "Overall score cannot be negative"],
      max: [100, "Overall score cannot exceed 100"],
      index: { sparse: true },
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "verified", "rejected", "expired"],
        message: "Invalid status",
      },
      default: "pending",
      index: true,
    },
    verifiedAt: {
      type: Date,
      index: { sparse: true },
    },
    checkedAt: {
      type: Date,
      index: { sparse: true },
    },
    assessedAt: {
      type: Date,
      index: { sparse: true },
    },
    expiresAt: {
      type: Date,
      index: { expireAfterSeconds: 0 },
    },
    schemaVersion: {
      type: Number,
      default: 2, // Updated for new version
      index: true,
    },
    metadata: {
      source: { type: String, maxlength: 50 },
      ipAddress: { type: String, maxlength: 45 },
      userAgent: { type: String, maxlength: 500 },
      sessionId: { type: String, maxlength: 100 },
      requestId: { type: String, maxlength: 100 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
    strict: true,
    validateBeforeSave: true,
    collection: "quality_trust",
    toJSON: {
      transform: (doc, ret) => {
        delete ret.metadata?.ipAddress;
        delete ret.metadata?.userAgent;
        return ret;
      },
    },
  }
);

// Optimized compound indexes
qualityTrustSchema.index({ companyId: 1, type: 1, status: 1 }, { sparse: true });
qualityTrustSchema.index({ jobId: 1, type: 1, createdAt: -1 }, { sparse: true });
qualityTrustSchema.index({ userId: 1, jobId: 1, type: 1 }, { sparse: true });
qualityTrustSchema.index({ type: 1, status: 1, createdAt: -1 });
qualityTrustSchema.index({ isSpam: 1, spamScore: -1 }, { sparse: true });
qualityTrustSchema.index({ isDuplicate: 1, hasSimilarRecent: 1 }, { sparse: true });
qualityTrustSchema.index({ overallScore: -1, status: 1 }, { sparse: true });

// Shard key for distributed databases
qualityTrustSchema.index({ type: 1, createdAt: 1 }, { unique: false }); // Candidate shard key

// Pre-save middleware
qualityTrustSchema.pre("save", function (next) {
  const operation = "save";
  const startTime = Date.now();
  try {
    const latency = schemaOperationLatency.startTimer({ operation });

    // Set dynamic TTL based on type
    if (!this.expiresAt && this.type) {
      this.expiresAt = new Date(Date.now() + (CACHE_TTL[this.type] || 86400) * 1000);
    }

    // Set timestamps
    if (this.isModified("status")) {
      if (this.status === "verified" && !this.verifiedAt) {
        this.verifiedAt = new Date();
      } else if (this.status === "rejected") {
        this.checkedAt = new Date();
      }
    }

    // Validate salary consistency
    if (this.providedSalary?.amount && this.marketData?.minSalary) {
      if (this.providedSalary.amount < this.marketData.minSalary * 0.5) {
        this.verification = this.verification || {};
        this.verification.status = "failed";
        this.verification.notes = "Salary significantly below market range";
      }
    }

    latency();
    next();
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    next(error);
  }
});

// Instance methods
qualityTrustSchema.methods.markAsSpam = async function (score = 100) {
  const operation = "markAsSpam";
  const startTime = Date.now();
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    this.isSpam = true;
    this.spamScore = Math.min(score, 100);
    this.status = "rejected";
    this.checkedAt = new Date();
    const result = await this.save();
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

qualityTrustSchema.methods.markAsVerified = async function (verifiedBy) {
  const operation = "markAsVerified";
  const startTime = Date.now();
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    this.status = "verified";
    this.verifiedBy = verifiedBy;
    this.verifiedAt = new Date();
    const result = await this.save();
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

qualityTrustSchema.methods.updateScore = async function (newScore) {
  const operation = "updateScore";
  const startTime = Date.now();
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    this.overallScore = Math.max(0, Math.min(100, newScore));
    this.assessedAt = new Date();
    const result = await this.save();
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

// Static methods
qualityTrustSchema.statics.findByCompanyAndType = async function (companyId, type, limit = 100, skip = 0) {
  const operation = "findByCompanyAndType";
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    const result = await this.find({ companyId, type })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

qualityTrustSchema.statics.findSpamRecords = async function (threshold = 80, limit = 100, skip = 0) {
  const operation = "findSpamRecords";
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    const result = await this.find({
      $or: [{ isSpam: true }, { spamScore: { $gte: threshold } }],
    })
      .sort({ spamScore: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

qualityTrustSchema.statics.getQualityStats = async function (userId) {
  const operation = "getQualityStats";
  try {
    const latency = schemaOperationLatency.startTimer({ operation });
    const result = await this.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: "$type",
          avgScore: { $avg: "$overallScore" },
          totalRecords: { $sum: 1 },
          verifiedCount: { $sum: { $cond: [{ $eq: ["$status", "verified"] }, 1, 0] } },
          spamCount: { $sum: { $cond: ["$isSpam", 1, 0] } },
        },
      },
    ]);
    latency();
    return result;
  } catch (error) {
    schemaOperationErrors.inc({ operation });
    throw error;
  }
};

// Utility methods
export const QualityTrustUtils = {
  async bulkCreateRecords(records) {
    const operation = "bulkCreateRecords";
    try {
      const latency = schemaOperationLatency.startTimer({ operation });
      const result = await QualityTrust.insertMany(records, {
        ordered: false,
        writeConcern: { w: 1 }, // Majority write concern for consistency
        lean: true,
      });
      latency();
      return result;
    } catch (error) {
      schemaOperationErrors.inc({ operation });
      throw new Error(`Bulk create failed: ${error.message}`);
    }
  },

  async cleanupExpiredRecords() {
    const operation = "cleanupExpiredRecords";
    try {
      const latency = schemaOperationLatency.startTimer({ operation });
      const result = await QualityTrust.deleteMany({
        expiresAt: { $lte: new Date() },
      });
      latency();
      return result;
    } catch (error) {
      schemaOperationErrors.inc({ operation });
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  },

  async getCollectionStats() {
    const operation = "getCollectionStats";
    try {
      const latency = schemaOperationLatency.startTimer({ operation });
      const result = await QualityTrust.collection.stats();
      latency();
      return result;
    } catch (error) {
      schemaOperationErrors.inc({ operation });
      throw new Error(`Stats retrieval failed: ${error.message}`);
    }
  },

  async ensureIndexes() {
    const operation = "ensureIndexes";
    try {
      const latency = schemaOperationLatency.startTimer({ operation });
      const result = await QualityTrust.createIndexes();
      latency();
      return result;
    } catch (error) {
      schemaOperationErrors.inc({ operation });
      throw new Error(`Index creation failed: ${error.message}`);
    }
  },

  async migrateSchema(oldVersion, newVersion) {
    const operation = "migrateSchema";
    try {
      const latency = schemaOperationLatency.startTimer({ operation });
      if (oldVersion === 1 && newVersion === 2) {
        await QualityTrust.updateMany(
          { schemaVersion: 1 },
          {
            $set: {
              schemaVersion: 2,
              expiresAt: {
                $cond: [
                  { $eq: ["$type", "company_verification"] },
                  new Date(Date.now() + CACHE_TTL.company_verification * 1000),
                  {
                    $cond: [
                      { $eq: ["$type", "spam_check"] },
                      new Date(Date.now() + CACHE_TTL.spam_check * 1000),
                      {
                        $cond: [
                          { $eq: ["$type", "salary_verification"] },
                          new Date(Date.now() + CACHE_TTL.salary_verification * 1000),
                          {
                            $cond: [
                              { $eq: ["$type", "duplicate_check"] },
                              new Date(Date.now() + CACHE_TTL.duplicate_check * 1000),
                              new Date(Date.now() + CACHE_TTL.quality_assessment * 1000),
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          }
        );
      }
      latency();
      return { success: true, migratedRecords: await QualityTrust.countDocuments({ schemaVersion: newVersion }) };
    } catch (error) {
      schemaOperationErrors.inc({ operation });
      throw new Error(`Schema migration failed: ${error.message}`);
    }
  },
};

export const QualityTrustTypes = {
  VERIFICATION_TYPES: ["company_verification", "spam_check", "salary_verification", "duplicate_check", "quality_assessment"],
  STATUS_TYPES: ["pending", "verified", "rejected", "expired"],
  SALARY_PERIODS: ["hourly", "monthly", "yearly"],
};

export default QualityTrust;