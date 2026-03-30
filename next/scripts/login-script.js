// Initialize Supabase
// Initialize Supabase
const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";

// CHANGED: Renamed variable to 'supabaseClient'
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const inputs = document.querySelectorAll('input');
  const alertBox = document.getElementById('alertBox'); 

  // Custom Alert Function
  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`; 
    setTimeout(() => {
      alertBox.className = 'alert-box hidden';
    }, 5000);
  }

  // Input animations
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.style.transform = 'translateY(-3px)';
    });
    input.addEventListener('blur', () => {
      input.parentElement.style.transform = 'translateY(0)';
    });
  });

  // Login Logic
// Login Logic
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    
    // Hide previous alerts
    if (alertBox) alertBox.className = 'alert-box hidden';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (email && password) {
      const originalText = loginBtn.textContent;
      loginBtn.textContent = 'Authenticating...';
      loginBtn.disabled = true;

      // Real Supabase Login Call
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        // If they type the wrong password, show the red alert
        showAlert('Invalid email or password.', 'error');
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
      } else {
        showAlert('Login successful! Verifying permissions...', 'success');
        loginBtn.textContent = 'Success!';
        loginBtn.style.backgroundColor = '#10b981';
        
        // 👉 NEW: Fetch the user's role from the profiles table
        const userId = data.user.id;
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        // Redirect based on the role
        setTimeout(() => {
          const userRole = profile?.role || 'student';
          if (userRole === 'admin' || userRole === 'teacher') {
             window.location.href = 'admin-dashboard.html'; // Send to Admin/Teacher UI
          } else {
             window.location.href = 'dashboard.html'; // Send to Student UI
          }
        }, 1000);
      }
    }
  });
});