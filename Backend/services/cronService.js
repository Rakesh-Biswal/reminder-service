const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendExpiryNotificationSMS } = require('./twilioService');
const { setBuzzerFlag } = require('./firebaseService');

/**
 * Check for expired reminders and activate buzzer - FIXED COMPARISON
 */
const checkExpiredReminders = async () => {
  try {
    const currentTime = new Date();
    
    console.log('🔍 Checking for expired reminders...');
    console.log('⏰ Current server time:', currentTime.toString());
    console.log('⏰ Current IST time:', currentTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    
    // Find reminders that have expired
    const expiredReminders = await Reminder.find({
      expiryDate: { $lte: currentTime },
      status: 'active'
    }).populate('userId');

    let buzzerActivated = false;
    let notifiedCount = 0;

    console.log(`📊 Found ${expiredReminders.length} expired reminders`);

    for (const reminder of expiredReminders) {
      try {
        console.log(`   Processing: ${reminder.name}`);
        console.log(`   Expiry Date: ${reminder.expiryDate.toString()}`);
        console.log(`   Expiry IST: ${reminder.expiryDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        console.log(`   Current: ${currentTime.toString()}`);
        console.log(`   Is expired: ${reminder.expiryDate <= currentTime}`);
        
        // Activate buzzer flag if any reminder is expired
        if (!buzzerActivated) {
          console.log(`🚨 ACTIVATING BUZZER for: ${reminder.name}`);
          await setBuzzerFlag("active");
          buzzerActivated = true;
        }

        // Send SMS notification
        if (reminder.userId && reminder.userId.phone) {
          const formattedDate = reminder.expiryDate.toLocaleDateString('en-IN', {
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
    } else {
      console.log('🚨 BUZZER WAS ACTIVATED - Firebase flag set to: active');
    }

    console.log(`📊 Cron job completed: ${notifiedCount} notifications sent`);

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