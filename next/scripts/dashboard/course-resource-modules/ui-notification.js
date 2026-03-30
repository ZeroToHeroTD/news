/**
 * Injects the invisible container that holds the toast notifications.
 */
export function buildToastContainer() {
    if (document.querySelector('.toast-container')) return;
    
    const tc = document.createElement('div');
    tc.className = 'toast-container';
    tc.id = 'toastContainer';
    document.body.appendChild(tc);
}

/**
 * The core function that generates and animates the premium toast.
 * Includes aggressive cleanup to prevent overlapping/duplicate toasts.
 */
export function showToastPremium(message, type = 'info') {
    // 1. Aggressive Cleanup: Destroy any existing toasts on the screen to prevent stacking bugs
    document.querySelectorAll('.toast, .msg-toast').forEach(t => t.remove());

    const tc = document.getElementById('toastContainer');
    if (!tc) {
        console.warn('Toast container missing. Falling back to alert.');
        alert(message);
        return;
    }

    const iconMap = { 
        success: 'check_circle', 
        info: 'info', 
        warning: 'warning', 
        error: 'error' 
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <span class="material-symbols-outlined">${iconMap[type] || 'info'}</span>
        </div>
        <span>${message}</span>
    `;
    
    tc.appendChild(toast);

    // 2. Animate out and remove from the DOM after 3.2 seconds
    setTimeout(() => { 
        toast.classList.add('exit'); 
        setTimeout(() => toast.remove(), 280); 
    }, 3200);
}

/**
 * Bootstraps the toast system and forces the whole app to use this new premium version.
 */
export function initToasts() {
    buildToastContainer();
    
    // Override the global window function so all old legacy code uses the new UI!
    window.showToast = showToastPremium;
}