// import mongoose from 'mongoose';
// import { generateSecureId } from '../utils/security.js';

// const validUUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// const UserConnectionsSchema = new mongoose.Schema({
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
//   connections: [{
//     connectionId: { type: String, default: generateSecureId, validate: validUUIDRegex },
//     connectionType: { type: String, enum: ['friend', 'colleague', 'referral'], required: true },
//     name: { type: String, maxlength: 100, required: true },
//     email: { type: String, maxlength: 100 },
//     company: { type: String, maxlength: 100 },
//     companyId: {
//       type: String,
//       validate: {
//         validator: (v) => !v || validUUIDRegex.test(v),
//         message: 'Invalid companyId UUID'
//       }
//     },
//     position: { type: String, maxlength: 100 },
//     canRefer: { type: Boolean, default: false },
//     isActive: { type: Boolean, default: true },
//     connectedAt: { type: Date, default: Date.now }
//   }],
//   updatedAt: { type: Date, default: Date.now }
// }, {
//   timestamps: { updatedAt: 'updatedAt' },
//   collection: 'user_connections',
//   shardKey: { userId: 1 }
// });

// UserConnectionsSchema.index({ userId: 1, 'connections.connectionId': 1 });
// UserConnectionsSchema.index({ 'connections.companyId': 1 });

// UserConnectionsSchema.statics.getNetworkCompanies = async function (userId) {
//   const doc = await this.findOne({ userId }).lean();
//   return doc ? doc.connections.filter(c => c.isActive && c.companyId).map(c => c.companyId) : [];
// };

// export default mongoose.model('UserConnections', UserConnectionsSchema);