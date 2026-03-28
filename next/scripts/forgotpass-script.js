document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    const forgotForm = document.getElementById('forgotForm');
    const resetBtn = document.getElementById('resetBtn');

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;

        resetBtn.textContent = 'Sending...';
        resetBtn.disabled = true;

        // THE KEY STEP: This triggers your Gmail SMTP
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            // FIXED: Ensure this path points exactly to your reset page
            redirectTo: window.location.origin + '/next/html/reset-password.html',
        });

        if (error) {
            alert('Error: ' + error.message);
            resetBtn.textContent = 'Send Reset Link';
            resetBtn.disabled = false;
        } else {
            resetBtn.textContent = 'Link Sent to Gmail!';
            resetBtn.style.backgroundColor = '#10b981'; // Success Green
        }
    });
});