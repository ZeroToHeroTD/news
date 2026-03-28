-document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Supabase
    const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
    // NOTE: Use your anon public key here!
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
    
    if (!window.supabase) {
        console.error("Supabase library not loaded! Check your CDN link.");
        return;
    }

    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    // 2. Grab DOM Elements
    const resetForm = document.getElementById('resetForm');
    const updateBtn = document.getElementById('updateBtn');
    const alertBox = document.getElementById('alertBox');

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert-box ${type}`;
        alertBox.classList.remove('hidden'); 
        setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
    }

    // 3. Handle the Submission
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validation
        if (newPassword !== confirmPassword) {
            return showAlert('Passwords do not match.', 'error');
        }

        updateBtn.textContent = 'Updating...';
        updateBtn.disabled = true;

        // The Supabase Magic
        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            showAlert(error.message, 'error');
            updateBtn.textContent = 'Update Password';
            updateBtn.disabled = false;
        } else {
            showAlert('Password updated! Redirecting to login...', 'success');
            updateBtn.style.backgroundColor = '#10b981'; // Turn button green
            
            // Send them back to the login page after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
    });
});