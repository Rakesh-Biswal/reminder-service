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

// Convert to IST time (UTC+5:30)
const convertToIST = (dateString) => {
  const date = new Date(dateString);
  // Add 5 hours 30 minutes to convert to IST
  const istTime = new Date(date.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
  return istTime;
}

// Get current IST time
const getCurrentIST = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
  return istTime;
}

// Create reminder - WITH IST TIMEZONE
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category } = req.body

    if (!name || !expiryDate) {
      return res.status(400).json({ message: "Name and expiry date are required" })
    }

    // Convert to IST timezone
    const istExpiryDate = convertToIST(expiryDate);
    const currentIST = getCurrentIST();

    console.log('📅 Date Information:');
    console.log('   Input expiry date:', expiryDate);
    console.log('   Converted to IST:', istExpiryDate);
    console.log('   Current IST time:', currentIST);
    console.log('   Time difference (ms):', istExpiryDate.getTime() - currentIST.getTime());

    const reminder = new Reminder({
      reminderId: generateReminderId(),
      userId: req.userId,
      name,
      description: description || "",
      expiryDate: istExpiryDate, // Store in IST
      category: category || "General",
      status: "active",
    })

    await reminder.save()

    // Send reminder creation SMS (non-blocking)
    try {
      const user = await User.findById(req.userId)
      if (user && user.phone) {
        const formattedDate = istExpiryDate.toLocaleDateString('en-IN', {
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
      reminder: {
        ...reminder.toObject(),
        // Also send back the original expiry date for frontend display
        originalExpiryDate: expiryDate
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get all reminders for user
router.get("/", verifyToken, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.userId }).sort({ createdAt: -1 })
    
    // Convert dates to IST for response
    const remindersWithIST = reminders.map(reminder => ({
      ...reminder.toObject(),
      expiryDateIST: reminder.expiryDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata'
      })
    }))
    
    res.json({ reminders: remindersWithIST })
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
    
    // Add IST formatted date
    const reminderWithIST = {
      ...reminder.toObject(),
      expiryDateIST: reminder.expiryDate.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata'
      })
    }
    
    res.json({ reminder: reminderWithIST })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update reminder - WITH IST TIMEZONE
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

    // If expiryDate is provided, convert to IST
    if (expiryDate) {
      const istExpiryDate = convertToIST(expiryDate);
      updateData.expiryDate = istExpiryDate;
      
      console.log('📅 Update Date Information:');
      console.log('   Input expiry date:', expiryDate);
      console.log('   Converted to IST:', istExpiryDate);
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
        expiryDateIST: reminder.expiryDate.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata'
        })
      }
    })
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