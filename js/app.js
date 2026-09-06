document.getElementById('send-otp-btn')?.addEventListener('click', async () => {
  let phone = document.getElementById('phone-number').value.trim();
  
  if (!phone) return alert("Please enter mobile number");

  // Remove spaces, dashes, or brackets if user entered any
  phone = phone.replace(/[\s\-\(\)]/g, "");

  // If +91 is not added by user, add it automatically
  if (!phone.startsWith("+")) {
    phone = "+91" + phone;
  }

  // Validate standard length (+91 + 10 digits = 13 characters)
  if (phone.length !== 13) {
    return alert("Please enter a valid 10-digit Indian mobile number");
  }

  try {
    setupRecaptcha(); // Ensure recaptcha is ready
    confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
    document.getElementById('phone-input-group')?.classList.add('hidden');
    document.getElementById('otp-input-group')?.classList.remove('hidden');
    alert("OTP sent successfully to " + phone);
  } catch (error) {
    console.error("OTP Error:", error);
    alert("Error sending OTP: " + error.message);
  }
});
