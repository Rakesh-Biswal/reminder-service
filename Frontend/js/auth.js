const API_URL = "https://reminder-service-e8n7.onrender.com/api"

// Toggle between signin and signup forms
function toggleForms() {
  const signinForm = document.getElementById("signin-form")
  const signupForm = document.getElementById("signup-form")

  signinForm.classList.toggle("active")
  signupForm.classList.toggle("active")

  // Clear forms
  document.getElementById("signin-form-element").reset()
  document.getElementById("signup-form-element").reset()
  document.getElementById("message").textContent = ""
  document.getElementById("message").className = "message"
}

// Show message
function showMessage(message, type) {
  const messageEl = document.getElementById("message")
  messageEl.textContent = message
  messageEl.className = `message ${type}`

  setTimeout(() => {
    messageEl.className = "message"
  }, 5000)
}

// Signin form submission
document.getElementById("signin-form-element").addEventListener("submit", async (e) => {
  e.preventDefault()

  const email = document.getElementById("signin-email").value
  const password = document.getElementById("signin-password").value

  try {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (response.ok) {
      // Store JWT token in cookie
      document.cookie = `token=${data.token}; path=/; max-age=604800`
      showMessage("Sign in successful! Redirecting...", "success")

      setTimeout(() => {
        window.location.href = "dashboard.html"
      }, 1500)
    } else {
      showMessage(data.message || "Sign in failed", "error")
    }
  } catch (error) {
    showMessage("Error: " + error.message, "error")
  }
})

// Signup form submission
document.getElementById("signup-form-element").addEventListener("submit", async (e) => {
  e.preventDefault()

  const name = document.getElementById("signup-name").value
  const email = document.getElementById("signup-email").value
  const password = document.getElementById("signup-password").value
  const phone = "+91" + document.getElementById("signup-phone").value

  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password, phone }),
    })

    const data = await response.json()

    if (response.ok) {
      // Store JWT token in cookie
      document.cookie = `token=${data.token}; path=/; max-age=604800`
      showMessage("Account created successfully! Redirecting...", "success")

      setTimeout(() => {
        window.location.href = "dashboard.html"
      }, 1500)
    } else {
      showMessage(data.message || "Sign up failed", "error")
    }
  } catch (error) {
    showMessage("Error: " + error.message, "error")
  }
})
