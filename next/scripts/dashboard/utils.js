export function showToast(message, type = 'info') {
    const existing = document.getElementById('toast-notif');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'toast-notif';
    const colors = { success: '#10b981', error: '#ef4444', info: '#0062ff', warning: '#f59e0b' };
    toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${colors[type]};color:white;padding:14px 22px;border-radius:14px;font-weight:700;font-size:0.88rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:slideInRight 0.3s ease;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
}

export function escapeAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}

export function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function getPHNumericalGrade(percentage) {
    if (percentage >= 97) return 1.00; if (percentage >= 94) return 1.25; if (percentage >= 91) return 1.50;
    if (percentage >= 88) return 1.75; if (percentage >= 85) return 2.00; if (percentage >= 82) return 2.25;
    if (percentage >= 79) return 2.50; if (percentage >= 76) return 2.75; if (percentage >= 75) return 3.00;
    return 5.00;
}

export function updateGwaComparison(currentGwa) {
    const targetEl = document.getElementById('targetGwaDisplay');
    const targetVal = parseFloat(targetEl?.textContent);
    const comparisonEl = document.getElementById('gwaComparison');
    if (!comparisonEl || isNaN(targetVal)) return;

    if (currentGwa <= targetVal) {
        comparisonEl.textContent = `✓ On track! (${(targetVal - currentGwa).toFixed(2)} below target)`;
        comparisonEl.style.color = 'var(--accent-green)';
    } else {
        comparisonEl.textContent = `↑ Need ${(currentGwa - targetVal).toFixed(2)} more improvement`;
        comparisonEl.style.color = 'var(--accent-amber)';
    }
}