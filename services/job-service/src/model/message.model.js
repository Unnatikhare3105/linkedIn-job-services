import mongoose from "mongoose";
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from "uuid";
import { generateSecureId } from "../utils/security.js";

const messageSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
      validate: {
        validator: (v) => uuidValidate(v) && uuidVersion(v) === 4,
        message: "Invalid UUID for _id",
      },
    },
    senderId: {
      type: String,
      required: true,
      validate: {
        validator: (v) => uuidValidate(v) && uuidVersion(v) === 4,
        message: "Invalid UUID for senderId",
      },
    },
    recipientId: {
      type: String,
      required: true,
      validate: {
        validator: (v) => uuidValidate(v) && uuidVersion(v) === 4,
        message: "Invalid UUID for recipientId",
      },
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    jobId: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || (uuidValidate(v) && uuidVersion(v) === 4),
        message: "Invalid UUID for jobId",
      },
    },
    messageType: {
      type: String,
      enum: {
        values: ["direct_recruiter", "system", "application_update"],
        message: "{VALUE} is not a valid message type",
      },
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
messageSchema.index({ senderId: 1, isDeleted: 1 });
messageSchema.index({ recipientId: 1, isDeleted: 1 });
messageSchema.index({ jobId: 1, isDeleted: 1 });
messageSchema.index({ sentAt: -1, isDeleted: 1 });

// Pre-save hook to ensure UUIDs are valid
messageSchema.pre("save", function (next) {
  if (!uuidValidate(this._id) || uuidVersion(this._id) !== 4) {
    this._id = generateSecureId();
  }
  next();
});

export const Message = mongoose.model("Message", messageSchema);