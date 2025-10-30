const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const twilioPhoneNumber = '+12183097166';

/**
 * Send SMS notification
 * @param {string} to - Recipient phone number
 * @param {string} message - Message content
 * @returns {Promise}
 */
const sendSMS = async (to, message) => {
  try {
    // Validate phone number format
    if (!to.startsWith('+')) {
      to = '+91' + to; // Default to Indian format if no country code
    }

    const result = await client.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: to
    });

    console.log('SMS sent successfully:', result.sid);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error('Error sending SMS:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome SMS after signup
 * @param {string} phone - User phone number
 * @param {string} userName - User name
 */
const sendWelcomeSMS = async (phone, userName) => {
  const message = `Welcome ${userName}! Thank you for signing up with ExpiryReminder. We'll help you track your product expiry dates effectively.`;
  return await sendSMS(phone, message);
};

/**
 * Send reminder creation confirmation SMS
 * @param {string} phone - User phone number
 * @param {string} reminderName - Reminder name
 * @param {string} expiryDate - Expiry date
 */
const sendReminderCreatedSMS = async (phone, reminderName, expiryDate) => {
  const message = `Reminder created: "${reminderName}" will expire on ${expiryDate}. We'll notify you before it expires.`;
  return await sendSMS(phone, message);
};

/**
 * Send expiry notification SMS
 * @param {string} phone - User phone number
 * @param {string} reminderName - Reminder name
 * @param {string} expiryDate - Expiry date
 */
const sendExpiryNotificationSMS = async (phone, reminderName, expiryDate) => {
  const message = `URGENT: "${reminderName}" has expired on ${expiryDate}. Please take necessary action.`;
  return await sendSMS(phone, message);
};

/**
 * Send reminder deletion confirmation SMS
 * @param {string} phone - User phone number
 * @param {string} reminderName - Reminder name
 */
const sendReminderDeletedSMS = async (phone, reminderName) => {
  const message = `Reminder deleted: "${reminderName}" has been removed from your tracking list.`;
  return await sendSMS(phone, message);
};

module.exports = {
  sendSMS,
  sendWelcomeSMS,
  sendReminderCreatedSMS,
  sendExpiryNotificationSMS,
  sendReminderDeletedSMS
};