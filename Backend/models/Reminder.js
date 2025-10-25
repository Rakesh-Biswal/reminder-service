const mongoose = require("mongoose")

const reminderSchema = new mongoose.Schema({
  reminderId: {
    type: String,
    unique: true,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  category: {
    type: String,
    default: "General",
  },
  status: {
    type: String,
    enum: ["active", "expired", "completed"],
    default: "active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model("Reminder", reminderSchema)
