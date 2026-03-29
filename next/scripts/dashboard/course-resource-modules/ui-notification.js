/**
 * Builds the container for premium toasts if it doesn't exist.
 */
export function buildToastContainer() {
    if (document.querySelector('.toast-container')) return;
    const tc = document.createElement('div');
    tc.className = 'toast-container';
    tc.id = 'toastContainer';
    document.body.appendChild(tc);
}

/**
 * Displays a premium animated toast.
 */
export function showToastPremium(message, type = 'info') {
    const iconMap = { success: 'check_circle', info: 'info', warning: 'warning', error: 'error' };
    const tc = document.getElementById('toastContainer');
    if (!tc) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <span class="material-symbols-outlined">${iconMap[type] || 'info'}</span>
        </div>
        <span>${message}</span>`;
    tc.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 280);
    }, 3200);
}

/**
 * Builds the Floating Action Button for the Resources view.
 */
export function buildFAB() {
    if (document.querySelector('.resources-fab')) return;

    const fab = document.createElement('div');
    fab.className = 'resources-fab';
    fab.innerHTML = `
      <button class="fab-btn" id="resourcesFabBtn" title="Upload a resource">
        <span class="material-symbols-outlined">add</span>
        Upload Resource
      </button>`;
    document.body.appendChild(fab);

    fab.querySelector('#resourcesFabBtn').addEventListener('click', () => {
        showToastPremium('File upload opening...', 'info');
    });
}

export function toggleFAB(visible) {
    const fab = document.querySelector('.resources-fab');
    if (fab) fab.classList.toggle('visible', visible);
}