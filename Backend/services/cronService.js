const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendExpiryNotificationSMS } = require('./twilioService');
const { setBuzzerFlag } = require('./firebaseService');

// Get current IST time (UTC+5:30)
const getCurrentIST = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5 * 60 * 60 * 1000) + (30 * 60 * 1000));
  return istTime;
};

/**
 * Check for expired reminders and activate buzzer - PURE IST TIMEZONE
 */
const checkExpiredReminders = async () => {
  try {
    const currentIST = getCurrentIST();
    
    console.log('🔍 Checking for expired reminders in IST...');
    console.log('⏰ Current IST time:', currentIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    console.log('⏰ Current IST timestamp:', currentIST.getTime());
    
    // Find reminders that have expired in IST timezone
    const expiredReminders = await Reminder.find({
      expiryDate: { $lte: currentIST }, // Compare with current IST time
      status: 'active'
    }).populate('userId');

    let buzzerActivated = false;
    let notifiedCount = 0;

    console.log(`📊 Found ${expiredReminders.length} expired reminders`);

    for (const reminder of expiredReminders) {
      try {
        const reminderIST = new Date(reminder.expiryDate);
        
        console.log(`   Processing: ${reminder.name}`);
        console.log(`   Expiry IST: ${reminderIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`   Current IST: ${currentIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`   Is expired: ${reminder.expiryDate <= currentIST}`);
        console.log(`   Time difference: ${(currentIST.getTime() - reminder.expiryDate.getTime()) / (1000 * 60)} minutes ago`);
        
        // Activate buzzer flag if any reminder is expired
        if (!buzzerActivated) {
          console.log(`🚨 ACTIVATING BUZZER for: ${reminder.name}`);
          const result = await setBuzzerFlag("active");
          if (result.success) {
            buzzerActivated = true;
            console.log('✅ Firebase buzzer flag set to: active');
          } else {
            console.log('❌ Failed to set Firebase buzzer flag:', result.error);
          }
        }

        // Send SMS notification
        if (reminder.userId && reminder.userId.phone) {
          const formattedDate = reminderIST.toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata'
          });
          await sendExpiryNotificationSMS(
            reminder.userId.phone, 
            reminder.name, 
            formattedDate
          );
          notifiedCount++;
        }

        // Update reminder status to expired
        reminder.status = 'expired';
        await reminder.save();

        console.log(`✅ Processed expired reminder: ${reminder.name}`);

      } catch (error) {
        console.error(`❌ Failed to process reminder ${reminder.reminderId}:`, error.message);
      }
    }

    if (!buzzerActivated) {
      // No expired reminders found, ensure buzzer flag is set to expired
      await setBuzzerFlag("expired");
      console.log('✅ No expired reminders - buzzer flag set to: expired');
    }

    console.log(`📊 Cron job completed: ${notifiedCount} notifications sent, buzzer: ${buzzerActivated ? 'ACTIVE' : 'EXPIRED'}`);

  } catch (error) {
    console.error('❌ Error in cron job:', error.message);
  }
}

/**
 * Initialize cron jobs
 */
const initializeCronJobs = () => {
  // Check for expired reminders every 1 minute
  cron.schedule('* * * * *', checkExpiredReminders);

  console.log('⏰ Cron jobs initialized (IST Timezone):');
  console.log('   - Expired reminders check: every 1 minute');

  // Initialize buzzer flag to expired on startup
  setTimeout(async () => {
    await setBuzzerFlag("expired");
    console.log('✅ Buzzer flag initialized to: expired');
    
    // Run immediately on startup
    checkExpiredReminders();
  }, 3000);
}

module.exports = {
  initializeCronJobs,
  checkExpiredReminders,
  getCurrentIST
}