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

// Get current IST time (India Standard Time - UTC+5:30)
const getCurrentIST = () => {
  const now = new Date();
  // Convert to IST by adding 5 hours 30 minutes
  const istTime = new Date(now.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
  return istTime;
}

// Convert datetime-local input to IST Date object
const parseISTDate = (datetimeLocalString) => {
  // datetime-local input is in local timezone, but we want to treat it as IST
  const localDate = new Date(datetimeLocalString);
  
  // Get the local time components
  const year = localDate.getFullYear();
  const month = localDate.getMonth();
  const day = localDate.getDate();
  const hours = localDate.getHours();
  const minutes = localDate.getMinutes();
  
  // Create a new date in IST (treat the input as IST time)
  // We'll create a UTC date that represents the same IST time
  const istDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));
  
  // Since IST is UTC+5:30, subtract 5:30 to get the correct UTC time
  const utcDate = new Date(istDate.getTime() - (5 * 60 * 60 * 1000) - (30 * 60 * 1000));
  
  return utcDate; // This UTC time will represent the correct IST time when displayed
}

// Create reminder - PURE IST TIMEZONE
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, description, expiryDate, category } = req.body

    if (!name || !expiryDate) {
      return res.status(400).json({ message: "Name and expiry date are required" })
    }

    // Parse the date as IST
    const istExpiryDate = parseISTDate(expiryDate);
    const currentIST = getCurrentIST();

    console.log('📅 IST DATE INFORMATION:');
    console.log('   Input from frontend:', expiryDate);
    console.log('   Stored as IST (UTC representation):', istExpiryDate.toISOString());
    console.log('   Current IST time:', currentIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    console.log('   Display IST:', istExpiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    console.log('   Time difference (minutes):', (istExpiryDate.getTime() - currentIST.getTime()) / (1000 * 60));

    const reminder = new Reminder({
      reminderId: generateReminderId(),
      userId: req.userId,
      name,
      description: description || "",
      expiryDate: istExpiryDate, // Store as IST (in UTC format)
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
        displayDate: istExpiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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
    
    // Add IST display dates
    const remindersWithIST = reminders.map(reminder => ({
      ...reminder.toObject(),
      displayDate: reminder.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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
    
    res.json({ 
      reminder: {
        ...reminder.toObject(),
        displayDate: reminder.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update reminder - PURE IST TIMEZONE
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

    // If expiryDate is provided, parse as IST
    if (expiryDate) {
      const istExpiryDate = parseISTDate(expiryDate);
      updateData.expiryDate = istExpiryDate;
      
      console.log('📅 Update Date Information:');
      console.log('   Input:', expiryDate);
      console.log('   Stored as IST:', istExpiryDate.toISOString());
      console.log('   Display IST:', istExpiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
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
        displayDate: reminder.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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