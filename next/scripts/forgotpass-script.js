// =============================================================================
// forgotpass-script.js — Password Reset Request
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
    
    if (!window.supabase) {
        console.error("Supabase library not loaded!");
        return;
    }
    
    const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

    const forgotForm = document.getElementById('forgotForm');
    const resetBtn = document.getElementById('resetBtn');

    forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;

        resetBtn.textContent = 'Sending...';
        resetBtn.disabled = true;

        // 🚨 THE FIX: Replace 'https://your-live-website.com' with your actual hosted domain 
        // (e.g., https://studentportal.vercel.app or whatever hosting you use).
        // This forces the email button to point to the live site, NEVER localhost.
        const LIVE_SITE_URL = 'https://jawiportal.vercel.app/'; 
        const redirectPath = LIVE_SITE_URL + '/next/html/reset-password.html';

        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: redirectPath,
        });

        if (error) {
            alert('Error: ' + error.message);
            resetBtn.textContent = 'Send Reset Link';
            resetBtn.disabled = false;
        } else {
            resetBtn.textContent = 'Link Sent to Gmail!';
            resetBtn.style.backgroundColor = '#10b981'; // Success Green
            resetBtn.style.color = '#ffffff';
        }
    });
});