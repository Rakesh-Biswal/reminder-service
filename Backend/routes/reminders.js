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

// Create reminder - FIXED TIMEZONE HANDLING
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category } = req.body

    if (!name || !expiryDate) {
      return res.status(400).json({ message: "Name and expiry date are required" })
    }

    // FIX: Use the date directly - datetime-local already provides correct time
    const reminderExpiryDate = new Date(expiryDate);
    const currentTime = new Date();

    console.log('📅 Date Information:');
    console.log('   Input expiry date:', expiryDate);
    console.log('   Parsed expiry date:', reminderExpiryDate);
    console.log('   Current server time:', currentTime);
    console.log('   Time difference (ms):', reminderExpiryDate.getTime() - currentTime.getTime());
    console.log('   Expiry date (ISO):', reminderExpiryDate.toISOString());
    console.log('   Expiry date (Local):', reminderExpiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

    const reminder = new Reminder({
      reminderId: generateReminderId(),
      userId: req.userId,
      name,
      description: description || "",
      expiryDate: reminderExpiryDate, // Store as provided (already in correct time)
      category: category || "General",
      status: "active",
    })

    await reminder.save()

    // Send reminder creation SMS (non-blocking)
    try {
      const user = await User.findById(req.userId)
      if (user && user.phone) {
        const formattedDate = reminderExpiryDate.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
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
    
    // Format dates for display in IST
    const remindersWithDisplay = reminders.map(reminder => ({
      ...reminder.toObject(),
      displayDate: reminder.expiryDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }))
    
    res.json({ reminders: remindersWithDisplay })
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
    
    // Add formatted date for display
    const reminderWithDisplay = {
      ...reminder.toObject(),
      displayDate: reminder.expiryDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    res.json({ reminder: reminderWithDisplay })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update reminder - FIXED TIMEZONE
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category, status } = req.body

    const updateData = {
      name,
      description,
      category,
      status,
      updatedAt: new Date(),
    }

    // If expiryDate is provided, use it directly
    if (expiryDate) {
      const reminderExpiryDate = new Date(expiryDate);
      updateData.expiryDate = reminderExpiryDate;
      
      console.log('📅 Update Date Information:');
      console.log('   Input expiry date:', expiryDate);
      console.log('   Parsed expiry date:', reminderExpiryDate);
    }

    const reminder = await Reminder.findOneAndUpdate(
      { reminderId: req.params.id, userId: req.userId },
      updateData,
      { new: true },
    )

    if (!reminder) {
      return res.status(404).json({ message: "Reminder not found" })
    }

    res.json({ 
      message: "Reminder updated successfully", 
      reminder: {
        ...reminder.toObject(),
        displayDate: reminder.expiryDate.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete reminder
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