// =============================================================================
// adminUsers.js — User Management Module (Admin Dashboard)
// RBAC: Admin = full control | Instructor = view only + limited edit
// =============================================================================

import { supabase, can, ROLES } from '../config.js';
import { toast, openModal, closeModal, setupModalClose,
  confirmDelete, paginate, renderPagination,
  filterBySearch, applyRoleUI, formatDate,
  avatarUrl, escapeHtml, logActivity } from '../utils.js';

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

// ─── Init ────────────────────────────────────────────────────────────────────
export async function initUsers(adminRole, adminId) {
  state.currentRole = adminRole;
  state.currentUserId = adminId;

  setupModalClose('userModalOverlay', 'userModalClose', 'userModalCancel');

  // Create user button — admins only
  document.getElementById('createUserBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'CREATE_USER')) {
      toast('Admins only can create users.', 'error'); return;
    }
    openCreateModal();
  });

  // Save user
  document.getElementById('userModalSave')?.addEventListener('click', saveUser);

  // Filters
  document.getElementById('userRoleFilter')?.addEventListener('change', applyFilters);
  document.getElementById('userSearchInput')?.addEventListener('input', applyFilters);

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
    renderUserStats();
  } catch (err) {
    console.error('User load error:', err.message);
    toast('Failed to load users.', 'error');
  }
}

// ─── Filter Logic ─────────────────────────────────────────────────────────────
function applyFilters() {
  const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
  const searchTerm = document.getElementById('userSearchInput')?.value?.trim() || '';

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
}

// ─── Render Table ─────────────────────────────────────────────────────────────
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const paged = paginate(state.filtered, state.page, state.perPage);

  if (paged.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="admin-loading-cell">
      <div class="admin-empty-state" style="padding:40px;">
        <div class="admin-empty-icon">👥</div>
        <h3>No users found</h3>
        <p>Try adjusting your search or filters</p>
      </div></td></tr>`;
    renderPagination('usersPagination', paged, p => { state.page = p; renderUsersTable(); });
    return;
  }

  tbody.innerHTML = paged.items.map((user, idx) => {
    const av = avatarUrl(user.full_name, user.avatar_url);
    const roleBadge = getRoleBadge(user.role);
    const joinDate = formatDate(user.created_at);
    const canEdit = can(state.currentRole, 'EDIT_ANY_USER') ||
      (state.currentRole === ROLES.TEACHER && user.role === ROLES.STUDENT);
    const canDel = can(state.currentRole, 'DELETE_USER');

    return `
      <tr style="animation: slideInRight 0.3s ease forwards ${idx * 0.03}s; opacity:0;">
        <td>
          <div class="admin-user-cell">
            <img src="${av}" class="admin-user-avatar" alt="${escapeHtml(user.full_name)}" onerror="this.src='https://ui-avatars.com/api/?name=U&background=6366f1&color=fff'">
            <div>
              <div class="admin-user-name">${escapeHtml(user.full_name || 'Unnamed')}</div>
              <div class="admin-user-email">${escapeHtml(user.email || '—')}</div>
            </div>
          </div>
        </td>
        <td>${roleBadge}</td>
        <td style="color:var(--text-muted); font-size:0.85rem; font-weight:500;">
          ${escapeHtml(user.course_name || user.course || '—')}
          ${user.section ? `<span style="color:var(--text-muted); font-size:0.75rem;"> · ${escapeHtml(user.section)}</span>` : ''}
        </td>
        <td>
          <span style="display:inline-flex; align-items:center; gap:5px; font-size:0.75rem; font-weight:700; color:var(--accent-green);">
            <span style="width:6px; height:6px; border-radius:50%; background:var(--accent-green);"></span>
            Active
          </span>
        </td>
        <td style="color:var(--text-muted); font-size:0.82rem; font-weight:600;">${joinDate}</td>
        <td>
          <div class="admin-row-actions">
            ${canEdit ? `<button class="admin-icon-btn edit" title="Edit user" onclick="window._adminEditUser('${user.id}')">
              <span class="material-symbols-outlined">edit</span>
            </button>` : ''}
            ${canDel && user.id !== state.currentUserId ? `<button class="admin-icon-btn delete" title="Delete user" onclick="window._adminDeleteUser('${user.id}', '${escapeHtml(user.full_name)}')">
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

  const counts = state.allUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, { total: state.allUsers.length });

  strip.innerHTML = `
    <div class="admin-stat-pill active">
      <span class="admin-stat-pill-num">${state.allUsers.length}</span> Total Users
    </div>
    <div class="admin-stat-pill">
      <span class="admin-stat-pill-num" style="color:#3b82f6;">${counts.student || 0}</span> Students
    </div>
    <div class="admin-stat-pill">
      <span class="admin-stat-pill-num" style="color:#a855f7;">${counts.teacher || 0}</span> Instructors
    </div>
    <div class="admin-stat-pill">
      <span class="admin-stat-pill-num" style="color:#ef4444;">${counts.admin || 0}</span> Admins
    </div>
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