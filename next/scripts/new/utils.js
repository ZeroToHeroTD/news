// =============================================================================
// utils.js — Global Utilities, Formatting & Notifications (Premium SaaS)
// =============================================================================

// ==========================================
// 1. NOTIFICATION SYSTEM (TOAST)
// ==========================================

/**
 * Displays a non-blocking notification.
 * Styles are handled via CSS classes (.toast), augmented dynamically by JS tokens.
 */
export function showToast(message, type = 'info') {
    // Remove existing to prevent stacking bugs
    const existing = document.getElementById('toast-notif');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notif';
    
    // Icons mapped to Material Symbols
    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    
    // Map types directly to the Premium SaaS tokens from base.css
    const colorTokens = {
        success: 'var(--accent-green)',
        error: 'var(--accent-red)',
        info: 'var(--primary)',
        warning: 'var(--accent-amber)'
    };
    
    const themeColor = colorTokens[type] || colorTokens.info;

    // Apply classes for CSS styling, inject custom property for the glow/border
    toast.className = `toast toast-${type}`;
    toast.style.setProperty('--toast-theme-color', themeColor);
    
    // Premium flex layout for perfect icon-to-text alignment
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--card-bg); border: 1px solid var(--border-color); border-left: 4px solid ${themeColor}; border-radius: 16px; box-shadow: var(--shadow-lg); animation: modalSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
            <span class="material-symbols-outlined" style="color: ${themeColor}; font-size: 1.2rem;">${icons[type] || icons.info}</span>
            <span class="toast-text" style="color: var(--text-main); font-size: 0.9rem; font-weight: 600;">${message}</span>
        </div>
    `;
    
    // Fixed positioning for the dynamic toast container
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '30px';
    toast.style.zIndex = '9999';
    toast.style.cursor = 'pointer';
    toast.style.transition = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

    toast.onclick = () => dismissToast(toast);
    document.body.appendChild(toast);

    // Auto-dismiss logic
    setTimeout(() => dismissToast(toast), 3500);
}

function dismissToast(el) {
    if (!el) return;
    // Premium exit animation
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px) scale(0.95)';
    setTimeout(() => el.remove(), 400);
}

// Expose to window so inline onclick handlers in HTML/JS template literals can trigger it
window.showToast = showToast;

// ==========================================
// 2. DATA FORMATTING & SANITIZATION
// ==========================================

export function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/'/g, "&#39;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, ' ')
        .trim();
}

export function getTimeAgo(dateStr) {
    if (!dateStr) return 'Unknown date';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';

    const diff = Date.now() - date.getTime();
    
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);

    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24)  return `${hrs}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7)  return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==========================================
// 3. ACADEMIC CALCULATIONS (PH SYSTEM)
// ==========================================

const GRADE_SCALE = [
    { min: 97, grade: 1.00 }, { min: 94, grade: 1.25 },
    { min: 91, grade: 1.50 }, { min: 88, grade: 1.75 },
    { min: 85, grade: 2.00 }, { min: 82, grade: 2.25 },
    { min: 79, grade: 2.50 }, { min: 76, grade: 2.75 },
    { min: 75, grade: 3.00 }
];

export function getPHNumericalGrade(percentage) {
    const match = GRADE_SCALE.find(s => percentage >= s.min);
    return match ? match.grade : 5.00; // 5.00 is failing
}

/**
 * Logic-only: Compares current GWA against target
 */
const getGwaPerformance = (current, target) => {
    const diff = (current - target).toFixed(2);
    const isAhead = current <= target; // In PH, lower is better (1.0 is excellent)
    
    return {
        isAhead,
        diff: Math.abs(diff).toFixed(2), // Ensure clean formatting
        colorToken: isAhead ? 'var(--accent-green)' : 'var(--accent-amber)', // Upgraded to tokens
        icon: isAhead ? 'verified' : 'trending_up'
    };
};

/**
 * UI-only: Updates the Comparison display
 */
export function updateGwaComparison(currentGwa) {
    const displayEl = document.getElementById('targetGwaDisplay');
    const container = document.getElementById('gwaComparison');
    const targetVal = parseFloat(displayEl?.textContent);
    
    if (!container || isNaN(targetVal)) {
        if (container) container.innerHTML = ''; // Clear if no target is set
        return;
    }

    const perf = getGwaPerformance(currentGwa, targetVal);

    // Apply styling via JS to guarantee token mapping rather than relying on undefined utility classes
    container.style.color = perf.colorToken;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.gap = '6px';
    container.style.marginTop = '15px';
    container.style.fontWeight = '700';
    container.style.fontSize = '0.85rem';

    container.innerHTML = `
        <span class="material-symbols-outlined" style="font-size: 1.1rem;">${perf.icon}</span>
        <span>${perf.isAhead 
            ? `On track! (${perf.diff} better than target)` 
            : `${perf.diff} point(s) away from target`}
        </span>
    `;
}