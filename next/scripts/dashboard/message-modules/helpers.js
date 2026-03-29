    // =============================================================================
    // helpers.js — Shared Utilities
    // =============================================================================

    export function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

    export function escapeAttr(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    export function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    let _toastTimer = null;

    export function showToast(msg, type = 'info') {
        document.querySelector('.msg-toast')?.remove();
        if (_toastTimer) clearTimeout(_toastTimer);

        const icons   = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
        const colors  = { success: '#22c55e',       error: '#ef4444', info: '#6366f1', warning: '#f59e0b' };

        const toast   = document.createElement('div');
        toast.className = 'msg-toast';
        toast.innerHTML = `
        <span class="material-symbols-outlined" style="color:${colors[type]};font-size:17px;flex-shrink:0;">${icons[type] || 'info'}</span>
        <span>${msg}</span>`;

        document.body.appendChild(toast);
        _toastTimer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(8px)';
            toast.style.transition = 'all 0.22s ease';
            setTimeout(() => toast.remove(), 230);
        }, 3200);
    }

    export function showIncomingPing(name, content) {
        showToast(`💬 ${name}: ${truncate(content, 38)}`, 'info');
    }

    // ── Auto-resize textarea ──────────────────────────────────────────────────
    export function autoResizeInput(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }

    // ── Close all floating popovers ───────────────────────────────────────────
    export function closeAllPopovers(e, except = null) {
        const ids = ['emojiPickerPortal', 'chatOptionsMenuPortal', 'autocompleteDropdown'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el && el !== except) {
                if (!e || !el.contains(e.target)) {
                    el.classList.remove('show');
                }
            }
        });
    }

    // ── Clear in-thread search highlights ────────────────────────────────────
    export function clearSearchHighlights() {
        document.querySelectorAll('#chatThreadArea .chat-bubble.search-match').forEach(b => {
            b.classList.remove('search-match');
            b.style.outline      = '';
            b.style.outlineOffset = '';
        });
    }

    // ── Inject all messenger CSS modules dynamically ──────────────────────────
    // Call this once during init if you're NOT importing via a master stylesheet.
// ── Inject all messenger CSS modules dynamically ──────────────────────────
export function injectDynamicStyles(baseUrl = '../css/dashboard/message-module/') {
    if (document.getElementById('msg-dynamic-styles')) return;

    // These names must match your .css filenames in the folder EXACTLY
    const modules = [
        'variable', 
        'layout', 
        'sidebar', 
        'thread',
        'input', 
        'popovers', 
        'modals', 
        'announcements',
        'messenger-hub' // Added this since I see it in your screenshot
    ];

    modules.forEach(name => {
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        // Corrected path logic to point to your actual folder
        link.href = `${baseUrl}${name}.css`;
        link.id   = `msg-style-${name}`;
        
        // Debugging: This will show you the path in the console if it fails
        link.onerror = () => console.error(`Failed to load CSS: ${link.href}`);
        
        document.head.appendChild(link);
    });

    // Mark as injected
    const marker = document.createElement('meta');
    marker.id = 'msg-dynamic-styles';
    document.head.appendChild(marker);
    
    console.log("Messenger modules injected from:", baseUrl);
}