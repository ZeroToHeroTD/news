// =============================================================================
// reset-pass.js - Set New Password
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
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
    let recoveryReady = false;

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert-box ${type}`;
        alertBox.classList.remove('hidden');
        setTimeout(() => { alertBox.classList.add('hidden'); }, 5000);
    }

    async function bootstrapRecoverySession() {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const type = hash.get('type');


        if (type === 'recovery' && accessToken && refreshToken) {
            const { error } = await supabaseClient.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                showAlert('This reset link is invalid or has expired. Please request a new one.', 'error');
                return false;
            }

            const cleanUrl = `${window.location.pathname}${window.location.search}`;
            window.history.replaceState({}, document.title, cleanUrl);
            return true;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) return true;

        showAlert('This reset link is invalid or has expired. Please request a new one.', 'error');
        return false;
    }

    recoveryReady = await bootstrapRecoverySession();

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!recoveryReady) {
            showAlert('Your recovery session is missing. Please request a new reset link.', 'error');
            return;
        }

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            return showAlert('Passwords do not match.', 'error');
        }

        if (newPassword.length < 6) {
            return showAlert('Password must be at least 6 characters.', 'error');
        }

        updateBtn.textContent = 'Updating...';
        updateBtn.disabled = true;

        const { error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) {
            showAlert(error.message, 'error');
            updateBtn.textContent = 'Update Password';
            updateBtn.disabled = false;
            return;
        }

        await supabaseClient.auth.signOut();
        showAlert('Password updated! Redirecting to login...', 'success');
        updateBtn.style.backgroundColor = '#10b981';
        updateBtn.textContent = 'Success!';

        setTimeout(() => {
            window.location.replace('index.html');
        }, 1200);
    });
});
