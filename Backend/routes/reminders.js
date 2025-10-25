const express = require("express")
const Reminder = require("../models/Reminder")
const User = require("../models/User")
const jwt = require("jsonwebtoken")
const { 
  sendReminderCreatedSMS, 
  sendReminderDeletedSMS 
} = require("../services/twilioService")
const router = express.Router()

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]
  if (!token) {
    return res.status(401).json({ message: "No token provided" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")
    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token" })
  }
}

// Generate unique reminder ID
const generateReminderId = () => {
  return "REM_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
}

// Create reminder - NO FIREBASE PRODUCT STORAGE
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category } = req.body

    if (!name || !expiryDate) {
      return res.status(400).json({ message: "Name and expiry date are required" })
    }

    const reminder = new Reminder({
      reminderId: generateReminderId(),
      userId: req.userId,
      name,
      description: description || "",
      expiryDate: new Date(expiryDate),
      category: category || "General",
      status: "active",
    })

    await reminder.save()

    // Send reminder creation SMS (non-blocking)
    try {
      const user = await User.findById(req.userId)
      if (user && user.phone) {
        const formattedDate = new Date(expiryDate).toLocaleDateString()
        await sendReminderCreatedSMS(user.phone, name, formattedDate)
      }
    } catch (smsError) {
      console.error("SMS sending failed:", smsError)
    }

    res.status(201).json({
      message: "Reminder created successfully",
      reminder,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get all reminders for user
router.get("/", verifyToken, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.userId }).sort({ createdAt: -1 })
    res.json({ reminders })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get reminder by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({ reminderId: req.params.id, userId: req.userId })
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }
    res.json({ reminder })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update reminder - NO FIREBASE PRODUCT STORAGE
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category, status } = req.body

    const reminder = await Reminder.findOneAndUpdate(
      { reminderId: req.params.id, userId: req.userId },
      {
        name,
        description,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        category,
        status,
        updatedAt: new Date(),
      },
      { new: true },
    )

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    res.json({ message: "Reminder updated successfully", reminder })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete reminder - NO FIREBASE PRODUCT STORAGE
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({ reminderId: req.params.id, userId: req.userId })
    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    // Send reminder deletion SMS (non-blocking)
    try {
      const user = await User.findById(req.userId)
      if (user && user.phone) {
        await sendReminderDeletedSMS(user.phone, reminder.name)
      }
    } catch (smsError) {
      console.error("SMS sending failed:", smsError)
    }

    res.json({ message: "Reminder deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router