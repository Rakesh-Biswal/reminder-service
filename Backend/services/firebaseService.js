const { db } = require("../config/firebase")

// Set buzzer flag in Firebase
const setBuzzerFlag = async (status) => {
  try {
    const firebaseRef = db.ref(`buzzerFlag`)
    await firebaseRef.set({
      status: status,
      updatedAt: new Date().toISOString(),
    })
    console.log(`Buzzer flag set to: ${status}`)
    return true
  } catch (error) {
    console.error("Error setting buzzer flag:", error)
    throw error
  }
}

// Get buzzer flag from Firebase
const getBuzzerFlag = async () => {
  try {
    const firebaseRef = db.ref(`buzzerFlag`)
    const snapshot = await firebaseRef.once("value")

    if (snapshot.exists()) {
      return snapshot.val()
    }
    return { status: "expired" } // Default value
  } catch (error) {
    console.error("Error getting buzzer flag:", error)
    throw error
  }
}

// Remove all existing Firebase functions since we don't store product data anymore
module.exports = {
  setBuzzerFlag,
  getBuzzerFlag
}