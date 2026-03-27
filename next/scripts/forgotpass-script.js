// Initialize Supabase
const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";

// CHANGED: Renamed variable to 'supabaseClient'
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('forgotForm');
  const resetBtn = document.getElementById('resetBtn');
  const inputs = document.querySelectorAll('input');

  // Input animations
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.style.transform = 'translateY(-3px)';
    });
    input.addEventListener('blur', () => {
      input.parentElement.style.transform = 'translateY(0)';
    });
  });

  // Forgot Password Logic
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const resetEmail = document.getElementById('resetEmail').value;

    if (resetEmail) {
      const originalText = resetBtn.textContent;
      resetBtn.textContent = 'Sending link...';
      resetBtn.disabled = true;

      // Real Supabase Password Reset Call
      const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: window.location.origin + '/reset-password.html', 
      });

      if (error) {
        alert('Error: ' + error.message);
        resetBtn.textContent = originalText;
        resetBtn.disabled = false;
      } else {
        resetBtn.textContent = 'Reset Link Sent!';
        resetBtn.style.backgroundColor = '#10b981';
        setTimeout(() => {
           resetBtn.textContent = originalText;
           resetBtn.disabled = false;
           resetBtn.style.backgroundColor = ''; 
           forgotForm.reset();
        }, 3000);
      }
    }
  });
}); 