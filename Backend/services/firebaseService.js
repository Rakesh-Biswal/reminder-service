const { db } = require("../config/firebase")

// Set buzzer flag in Firebase
const setBuzzerFlag = async (status) => {
  try {
    const firebaseRef = db.ref(`buzzerFlag`)
    await firebaseRef.set({
      status: status,
      updatedAt: new Date().toISOString(),
      lastUpdated: Date.now()
    })
    console.log(`✅ Firebase: Buzzer flag set to: ${status}`)
    return { success: true, status }
  } catch (error) {
    console.error("❌ Firebase: Error setting buzzer flag:", error.message)
    return { success: false, error: error.message }
  }
}

// Get buzzer flag from Firebase
const getBuzzerFlag = async () => {
  try {
    const firebaseRef = db.ref(`buzzerFlag`)
    const snapshot = await firebaseRef.once("value")

    if (snapshot.exists()) {
      const data = snapshot.val()
      console.log(`✅ Firebase: Got buzzer flag: ${data.status}`)
      return data
    }
    console.log('ℹ️ Firebase: No buzzer flag found, returning default')
    return { status: "expired" } // Default value
  } catch (error) {
    console.error("❌ Firebase: Error getting buzzer flag:", error.message)
    throw error
  }
}

module.exports = {
  setBuzzerFlag,
  getBuzzerFlag
}