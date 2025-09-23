// import mongoose from 'mongoose';
// import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';
// import { generateSecureId } from '../utils/security.js';

// // TTL configurations (unified with userActivity.model.js)
// const TTL_CONFIG = {
//   SAVED_SEARCH: 2 * 365 * 24 * 60 * 60, // 2 years in seconds
// };

// // Custom UUID validator
// const uuidValidator = (value) => {
//   if (value === null) return true; // Allow null for optional fields
//   return uuidValidate(value) && uuidVersion(value) === 4;
// };

// const SavedSearchSchema = new mongoose.Schema(
//   {
//     _id: {
//       type: String,
//       default: uuidv4,
//       validate: {
//         validator: uuidValidator,
//         message: 'Invalid UUID v4 format for _id',
//       },
//     },
//     userId: {
//       type: String,
//       required: true, 
//       default: null,
//       validate: {
//         validator: uuidValidator,
//         message: 'Invalid UUID v4 format for userId',
//       },
//       index: true,
//     },
//     isAnonymous: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//     name: {
//       type: String,
//       required: true,
//       maxlength: 100,
//       trim: true,
//       default: 'My Search',
//       index: true,
//     },
//     filters: {
//       location: { type: String, maxlength: 100, trim: true },
//       jobType: { type: String, enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] },
//       experience: { type: String, enum: ['entry', 'mid', 'senior', 'executive'] },
//       salary: {
//         min: { type: Number, min: 0 },
//         max: { type: Number, min: 0 },
//       },
//       keywords: { type: [String], default: [] },
//       companyId: {
//         type: String,
//         validate: {
//           validator: uuidValidator,
//           message: 'Invalid UUID v4 format for companyId',
//         },
//         index: { sparse: true },
//       },
//       industry: { type: String, maxlength: 100, trim: true },
//       remote: { type: Boolean },
//       postedWithin: { type: Number, min: 0 }, // Days
//     },
//     alertFrequency: {
//       type: String,
//       enum: ['daily', 'weekly', 'monthly'],
//       default: 'daily',
//       index: true,
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now,
//       index: true,
//     },
//     createdAtMonth: {
//       type: String,
//       default: function () {
//         const date = this.createdAt || new Date();
//         return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//       },
//       index: true,
//     },
//     alertSettings: {
//     enabled: { type: Boolean, default: true },
//     frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'daily' },
//     lastAlertSent: Date,
//     alertCount: { type: Number, default: 0 }
//   },
//   searchPerformance: {
//     totalRuns: { type: Number, default: 0 },
//     avgResultCount: { type: Number, default: 0 },
//     lastResultCount: { type: Number, default: 0 },
//     lastRunAt: Date
//   },
//   isAdvancedSearch: { type: Boolean, default: false },
//   searchOperators: [{ type: String, enum: ['AND', 'OR', 'NOT'] }],
//     isActive: {
//       type: Boolean,
//       default: true,
//       index: true,
//     },
//     lastAlertSent: {
//       type: Date,
//       default: null,
//       index: { sparse: true },
//     },
//     expiresAt: {
//       type: Date,
//       default: () => new Date(Date.now() + TTL_CONFIG.SAVED_SEARCH * 1000),
//       index: { expireAfterSeconds: 0 },
//     },
//   },
//   {
//     collection: 'saved_searches',
//     timestamps: false,
//     minimize: false,
//     strict: true,
//     collation: { locale: 'en', strength: 1 },
//     _id: false, // Prevent MongoDB from creating an additional ObjectId
//   }
// );

// // Optimized indexes for 1M+ users
// SavedSearchSchema.index({ userId: 1, isActive: 1, createdAt: -1 });
// SavedSearchSchema.index({ createdAtMonth: 1, userId: 1 });
// SavedSearchSchema.index({ 'filters.companyId': 1, isActive: 1 });
// SavedSearchSchema.index({ 'filters.location': 1, alertFrequency: 1 });
// SavedSearchSchema.index({ name: 'text', 'filters.keywords': 'text' }, { name: 'saved_search_text' });
// SavedSearchSchema.index({ userId: 1, isAnonymous: 1 }, { partialFilterExpression: { isActive: true } });

// // Sharding key for scalability
// SavedSearchSchema.index({ createdAtMonth: 1, userId: 'hashed' });

// // Pre-save middleware
// SavedSearchSchema.pre('save', function (next) {
//   if (this.isNew) {
//     if (!this._id) {
//       this._id = generateSecureId();
//     }
//     if (!uuidValidator(this._id)) {
//       return next(new Error('Invalid UUID v4 format for _id'));
//     }
//     if (!this.createdAtMonth) {
//       const date = this.createdAt || new Date();
//       this.createdAtMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
//     }
//   }

//   if (!this.userId) {
//     this.isAnonymous = true;
//   }

//   if (!this.name || this.name.trim() === '') {
//     this.name = 'My Search';
//   }

//   if (this.userId && !uuidValidator(this.userId)) {
//     return next(new Error('Invalid UUID v4 format for userId'));
//   }
//   if (this.filters.companyId && !uuidValidator(this.filters.companyId)) {
//     return next(new Error('Invalid UUID v4 format for companyId'));
//   }

//   next();
// });

// // Static methods for efficient queries
// SavedSearchSchema.statics.findUserSavedSearches = function (userId, limit = 50) {
//   if (userId && !uuidValidator(userId)) {
//     throw new Error('Invalid UUID v4 format for userId');
//   }
//   return this.find({ userId: userId || null, isActive: true })
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .lean();
// };

// SavedSearchSchema.statics.getActiveAlerts = function (frequency, limit = 1000) {
//   return this.find({
//     alertFrequency: frequency,
//     isActive: true,
//     $or: [
//       { lastAlertSent: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Older than 24 hours
//       { lastAlertSent: null },
//     ],
//   })
//     .limit(limit)
//     .lean();
// };

// SavedSearchSchema.statics.updateLastAlertSent = function (searchId) {
//   if (!uuidValidator(searchId)) {
//     throw new Error('Invalid UUID v4 format for searchId');
//   }
//   return this.updateOne(
//     { _id: searchId, isActive: true },
//     { $set: { lastAlertSent: new Date() } }
//   );
// };

// // Export the model
// export default mongoose.model('SavedSearch', SavedSearchSchema);