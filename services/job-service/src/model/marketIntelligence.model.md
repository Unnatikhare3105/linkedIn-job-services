// // models/marketIntelligence.model.js
// import mongoose from "mongoose";

// const MarketIntelligenceSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: String,
//       required: true,
//     },
//     salaryNegotiation: {
//       jobTitle: String,
//       location: String,
//       industry: String,
//       experienceYears: Number,
//       currentSalary: Number,
//       offerSalary: Number,
//       marketData: {
//         percentile25: Number,
//         percentile50: Number,
//         percentile75: Number,
//         percentile90: Number,
//         average: Number,
//         dataPoints: Number,
//         lastUpdated: Date,
//       },
//       comparableRoles: [
//         {
//           title: String,
//           salaryRange: { min: Number, max: Number },
//           similarity: Number,
//         },
//       ],
//       benchmarkScore: Number,
//       negotiationStrategy: {
//         suggestedOffer: Number,
//         negotiationPoints: [String],
//         marketPosition: String,
//         recommendedApproach: String,
//       },
//       lastAnalyzed: Date,
//     },
//     marketReports: [
//       {
//         reportId: String,
//         reportType: String,
//         filters: {
//           industry: String,
//           location: String,
//           experienceLevel: String,
//         },
//         generatedAt: Date,
//         summary: String,
//         data: {
//           demandTrends: [String],
//           topSkills: [String],
//           salaryTrends: { median: Number, growthRate: String },
//           hiringTrends: { activeListings: Number, growthRate: String },
//         },
//         recommendations: [String],
//       },
//     ],
//     updatedAt: Date,
//   },
//   { timestamps: true }
// );

// // Define indexes
// MarketIntelligenceSchema.index({ userId: 1 }, { unique: true });
// MarketIntelligenceSchema.index({ "salaryNegotiation.lastAnalyzed": 1 });
// MarketIntelligenceSchema.index({ "marketReports.reportId": 1 });

// export const MarketIntelligence = mongoose.model(
//   "MarketIntelligence",
//   MarketIntelligenceSchema
// );
