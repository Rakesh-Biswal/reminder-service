const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendExpiryNotificationSMS } = require('./twilioService');
const { setBuzzerFlag } = require('./firebaseService');

/**
 * Check for expired reminders and activate buzzer
 */
const checkExpiredReminders = async () => {
  try {
    console.log('🔍 Checking for expired reminders...');
    const now = new Date();
    
    // Find reminders that have expired but are still active
    const expiredReminders = await Reminder.find({
      expiryDate: { $lte: now },
      status: 'active'
    }).populate('userId');

    let buzzerActivated = false;
    let notifiedCount = 0;

    for (const reminder of expiredReminders) {
      try {
        // Activate buzzer flag if any reminder is expired
        if (!buzzerActivated) {
          await setBuzzerFlag("active");
          buzzerActivated = true;
          console.log(`🚨 Buzzer activated for: ${reminder.name}`);
        }

        // Send SMS notification
        if (reminder.userId && reminder.userId.phone) {
          const formattedDate = reminder.expiryDate.toLocaleDateString();
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

  console.log('⏰ Cron jobs initialized:');
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
  checkExpiredReminders
}