// =============================================================================
// adminUsers.js — User Management Module (Admin Dashboard)
// RBAC: Admin = full control | Instructor = view only + limited edit
// =============================================================================

import { supabase, can, ROLES } from '../config.js';
import { toast, openModal, closeModal, setupModalClose,
  confirmDelete, paginate, renderPagination,
  filterBySearch, applyRoleUI, formatDate,
  avatarUrl, escapeHtml, logActivity, debounce } from '../utils.js';

// ─── Module State ───────────────────────────────────────────────────────────
const state = {
  allUsers: [],
  filtered: [],
  page: 1,
  perPage: 15,
  editingId: null,
  currentRole: 'student', // The admin's own role
  currentUserId: null,
};

function getRolePickerParts() {
  const select = document.getElementById('umRole');
  const picker = document.getElementById('umRolePicker');
  const buttons = picker ? Array.from(picker.querySelectorAll('[data-role]')) : [];
  return { select, picker, buttons };
}

function syncRolePicker() {
  const { select, picker, buttons } = getRolePickerParts();
  if (!select || !picker || buttons.length === 0) return;

  const selectedRole = buttons.some(button => button.dataset.role === select.value)
    ? select.value
    : buttons[0].dataset.role;
  const disabled = !!select.disabled;

  picker.classList.toggle('is-disabled', disabled);
  picker.setAttribute('aria-disabled', disabled ? 'true' : 'false');

  buttons.forEach((button, index) => {
    const isActive = button.dataset.role === selectedRole;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-checked', isActive ? 'true' : 'false');
    button.disabled = disabled;
    button.tabIndex = disabled ? -1 : (isActive || (!selectedRole && index === 0) ? 0 : -1);
  });
}

function setupRolePicker() {
  const { select, picker, buttons } = getRolePickerParts();
  if (!select || !picker || buttons.length === 0 || picker.dataset.bound === 'true') return;

  const activateRole = (role) => {
    if (select.disabled || !buttons.some(button => button.dataset.role === role)) return;

    if (select.value !== role) {
      select.value = role;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    syncRolePicker();
  };

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('[data-role]');
    if (!button) return;
    activateRole(button.dataset.role);
  });

  picker.addEventListener('keydown', (event) => {
    if (select.disabled) return;

    const currentIndex = buttons.findIndex(button => button.classList.contains('is-active'));
    let nextIndex = -1;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = currentIndex >= 0 ? (currentIndex + 1) % buttons.length : 0;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = currentIndex >= 0 ? (currentIndex - 1 + buttons.length) % buttons.length : buttons.length - 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = buttons.length - 1;
    } else if (event.key === ' ' || event.key === 'Enter') {
      const button = event.target.closest('[data-role]');
      if (!button) return;
      event.preventDefault();
      activateRole(button.dataset.role);
      return;
    } else {
      return;
    }

    event.preventDefault();
    const target = buttons[nextIndex];
    if (!target) return;
    target.focus();
    activateRole(target.dataset.role);
  });

  select.addEventListener('change', syncRolePicker);
  picker.dataset.bound = 'true';
  syncRolePicker();
}

// ─── Init ────────────────────────────────────────────────────────────────────
export async function initUsers(adminRole, adminId) {
  state.currentRole = adminRole;
  state.currentUserId = adminId;

  setupModalClose('userModalOverlay', 'userModalClose', 'userModalCancel');
  setupRolePicker();

  // Create user button — admins only
  document.getElementById('createUserBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'CREATE_USER')) {
      toast('Admins only can create users.', 'error'); return;
    }
    openCreateModal();
  });

  // Save user
  document.getElementById('userModalSave')?.addEventListener('click', saveUser);
  document.getElementById('userStatsStrip')?.addEventListener('click', (event) => {
    const pill = event.target.closest('[data-role-filter]');
    if (!pill) return;

    const nextRole = pill.getAttribute('data-role-filter') || 'all';
    const roleFilterEl = document.getElementById('userRoleFilter');
    if (roleFilterEl) roleFilterEl.value = nextRole;
    applyFilters();
  });

  // Filters
  const debouncedApplyFilters = debounce(applyFilters, 220);
  document.getElementById('userRoleFilter')?.addEventListener('change', applyFilters);
  document.getElementById('userSearchInput')?.addEventListener('input', debouncedApplyFilters);

  await loadUsers();
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
export async function loadUsers() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    state.allUsers = data || [];
    state.page = 1;
    applyFilters();
  } catch (err) {
    console.error('User load error:', err.message);
    toast('Failed to load users.', 'error');
  }
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────
function applyFilters() {
  const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
  const searchTerm = document.getElementById('userSearchInput')?.value?.trim() || '';
  state.page = 1;

  let filtered = [...state.allUsers];

  // Instructors can only see students (not other admins/instructors)
  if (state.currentRole === ROLES.TEACHER) {
    filtered = filtered.filter(u => u.role === ROLES.STUDENT);
  }

  if (roleFilter !== 'all') {
    filtered = filtered.filter(u => u.role === roleFilter);
  }

  if (searchTerm) {
    filtered = filterBySearch(filtered, searchTerm, ['full_name', 'email', 'section', 'course_name']);
  }

  state.filtered = filtered;
  renderUsersTable();
  renderUserStats();
}

