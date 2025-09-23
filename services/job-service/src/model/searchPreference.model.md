// import mongoose from 'mongoose';
// import { generateSecureId } from '../utils/security.js';

// const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// const SearchPreferencesSchema = new mongoose.Schema({
//   userId: {
//     type: String,
//     required: true,
//     unique: true,
//     index: true,
//     validate: {
//       validator: (v) => validUUIDRegex.test(v),
//       message: 'Invalid userId UUID'
//     }
//   },
//   searchFilters: {
//     skills: [{ type: String, maxlength: 50 }],
//     locations: [{ type: String, maxlength: 100 }],
//     experienceLevel: [{ type: String, enum: ['entry', 'mid', 'senior', 'executive'] }],
//     salaryRange: {
//       min: { type: Number, min: 0 },
//       max: { type: Number, min: 0 }
//     },
//     jobType: [{ type: String, enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] }]
//   },
//   quickApplySettings: {
//     enabled: { type: Boolean, default: false },
//     maxApplicationsPerDay: { type: Number, min: 1, max: 50, default: 10 },
//     resumeId: {
//       type: String,
//       validate: {
//         validator: (v) => !v || validUUIDRegex.test(v),
//         message: 'Invalid resumeId UUID'
//       }
//     },
//     source: { type: String, enum: ['direct', 'linkedin', 'referral', 'job-board'], default: 'direct' },
//     templates: [{
//       id: { type: String, default: generateSecureId, validate: validUUIDRegex },
//       name: { type: String, maxlength: 100, required: true },
//       coverLetter: { type: String, maxlength: 2000 },
//       customization: { type: Object, default: {} },
//       createdAt: { type: Date, default: Date.now }
//     }]
//   },
//   updatedAt: { type: Date, default: Date.now }
// }, {
//   timestamps: { updatedAt: 'updatedAt' },
//   collection: 'search_preferences',
//   shardKey: { userId: 1 }
// });

// SearchPreferencesSchema.index({ userId: 1, 'quickApplySettings.templates.id': 1 });

// export default mongoose.model('SearchPreferences', SearchPreferencesSchema);