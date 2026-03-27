// Initialize Supabase
const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";

// CHANGED: Renamed variable to 'supabaseClient'
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signupForm');
  const signupBtn = document.getElementById('signupBtn');
  const inputs = document.querySelectorAll('input');
  const alertBox = document.getElementById('alertBox'); 

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`; 
    setTimeout(() => {
      alertBox.className = 'alert-box hidden';
    }, 5000);
  }

  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.style.transform = 'translateY(-3px)';
    });
    input.addEventListener('blur', () => {
      input.parentElement.style.transform = 'translateY(0)';
    });
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    alertBox.className = 'alert-box hidden';

    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (password.length < 6) {
      showAlert('Password must be at least 6 characters long.', 'error');
      return; 
    }

    if (fullName && email && password) {
      const originalText = signupBtn.textContent;
      signupBtn.textContent = 'Creating account...';
      signupBtn.disabled = true;

      // CHANGED: Use 'supabaseClient' here too
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName, 
          }
        }
      });

      if (error) {
        showAlert(error.message, 'error');
        signupBtn.textContent = originalText;
        signupBtn.disabled = false;
      } else {
        showAlert('Success! Check your email to verify your account.', 'success');
        signupBtn.textContent = 'Account Created!';
        signupBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
           window.location.href = 'index.html'; 
        }, 3000);
      }
    }
  });
});