// ─── Render Table ─────────────────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const paged = paginate(state.filtered, state.page, state.perPage);

  if (paged.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-loading-cell">
      <div class="admin-empty-state admin-empty-state-compact">
        <div class="admin-empty-icon">👥</div>
        <h3>No users found</h3>
        <p>Try adjusting your search or filters</p>
      </div></td></tr>`;
    renderPagination('usersPagination', paged, p => { state.page = p; renderUsersTable(); });
    return;
  }

  tbody.innerHTML = paged.items.map((user) => {
    const av = avatarUrl(user.full_name, user.avatar_url);
    const roleBadge = getRoleBadge(user.role);
    const joinDate = formatDate(user.created_at);
    const courseName = escapeHtml(user.course_name || user.course || 'Unassigned');
    const sectionName = escapeHtml(user.section || 'No section assigned');
    const canEdit = can(state.currentRole, 'EDIT_ANY_USER') ||
      (state.currentRole === ROLES.TEACHER && user.role === ROLES.STUDENT);
    const canDel = can(state.currentRole, 'DELETE_USER');

    return `
      <tr>
        <td>
          <div class="admin-user-cell">
            <img src="${av}" class="admin-user-avatar" alt="${escapeHtml(user.full_name)}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'">
            <div>
              <div class="admin-user-name">${escapeHtml(user.full_name || 'Unnamed')}</div>
              <div class="admin-user-email">${escapeHtml(user.email || '--')}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td>
          <div class="admin-users-course">
            <span class="admin-users-course-name">${courseName}</span>
            <span class="admin-users-section">${sectionName}</span>
          </div>
        </td>
        <td><span class="admin-users-status">Active</span></td>
        <td><span class="admin-users-joined">${joinDate}</span></td>
        <td>
          <div class="admin-row-actions">
            ${canEdit ? `<button type="button" class="admin-icon-btn edit" title="Edit user" onclick="window._adminEditUser('${user.id}')">
              <span class="material-symbols-outlined">edit</span>
            </button>` : ''}
            ${canDel && user.id !== state.currentUserId ? `<button type="button" class="admin-icon-btn delete" title="Delete user" onclick="window._adminDeleteUser('${user.id}', '${escapeHtml(user.full_name)}')">
              <span class="material-symbols-outlined">delete</span>
            </button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPagination('usersPagination', paged, p => { state.page = p; renderUsersTable(); });
}

function getRoleBadge(role) {
  const labels = { admin: 'Admin', teacher: 'Instructor', student: 'Student' };
  const label = labels[role] || role;
  return `<span class="admin-role-chip ${role}">${label}</span>`;
}

function renderUserStats() {
  const strip = document.getElementById('userStatsStrip');
  if (!strip) return;
  const activeRole = document.getElementById('userRoleFilter')?.value || 'all';

  const counts = state.allUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, { total: state.allUsers.length });

  strip.innerHTML = `
    <button type="button" class="admin-stat-pill${activeRole === 'all' ? ' active' : ''}" data-role-filter="all" aria-pressed="${activeRole === 'all'}">
      <span class="admin-stat-pill-num">${state.allUsers.length}</span> Total Users
    </button>
    <button type="button" class="admin-stat-pill${activeRole === 'student' ? ' active' : ''}" data-role-filter="student" aria-pressed="${activeRole === 'student'}">
      <span class="admin-stat-pill-num admin-stat-pill-num-student">${counts.student || 0}</span> Students
    </button>
    <button type="button" class="admin-stat-pill${activeRole === 'teacher' ? ' active' : ''}" data-role-filter="teacher" aria-pressed="${activeRole === 'teacher'}">
      <span class="admin-stat-pill-num admin-stat-pill-num-teacher">${counts.teacher || 0}</span> Instructors
    </button>
    <button type="button" class="admin-stat-pill${activeRole === 'admin' ? ' active' : ''}" data-role-filter="admin" aria-pressed="${activeRole === 'admin'}">
      <span class="admin-stat-pill-num admin-stat-pill-num-admin">${counts.admin || 0}</span> Admins
    </button>
  `;
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function openCreateModal() {
  state.editingId = null;
  document.getElementById('userModalTitle').textContent = 'Add New User';
  document.getElementById('userModalForm').reset();
  document.getElementById('umPasswordGroup').style.display = 'block'; // Show for new users

  // Admins can assign any role; instructors cannot create users (guarded above)
  const roleSelect = document.getElementById('umRole');
  if (roleSelect && state.currentRole !== ROLES.ADMIN) {
    roleSelect.value = 'student';
    roleSelect.disabled = true;
  } else if (roleSelect) {
    roleSelect.disabled = false;
  }

  syncRolePicker();
  openModal('userModalOverlay');
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
window._adminEditUser = function (userId) {
  const user = state.allUsers.find(u => u.id === userId);
  if (!user) return;

  // Instructors can only edit students, not other roles
  if (state.currentRole === ROLES.TEACHER && user.role !== ROLES.STUDENT) {
    toast('Instructors can only edit student profiles.', 'error');
    return;
  }

  state.editingId = userId;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('umPasswordGroup').style.display = 'none'; // Don't show password when editing

  document.getElementById('umFullName').value = user.full_name || '';
  document.getElementById('umEmail').value = user.email || '';
  document.getElementById('umSection').value = user.section || '';
  document.getElementById('umCourse').value = user.course_name || user.course || '';
  document.getElementById('umBio').value = user.bio || '';

  const roleSelect = document.getElementById('umRole');
  if (roleSelect) {
    roleSelect.value = user.role || 'student';
    // Only admins can change roles
    roleSelect.disabled = !can(state.currentRole, 'ASSIGN_ROLES');
  }

  syncRolePicker();
  openModal('userModalOverlay');
};

// ─── Save User ────────────────────────────────────────────────────────────────
async function saveUser() {
  const btn = document.getElementById('userModalSave');
  const fullName = document.getElementById('umFullName')?.value.trim();
  const email = document.getElementById('umEmail')?.value.trim();
  const role = document.getElementById('umRole')?.value;
  const section = document.getElementById('umSection')?.value.trim();
  const course = document.getElementById('umCourse')?.value.trim();
  const bio = document.getElementById('umBio')?.value.trim();

  if (!fullName || !email) { toast('Name and email are required.', 'error'); return; }

  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    if (state.editingId) {
      // UPDATE existing user profile
      const updatePayload = {
        full_name: fullName,
        bio,
        section,
        course_name: course,
      };

      // Only admins can change roles
      if (can(state.currentRole, 'ASSIGN_ROLES')) {
        updatePayload.role = role;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', state.editingId);

      if (error) throw error;
      toast('User updated successfully!', 'success');
      logActivity(`Edited user: ${fullName}`);
    } else {
      // CREATE new user via Supabase Auth (admin only, guarded above)
      const password = document.getElementById('umPassword')?.value;
      if (!password || password.length < 6) {
        toast('Password must be at least 6 characters.', 'error');
        btn.textContent = 'Save User'; btn.disabled = false;
        return;
      }

      // NOTE: Creating users via client SDK requires the service_role key in production.
      // For now, we insert directly into profiles after auth signup.
      // In production, use a Supabase Edge Function with service_role key.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            full_name: fullName,
            email,
            role,
            section,
            course_name: course,
            bio,
          });
        if (profileError) throw profileError;
      }

      toast('User created! They will receive a confirmation email.', 'success');
      logActivity(`Created user: ${fullName} (${role})`);
    }

    closeModal('userModalOverlay');
    await loadUsers();
  } catch (err) {
    console.error('Save user error:', err.message);
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save User';
    btn.disabled = false;
  }
}

// ─── Delete User ──────────────────────────────────────────────────────────────
window._adminDeleteUser = async function (userId, userName) {
  if (!can(state.currentRole, 'DELETE_USER')) {
    toast('Only admins can delete users.', 'error'); return;
  }

  const confirmed = await confirmDelete(
    'Delete User Account',
    `Are you sure you want to permanently delete "${userName}"? This will remove all their data and cannot be undone.`
  );
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    toast(`"${userName}" has been deleted.`, 'success');
    logActivity(`Deleted user: ${userName}`);
    await loadUsers();
  } catch (err) {
    console.error('Delete error:', err.message);
    toast(`Delete failed: ${err.message}`, 'error');
  }
};

// ─── Export for Overview KPIs ─────────────────────────────────────────────────
export function getUserStats() {
  return {
    total: state.allUsers.length,
    students: state.allUsers.filter(u => u.role === ROLES.STUDENT).length,
    instructors: state.allUsers.filter(u => u.role === ROLES.TEACHER).length,
    admins: state.allUsers.filter(u => u.role === ROLES.ADMIN).length,
    all: state.allUsers,
  };
}
