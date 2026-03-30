// =============================================================================
// adminSettings.js — System Settings Module (Admin Only)
// =============================================================================

import { supabase, can, ROLES, PERMISSIONS } from '../config.js';
import { toast, getActivityLog, logActivity, formatDate } from '../utils.js';

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initSettings(adminRole, adminId, joinedAt) {
  if (!can(adminRole, 'VIEW_SETTINGS')) {
    renderAccessDenied();
    return;
  }

  renderRolePermissionsPanel();
  renderActivityLog();
  renderSystemInfo(joinedAt);
  setupSettingsSave(adminRole, adminId);
}

// ─── Access Denied ────────────────────────────────────────────────────────────
function renderAccessDenied() {
  const settingsSection = document.getElementById('view-settings');
  if (!settingsSection) return;

  settingsSection.innerHTML = `
    <div class="admin-access-denied">
      <span class="material-symbols-outlined">lock</span>
      <h3>Admin Access Required</h3>
      <p>The Settings panel is restricted to Administrators only. Contact your system administrator for access.</p>
    </div>`;
}

// ─── Role Permission Matrix Display ──────────────────────────────────────────
function renderRolePermissionsPanel() {
  const panel = document.getElementById('rolePermissionsPanel');
  if (!panel) return;

  const permissionGroups = {
    'User Management': [
      { key: 'CREATE_USER', label: 'Create Users' },
      { key: 'DELETE_USER', label: 'Delete Users' },
      { key: 'EDIT_ANY_USER', label: 'Edit Any User' },
      { key: 'ASSIGN_ROLES', label: 'Assign Roles' },
      { key: 'VIEW_USERS', label: 'View User List' },
    ],
    'Course Management': [
      { key: 'CREATE_COURSE', label: 'Create Courses' },
      { key: 'DELETE_COURSE', label: 'Delete Courses' },
      { key: 'ASSIGN_INSTRUCTOR', label: 'Assign Instructor' },
      { key: 'ENROLL_STUDENT', label: 'Enroll Students' },
    ],
    'Grade & Attendance': [
      { key: 'EDIT_ANY_GRADE', label: 'Edit Any Grade' },
      { key: 'ADD_GRADE', label: 'Add Grades' },
      { key: 'LOG_ATTENDANCE', label: 'Log Attendance' },
      { key: 'EDIT_ATTENDANCE', label: 'Edit Attendance' },
    ],
    'Announcements': [
      { key: 'CREATE_ANN', label: 'Create Announcements' },
      { key: 'DELETE_ANY_ANN', label: 'Delete Any Announcement' },
      { key: 'ANN_ALL_USERS', label: 'Broadcast to All Users' },
    ],
    'System': [
      { key: 'VIEW_SETTINGS', label: 'Access Settings' },
      { key: 'VIEW_ACTIVITY_LOG', label: 'View Activity Log' },
      { key: 'ADD_PAYMENT', label: 'Add Payment Records' },
    ],
  };

  const roleIcons = { admin: '🔴', teacher: '🟣', student: '🔵' };

  panel.innerHTML = Object.entries(permissionGroups).map(([groupName, perms]) => `
    <div class="admin-perm-group">
      <div class="admin-perm-header">
        <span class="material-symbols-outlined" style="font-size:1rem; color:var(--primary);">security</span>
        ${groupName}
      </div>
      ${perms.map(p => {
        const allowedRoles = PERMISSIONS[p.key] || [];
        return `
          <div class="admin-perm-row">
            <span class="admin-perm-name">${p.label}</span>
            <div class="admin-perm-roles">
              ${[ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT].map(r => {
                const has = allowedRoles.includes(r);
                const labels = { admin: 'Admin', teacher: 'Instructor', student: 'Student' };
                return has ? `<span class="admin-perm-chip ${r}" title="${labels[r]} has this permission">${labels[r]}</span>` : '';
              }).filter(Boolean).join('') || `<span style="color:var(--text-muted); font-size:0.72rem; font-weight:600;">No Role</span>`}
            </div>
          </div>`;
      }).join('')}
    </div>
  `).join('');
}

// ─── Activity Log Display ─────────────────────────────────────────────────────
function renderActivityLog() {
  const container = document.getElementById('adminActivityLog');
  if (!container) return;

  const logs = getActivityLog();

  if (!logs.length) {
    container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); font-size:0.85rem;">No activity logged yet.</div>`;
    return;
  }

  container.innerHTML = logs.map(log => `
    <div class="admin-activity-item">
      <div class="admin-activity-dot"></div>
      <div>
        <div class="admin-activity-text">${log.action}</div>
        <div class="admin-activity-time">${new Date(log.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${log.adminName}</div>
      </div>
    </div>
  `).join('');
}

// ─── System Info ──────────────────────────────────────────────────────────────
function renderSystemInfo(joinedAt) {
  const el = document.getElementById('adminSinceDate');
  if (el) el.textContent = formatDate(joinedAt) || '—';
}

// ─── Settings Save Logic ──────────────────────────────────────────────────────
function setupSettingsSave(adminRole, adminId) {
  const saveBtn = document.getElementById('saveSettingsBtn');
  if (!saveBtn) return;

  // Load saved toggles from localStorage
  const saved = JSON.parse(localStorage.getItem('admin_settings') || '{}');
  if (saved.darkDefault !== undefined) {
    const el = document.getElementById('settingDarkDefault');
    if (el) el.checked = saved.darkDefault;
  }
  if (saved.attWidget !== undefined) {
    const el = document.getElementById('settingAttWidget');
    if (el) el.checked = saved.attWidget;
  }
  if (saved.messaging !== undefined) {
    const el = document.getElementById('settingMessaging');
    if (el) el.checked = saved.messaging;
  }

  saveBtn.addEventListener('click', () => {
    const settings = {
      darkDefault: document.getElementById('settingDarkDefault')?.checked ?? true,
      attWidget: document.getElementById('settingAttWidget')?.checked ?? true,
      messaging: document.getElementById('settingMessaging')?.checked ?? true,
      savedAt: new Date().toISOString(),
      savedBy: adminId,
    };
    localStorage.setItem('admin_settings', JSON.stringify(settings));
    logActivity('Updated system settings');
    toast('Settings saved successfully!', 'success');
  });
}