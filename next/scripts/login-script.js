// =============================================================================
// login-script.js - Student Portal Login
// =============================================================================

const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const REMEMBER_ME_KEY = 'studentPortal:rememberMeEmail';

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const inputs = document.querySelectorAll('input');
  const alertBox = document.getElementById('alertBox');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const rememberMeInput = document.getElementById('rememberMe');

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`;
    setTimeout(() => {
      alertBox.className = 'alert-box hidden';
    }, 5000);
  }

  const rememberedEmail = localStorage.getItem(REMEMBER_ME_KEY);
  if (rememberedEmail && emailInput && rememberMeInput) {
    emailInput.value = rememberedEmail;
    rememberMeInput.checked = true;
  }

  rememberMeInput?.addEventListener('change', () => {
    if (!rememberMeInput.checked) {
      localStorage.removeItem(REMEMBER_ME_KEY);
      return;
    }

    const email = emailInput?.value.trim();
    if (email) {
      localStorage.setItem(REMEMBER_ME_KEY, email);
    }
  });

  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.parentElement.style.transform = 'translateY(-3px)';
    });
    input.addEventListener('blur', () => {
      input.parentElement.style.transform = 'translateY(0)';
    });
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertBox) alertBox.className = 'alert-box hidden';

    const email = emailInput?.value.trim() || '';
    const password = passwordInput?.value || '';

    if (!email || !password) return;

    const originalText = loginBtn.textContent;
    loginBtn.textContent = 'Authenticating...';
    loginBtn.disabled = true;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAlert('Invalid email or password.', 'error');
      loginBtn.textContent = originalText;
      loginBtn.disabled = false;
      return;
    }

    if (rememberMeInput?.checked) {
      localStorage.setItem(REMEMBER_ME_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_ME_KEY);
    }

    showAlert('Login successful! Verifying permissions...', 'success');
    loginBtn.textContent = 'Success!';
    loginBtn.style.backgroundColor = '#10b981';

    const userId = data.user.id;
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    setTimeout(() => {
      const userRole = profile?.role || 'student';
      if (userRole === 'admin' || userRole === 'teacher') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }, 1000);
  });
});
