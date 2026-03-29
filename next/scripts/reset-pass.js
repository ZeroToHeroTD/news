// =============================================================================
// reset-pass-script.js — Set New Password
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
    
    if (!window.supabase) {
        console.error("Supabase library not loaded!");
        return;
    }

    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    const resetForm = document.getElementById('resetForm');
    const updateBtn = document.getElementById('updateBtn');
    const alertBox = document.getElementById('alertBox');

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert-box ${type}`;
        alertBox.classList.remove('hidden'); 
        setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
    }

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (newPassword !== confirmPassword) {
            return showAlert('Passwords do not match.', 'error');
        }

        if (newPassword.length < 6) {
            return showAlert('Password must be at least 6 characters.', 'error');
        }

        updateBtn.textContent = 'Updating...';
        updateBtn.disabled = true;

        // Supabase automatically uses the session token from the URL hash
        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            showAlert(error.message, 'error');
            updateBtn.textContent = 'Update Password';
            updateBtn.disabled = false;
        } else {
            showAlert('Password updated! Redirecting to login...', 'success');
            updateBtn.style.backgroundColor = '#10b981'; // Turn button green
            updateBtn.textContent = 'Success!';
            
            // Redirect back to login page
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2500);
        }
    });
});