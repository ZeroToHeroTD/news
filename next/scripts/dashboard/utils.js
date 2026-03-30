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

export function openModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('active'));
  }
}

export function closeModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => { overlay.style.display = ''; }, 200);
  }
}

export function setupModalClose(overlayId, ...closeBtnIds) {
  const overlay = document.getElementById(overlayId);
  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlayId); });
  }
  closeBtnIds.forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => closeModal(overlayId));
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

    const cleanup = (result) => {
      closeModal('confirmDeleteOverlay');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };

    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    document.getElementById('confirmDeleteOverlay')?.addEventListener('click', function onBg(e) {
      if (e.target === this) { cleanup(false); this.removeEventListener('click', onBg); }
    });
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

export function filterBySearch(items, term, fields) {
  if (!term) return items;
  const lower = term.toLowerCase();
  return items.filter(item =>
    fields.some(f => {
      const val = getNestedValue(item, f);
      return val && String(val).toLowerCase().includes(lower);
    })
  );
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