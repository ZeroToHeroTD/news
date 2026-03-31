// =============================================================================
// admin/utils.js — Shared Utilities (Admin Dashboard)
// =============================================================================

import { can } from './config.js';

// =============================================================================
// 1. TOAST NOTIFICATION SYSTEM
// =============================================================================
let _toastTimer = null;

export function toast(message, type = 'info') {
  // Clean up old toasts
  document.querySelectorAll('.toast, .msg-toast, #admin-toast').forEach(t => t.remove());
  if (_toastTimer) clearTimeout(_toastTimer);

  const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
  const colors = { success: 'var(--accent-green)', error: 'var(--accent-red)', info: 'var(--primary)', warning: 'var(--accent-amber)' };

  const el = document.createElement('div');
  el.id = 'admin-toast';
  el.style.cssText = `
    position:fixed; bottom:30px; right:30px; z-index:99999;
    display:flex; align-items:center; gap:12px;
    padding:14px 20px; border-radius:14px;
    background:var(--card-bg); color:var(--text-main);
    border:1px solid var(--border-color);
    border-left: 4px solid ${colors[type]};
    box-shadow:var(--shadow-lg);
    font-size:0.88rem; font-weight:600;
    font-family:'Inter',sans-serif;
    animation: slideInRight 0.35s cubic-bezier(0.16,1,0.3,1);
    max-width:380px;
  `;
  el.innerHTML = `
    <span class="material-symbols-outlined" style="color:${colors[type]};font-size:1.1rem;flex-shrink:0;">${icons[type]}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(el);

  _toastTimer = setTimeout(() => {
    el.style.transition = 'all 0.3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// =============================================================================
// 2. MODAL SYSTEM
// =============================================================================

const modalCloseTimers = new WeakMap();
const modalFocusReturn = new WeakMap();
let modalHistoryDepth = 0;

function getVisibleModalOverlays() {
  return [...document.querySelectorAll('.compose-modal-overlay')].filter(overlay =>
    overlay.classList.contains('active') || overlay.style.display === 'flex'
  );
}

function getTopVisibleModal() {
  const visible = getVisibleModalOverlays();
  return visible[visible.length - 1] || null;
}

function getFocusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

function syncModalHistoryState() {
  const hasOpenModal = getVisibleModalOverlays().length > 0;
  const currentState = window.history.state || {};

  if (hasOpenModal && !currentState.__adminModalOpen) {
    window.history.pushState({ ...currentState, __adminModalOpen: true }, '');
    modalHistoryDepth += 1;
  } else if (!hasOpenModal && currentState.__adminModalOpen && modalHistoryDepth > 0) {
    modalHistoryDepth -= 1;
    window.history.back();
  }
}

function clearModalCloseTimer(overlay) {
  const timer = modalCloseTimers.get(overlay);
  if (timer) {
    clearTimeout(timer);
    modalCloseTimers.delete(overlay);
  }
}

export function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    modalFocusReturn.set(overlay, document.activeElement);
    clearModalCloseTimer(overlay);
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      overlay.classList.add('active');
      syncModalHistoryState();
      const focusables = getFocusableElements(overlay);
      focusables[0]?.focus();
    });
  }
}

export function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    clearModalCloseTimer(overlay);
    overlay.classList.remove('active');
    overlay.style.pointerEvents = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    const closeTimer = setTimeout(() => {
      if (overlay.getAttribute('aria-hidden') === 'true' && !overlay.classList.contains('active')) {
        overlay.style.display = 'none';
        overlay.style.pointerEvents = '';
      }
      syncModalHistoryState();
      const returnTarget = modalFocusReturn.get(overlay);
      if (returnTarget && typeof returnTarget.focus === 'function') {
        returnTarget.focus();
      }
      modalFocusReturn.delete(overlay);
      modalCloseTimers.delete(overlay);
    }, 220);
    modalCloseTimers.set(overlay, closeTimer);
  }
}

export function initAdminUIComponents(root = document) {
  root.querySelectorAll('select').forEach(select => {
    if (select.dataset.uiSkipWrap === 'true') return;

    select.classList.add('ui-select-input');
    if (!select.closest('.ui-select')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'ui-select';
      select.parentNode?.insertBefore(wrapper, select);
      wrapper.appendChild(select);
    }
  });

  root.querySelectorAll('.compose-modal-overlay').forEach(overlay => {
    overlay.classList.add('ui-modal-overlay');
    if (!overlay.classList.contains('active')) {
      overlay.style.display = 'none';
      overlay.style.pointerEvents = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
  });

  root.querySelectorAll('.admin-modal').forEach(modal => {
    modal.classList.add('ui-modal');
  });

  root.querySelectorAll('.compose-modal-header').forEach(header => {
    header.classList.add('ui-modal-header');
  });

  root.querySelectorAll('.compose-modal-actions').forEach(footer => {
    footer.classList.add('ui-modal-footer');
  });

  root.querySelectorAll('.modal-scroll-area, .admin-modal form').forEach(body => {
    body.classList.add('ui-modal-body');
  });

  root.querySelectorAll('.table-scroll-wrapper').forEach(shell => {
    shell.classList.add('ui-table-shell');
  });

  root.querySelectorAll('.admin-table').forEach(table => {
    table.classList.add('ui-table');
  });

  root.querySelectorAll('.admin-toggle').forEach(toggle => {
    toggle.classList.add('ui-toggle');
    toggle.querySelector('input')?.classList.add('ui-toggle-input');
    toggle.querySelector('.admin-toggle-track')?.classList.add('ui-toggle-control');
  });

  root.querySelectorAll('.admin-btn, .btn-send, .btn-cancel, .modal-close-btn, .admin-text-btn, .admin-page-btn').forEach(button => {
    button.classList.add('ui-button');
  });

  root.querySelectorAll('.admin-btn-primary, .btn-send').forEach(button => {
    button.classList.add('ui-button-primary');
  });

  root.querySelectorAll('.admin-btn-secondary, .btn-cancel, .admin-page-btn').forEach(button => {
    button.classList.add('ui-button-secondary');
  });

  root.querySelectorAll('.admin-btn-danger').forEach(button => {
    button.classList.add('ui-button-danger');
  });

  root.querySelectorAll('.modal-close-btn').forEach(button => {
    button.classList.add('ui-button-icon');
  });

  root.querySelectorAll('.admin-text-btn').forEach(button => {
    button.classList.add('ui-button-ghost');
  });
}



// =============================================================================
// 3. CONFIRM DELETE DIALOG
// =============================================================================

export function confirmDelete(title, message) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmDeleteOverlay');
    const titleEl = document.getElementById('deleteConfirmTitle');
    const msgEl = document.getElementById('deleteConfirmMsg');
    const okBtn = document.getElementById('deleteConfirmOk');
    const cancelBtn = document.getElementById('deleteConfirmCancel');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;

    openModal('confirmDeleteOverlay');

    let settled = false;

    const cleanup = (result) => {
      if (settled) return;
      settled = true;
      closeModal('confirmDeleteOverlay');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay?.removeEventListener('click', onBg);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBg = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay?.addEventListener('click', onBg);
  });
}

// =============================================================================
// 4. PAGINATION ENGINE
// =============================================================================

export function paginate(items, page, perPage = 15) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: safePage,
    totalPages,
    total,
    start: start + 1,
    end: Math.min(start + perPage, total)
  };
}

export function renderPagination(containerId, paginationData, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { page, totalPages, start, end, total } = paginationData;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  container.innerHTML = `
    <span class="admin-pagination-info">Showing ${start}–${end} of ${total} records</span>
    <div class="admin-pagination-btns">
      <button class="admin-page-btn" ${page <= 1 ? 'disabled' : ''} data-p="${page - 1}">
        <span class="material-symbols-outlined" style="font-size:1rem;">chevron_left</span>
      </button>
      ${pages.map(p => p === '...'
        ? `<button class="admin-page-btn" disabled style="cursor:default;">…</button>`
        : `<button class="admin-page-btn ${p === page ? 'active' : ''}" data-p="${p}">${p}</button>`
      ).join('')}
      <button class="admin-page-btn" ${page >= totalPages ? 'disabled' : ''} data-p="${page + 1}">
        <span class="material-symbols-outlined" style="font-size:1rem;">chevron_right</span>
      </button>
    </div>
  `;

  container.querySelectorAll('.admin-page-btn[data-p]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.p);
      if (!isNaN(p)) onPageChange(p);
    });
  });
}

// =============================================================================
// 5. TABLE SEARCH FILTER
// =============================================================================

// Keep this one!
export function normalizeSearchTerm(term) {
  return String(term || '').trim().toLowerCase();
}

export function filterBySearch(items, term, keys = []) {
  const normalizedTerm = normalizeSearchTerm(term);
  if (!normalizedTerm) return items;

  return items.filter(item => {
    const idMatches = ['id', 'student_id', 'course_id', 'payment_id']
      .some(key => item?.[key] && String(item[key]).toLowerCase().includes(normalizedTerm));

    if (idMatches) return true;

    return keys.some(key => {
      const val = key.includes('.') ? getNestedValue(item, key) : item?.[key];
      return val && String(val).toLowerCase().includes(normalizedTerm);
    });
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// =============================================================================
// 6. ROLE-BASED UI ENFORCEMENT
// =============================================================================

/**
 * Hide/disable UI elements based on role.
 * Elements with data-admin-only are hidden for non-admins.
 * Elements with data-perm="PERMISSION_KEY" are checked against RBAC.
 */
export function applyRoleUI(role) {
  // Hide admin-only elements for non-admins
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    if (role !== 'admin') {
      el.style.display = 'none';
      el.setAttribute('disabled', 'true');
    }
  });

  // Dynamic permission-based elements
  document.querySelectorAll('[data-perm]').forEach(el => {
    const perm = el.getAttribute('data-perm');
    if (!can(role, perm)) {
      el.style.display = 'none';
    }
  });

  // Show settings nav only for admins
  const settingsNavItem = document.querySelector('[data-target="view-settings"]');
  if (settingsNavItem && role !== 'admin') {
    settingsNavItem.closest('li')?.style && (settingsNavItem.closest('li').style.display = 'none');
  }

  // Update the role badge in sidebar
  const roleBadge = document.getElementById('roleDisplayBadge');
  const roleColors = { admin: '#ef4444', teacher: '#a855f7', student: '#3b82f6' };
  if (roleBadge) {
    roleBadge.textContent = role === 'teacher' ? 'Instructor' : role.charAt(0).toUpperCase() + role.slice(1);
    roleBadge.style.color = roleColors[role] || 'var(--primary)';
    roleBadge.closest('.admin-role-badge')?.style && (
      roleBadge.closest('.admin-role-badge').style.background = `${roleColors[role]}1a`,
      roleBadge.closest('.admin-role-badge').style.borderColor = `${roleColors[role]}33`
    );
  }
}

// =============================================================================
// 7. GENERIC HELPERS
// =============================================================================

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCurrency(num) {
  return `₱${parseFloat(num || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export function getTimeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function avatarUrl(name, url) {
  return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=0062ff&color=fff&bold=true`;
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * Log an admin action to localStorage activity log.
 * In production, this should write to a Supabase audit table.
 */
export function logActivity(action, adminName = 'Admin') {
  const logs = JSON.parse(localStorage.getItem('admin_activity_log') || '[]');
  logs.unshift({ action, adminName, ts: new Date().toISOString() });
  if (logs.length > 50) logs.pop(); // Keep last 50
  localStorage.setItem('admin_activity_log', JSON.stringify(logs));
}

export function getActivityLog() {
  return JSON.parse(localStorage.getItem('admin_activity_log') || '[]');
}

// Chart.js shared theme factory
export function getChartTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  return {
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    text: isDark ? '#94a3b8' : '#64748b',
    bg: isDark ? '#1e293b' : '#ffffff',
    primary: '#0062ff',
    red: '#ef4444',
    green: '#22c55e',
    amber: '#f59e0b',
    purple: '#a855f7',
  };
}

export function getPHNumericalGrade(avg) {
  if (avg >= 97) return 1.00;
  if (avg >= 94) return 1.25;
  if (avg >= 91) return 1.50;
  if (avg >= 88) return 1.75;
  if (avg >= 85) return 2.00;
  if (avg >= 82) return 2.25;
  if (avg >= 79) return 2.50;
  if (avg >= 76) return 2.75;
  if (avg >= 75) return 3.00;
  return 5.00;
}

export function updateGwaComparison(currentGwa) {
  const el = document.getElementById('gwaComparison');
  if (!el) return;
  const target = parseFloat(document.getElementById('targetGwaInput')?.value);
  if (!target || isNaN(target)) { el.textContent = ''; return; }
  const diff = parseFloat((currentGwa - target).toFixed(2));
  const improved = diff < 0;
  const same = diff === 0;
  const color = same ? 'var(--text-muted)' : improved ? 'var(--accent-green)' : 'var(--accent-red)';
  const label = same ? 'On target' : improved ? `${Math.abs(diff)} above target` : `${diff} below target`;
  el.innerHTML = `<span style="color:${color}; font-weight:700;">${label}</span>`;
}

// =============================================================================
// ENHANCED UTILITIES (Add to utils.js)
// =============================================================================

// 1. Debounce for Search Performance
// =============================================================================
// ENHANCED UTILITIES (Add to utils.js)
// =============================================================================

// 1. Debounce for Search Performance
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}



// 3. Upgraded Modal Behavior (ESC Key + Outside Click)
export function setupModalClose(overlayId, closeBtnId, cancelBtnId) {
  const overlay = document.getElementById(overlayId);
  const closeBtn = document.getElementById(closeBtnId);
  const cancelBtn = document.getElementById(cancelBtnId);
  if (!overlay) return;

  if (overlay.dataset.modalCloseBound === 'true') return;
  overlay.dataset.modalCloseBound = 'true';

  const closeHandler = () => {
    closeModal(overlayId);
  };

  if (closeBtn) closeBtn.addEventListener('click', closeHandler);
  if (cancelBtn) cancelBtn.addEventListener('click', closeHandler);

  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeHandler();
  });

  document.addEventListener('keydown', (e) => {
    const isVisible = overlay.classList.contains('active') || overlay.style.display === 'flex';
    if (e.key === 'Escape' && isVisible) {
      closeHandler();
      return;
    }

    if (e.key === 'Tab' && isVisible && getTopVisibleModal() === overlay) {
      const focusables = getFocusableElements(overlay);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

window.addEventListener('popstate', () => {
  const topModal = getTopVisibleModal();
  if (topModal) {
    topModal.classList.remove('active');
    topModal.style.pointerEvents = 'none';
    topModal.setAttribute('aria-hidden', 'true');
    topModal.style.display = 'none';
    const returnTarget = modalFocusReturn.get(topModal);
    if (returnTarget && typeof returnTarget.focus === 'function') {
      returnTarget.focus();
    }
    modalFocusReturn.delete(topModal);
    return;
  }
});
