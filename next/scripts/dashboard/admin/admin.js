// =============================================================================
// admin.js — Admin Dashboard Master Orchestrator
// Orchestrates all modules, enforces auth, applies RBAC.
// =============================================================================

import { supabase, can, ROLES } from './config.js';
import { toast, applyRoleUI, logActivity, avatarUrl } from './utils.js';

// Module imports
import { initUsers, loadUsers, getUserStats } from './modules/adminUsers.js';
import { initCourses, loadCourses, getCourseStats } from './modules/adminCourses.js';
import { initAnalytics } from './modules/adminAnalytics.js';
import { initAnnouncements, loadAnnouncements } from './modules/adminAnnouncements.js';
import { initSettings } from './modules/adminSettings.js';

// ─── Module-level state ───────────────────────────────────────────────────────
let adminUser = null;
let adminProfile = null;
let currentView = 'view-overview';

// =============================================================================
// BOOT — Auth Guard → Profile Load → Module Init
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // ── 1. Authenticate ──────────────────────────────────────────────────────
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    window.location.replace('../../next/html/index.html');
    return;
  }

  adminUser = session.user;

  // ── 2. Load profile and verify role ──────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();

  if (profileError || !profile) {
    toast('Failed to load admin profile.', 'error');
    setTimeout(() => window.location.replace('../../next/html/index.html'), 2000);
    return;
  }

  adminProfile = profile;
  const role = profile.role || ROLES.STUDENT;

  // Block students from accessing admin dashboard entirely
  if (role === ROLES.STUDENT) {
    document.body.innerHTML = `
      <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg-body, #e8edf5); font-family:'Inter',sans-serif;">
        <div style="text-align:center; padding:40px; background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,0.1); max-width:400px;">
          <span style="font-size:3rem;">🔒</span>
          <h2 style="margin:16px 0 8px; color:#1e293b;">Access Denied</h2>
          <p style="color:#64748b; margin-bottom:24px;">You don't have permission to access the Admin Dashboard.</p>
          <a href="../../next/html/dashboard.html" style="display:inline-flex; align-items:center; gap:8px; padding:12px 24px; background:#0062ff; color:#fff; border-radius:12px; font-weight:700; text-decoration:none;">← Back to Student Portal</a>
        </div>
      </div>`;
    return;
  }

  // ── 3. Update Identity UI ─────────────────────────────────────────────────
  const fullName = profile.full_name || adminUser.email?.split('@')[0] || 'Admin';
  const av = avatarUrl(fullName, profile.avatar_url);

  ['adminSidebarAvatar', 'adminNavAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.src = av; el.onerror = () => { el.src = avatarUrl(fullName); }; }
  });

  document.getElementById('adminSidebarName').textContent = fullName;
  document.getElementById('adminTopbarName').textContent = fullName;
  document.getElementById('adminSidebarRole').textContent = role === ROLES.TEACHER ? 'Instructor' : 'Administrator';
  document.getElementById('adminWelcomeMsg').textContent = `Welcome back, ${fullName.split(' ')[0]}!`;
  document.getElementById('adminCurrentDate').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // ── 4. Apply RBAC UI ──────────────────────────────────────────────────────
  applyRoleUI(role);

  // ── 5. Theme ──────────────────────────────────────────────────────────────
  const themeBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.body.classList.remove('dark-mode');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  } else {
    document.body.classList.add('dark-mode');
    if (themeIcon) themeIcon.textContent = 'dark_mode';
  }
  themeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    if (themeIcon) themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });

  // ── 6. Navigation ─────────────────────────────────────────────────────────
  const sidebar = document.querySelector('.app-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('active');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  });

  document.addEventListener('click', e => {
    const target = e.target.closest('[data-target]');
    if (target) {
      e.preventDefault();
      const viewId = target.getAttribute('data-target');
      switchView(viewId, role, adminUser.id, fullName);
      sidebar?.classList.remove('open');
      overlay?.classList.remove('active');
    }
  });

  // ── 7. Global Search ──────────────────────────────────────────────────────
  let searchDebounce;
  document.getElementById('adminGlobalSearch')?.addEventListener('input', e => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => globalSearch(e.target.value, role), 250);
  });

  // ── 8. Logout ─────────────────────────────────────────────────────────────
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('../../next/html/index.html');
  });

  // ── 9. Initialize all modules in parallel ─────────────────────────────────
  await initializeAllModules(role, adminUser.id, fullName, profile.created_at);

  // ── 10. Log session start ─────────────────────────────────────────────────
  logActivity(`Admin session started`, fullName);
});

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================
async function initializeAllModules(role, userId, userName, joinedAt) {
  await Promise.all([
    initUsers(role, userId),
    initCourses(role, userId),
    initAnnouncements(role, userId, userName),
    initGrades(role, userId),
    initAttendance(role, userId),
    initPayments(role, userId),
    initSettings(role, userId, joinedAt),
  ]);

  // Analytics needs user stats from the users module
  const userStats = getUserStats();
  await initAnalytics(userStats);
}

// =============================================================================
// VIEW SWITCHING
// =============================================================================
function switchView(targetId, role, userId, userName) {
  if (role !== ROLES.ADMIN && targetId === 'view-settings') {
    toast('Settings is restricted to Administrators.', 'error'); return;
  }

  currentView = targetId;
  document.querySelectorAll('.view-content').forEach(v => {
    v.classList.toggle('active', v.id === targetId);
  });

  document.querySelectorAll('.nav-links li').forEach(li => {
    const a = li.querySelector('a');
    if (a) li.classList.toggle('active', a.getAttribute('data-target') === targetId);
  });

  document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// GLOBAL SEARCH (cross-module)
// =============================================================================
function globalSearch(term, role) {
  if (!term || term.length < 2) return;

  const lowerTerm = term.toLowerCase();

  // Search user names in the users table if visible
  document.querySelectorAll('#usersTableBody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(lowerTerm) ? '' : 'none';
  });

  // Search course cards
  document.querySelectorAll('.course-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(lowerTerm) ? '' : 'none';
  });

  // Search announcement cards
  document.querySelectorAll('.admin-ann-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(lowerTerm) ? '' : 'none';
  });
}

// =============================================================================
// GRADES MODULE (inline, uses existing patterns)
// =============================================================================
async function initGrades(adminRole, adminId) {
  await loadGrades(adminRole, adminId);

  setupModalClose_inline('gradeModalOverlay', 'gradeModalClose', 'gradeModalCancel');

  document.getElementById('addGradeBtn')?.addEventListener('click', () => openGradeModal(null, adminRole));
  document.getElementById('gradeModalSave')?.addEventListener('click', () => saveGrade(adminRole, adminId));

  document.getElementById('gradesStudentFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));
  document.getElementById('gradesCourseFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));

  document.getElementById('exportGradesBtn')?.addEventListener('click', exportGradesCsv);
}

async function loadGrades(adminRole, adminId) {
  const tbody = document.getElementById('gradesTableBody');
  if (!tbody) return;

  try {
    let query = supabase.from('student_grades').select('*').order('created_at', { ascending: false });

    // Instructors see only grades for their students/courses
    if (adminRole === ROLES.TEACHER) {
      query = query.eq('instructor_id', adminId);
    }

    const studentFilter = document.getElementById('gradesStudentFilter')?.value;
    const courseFilter = document.getElementById('gradesCourseFilter')?.value;
    if (studentFilter) query = query.eq('student_id', studentFilter);
    if (courseFilter) query = query.eq('course_name', courseFilter);

    const { data: grades, error } = await query;
    if (error) throw error;

    // Populate filter dropdowns
    await populateGradeFilters();

    if (!grades?.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="admin-loading-cell">No grade records found</td></tr>`;
      return;
    }

    tbody.innerHTML = grades.map((g, idx) => {
      const numerical = parseFloat(g.numerical) || 0;
      const passed = numerical > 0 && numerical <= 3.0;
      const status = g.status || (passed ? 'Passed' : 'In Progress');
      const statusClass = { Passed: 'status-passed', Failed: 'status-failed', 'In Progress': 'status-inc', Incomplete: 'status-inc' }[status] || 'status-inc';

      const canEdit = can(adminRole, 'EDIT_ANY_GRADE') || (adminRole === ROLES.TEACHER && g.instructor_id === adminId);

      return `
        <tr style="animation: slideInRight 0.3s ease forwards ${idx * 0.025}s; opacity:0;">
          <td style="font-weight:700; color:var(--text-main);">${g.student_name || '—'}</td>
          <td style="color:var(--text-muted); font-size:0.85rem;">${g.course_name || '—'}</td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${g.instructor_name || '—'}</td>
          <td style="font-weight:600;">${g.midterm ?? '—'}%</td>
          <td style="font-weight:600;">${g.finals ?? '—'}%</td>
          <td style="font-weight:800; font-family:monospace;">${numerical ? numerical.toFixed(2) : '—'}</td>
          <td><span class="status-badge ${statusClass}">${status.toUpperCase()}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button class="admin-icon-btn edit" title="Edit" onclick="window._adminEditGrade('${g.id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>` : ''}
              ${can(adminRole, 'EDIT_ANY_GRADE') ? `<button class="admin-icon-btn delete" title="Delete" onclick="window._adminDeleteGrade('${g.id}')">
                <span class="material-symbols-outlined">delete</span>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Grades load error:', err.message);
    toast('Failed to load grades.', 'error');
  }
}

async function populateGradeFilters() {
  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'student'),
    supabase.from('student_grades').select('course_name'),
  ]);

  const sFilter = document.getElementById('gradesStudentFilter');
  const cFilter = document.getElementById('gradesCourseFilter');

  if (sFilter && students) {
    const current = sFilter.value;
    sFilter.innerHTML = `<option value="">All Students</option>` +
      (students || []).map(s => `<option value="${s.id}" ${s.id === current ? 'selected' : ''}>${s.full_name}</option>`).join('');
  }

  if (cFilter && courses) {
    const unique = [...new Set((courses || []).map(c => c.course_name))];
    const current = cFilter.value;
    cFilter.innerHTML = `<option value="">All Courses</option>` +
      unique.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
  }
}

let _editingGradeId = null;

window._adminEditGrade = async function (gradeId) {
  const { data: grade } = await supabase.from('student_grades').select('*').eq('id', gradeId).single();
  if (!grade) return;
  _editingGradeId = gradeId;
  document.getElementById('gradeModalTitle').textContent = 'Edit Grade Record';
  document.getElementById('gmMidterm').value = grade.midterm || '';
  document.getElementById('gmFinals').value = grade.finals || '';
  document.getElementById('gmStatus').value = grade.status || 'In Progress';
  openModal_inline('gradeModalOverlay');
};

async function openGradeModal(gradeId, adminRole) {
  _editingGradeId = gradeId;
  document.getElementById('gradeModalTitle').textContent = gradeId ? 'Edit Grade' : 'Add Grade Record';

  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'student'),
    supabase.from('student_courses').select('course_name').order('course_name'),
  ]);

  const sEl = document.getElementById('gmStudent');
  const cEl = document.getElementById('gmCourse');
  if (sEl) sEl.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  if (cEl) cEl.innerHTML = `<option value="">Select Course...</option>` + [...new Set((courses || []).map(c => c.course_name))].map(c => `<option value="${c}">${c}</option>`).join('');

  openModal_inline('gradeModalOverlay');
}

async function saveGrade(adminRole, adminId) {
  const btn = document.getElementById('gradeModalSave');
  btn.textContent = 'Saving...'; btn.disabled = true;

  const midterm = parseFloat(document.getElementById('gmMidterm')?.value) || null;
  const finals = parseFloat(document.getElementById('gmFinals')?.value) || null;
  const status = document.getElementById('gmStatus')?.value || 'In Progress';

  let numerical = null;
  if (midterm !== null && finals !== null) {
    const avg = (midterm + finals) / 2;
    numerical = avg >= 97 ? 1.0 : avg >= 94 ? 1.25 : avg >= 91 ? 1.5 : avg >= 88 ? 1.75 : avg >= 85 ? 2.0 : avg >= 82 ? 2.25 : avg >= 79 ? 2.5 : avg >= 76 ? 2.75 : avg >= 75 ? 3.0 : 5.0;
  }

  try {
    if (_editingGradeId) {
      const { error } = await supabase.from('student_grades')
        .update({ midterm, finals, status, numerical })
        .eq('id', _editingGradeId);
      if (error) throw error;
      toast('Grade updated!', 'success');
      logActivity('Updated grade record');
    } else {
      const studentId = document.getElementById('gmStudent')?.value;
      const courseName = document.getElementById('gmCourse')?.value;
      if (!studentId || !courseName) { toast('Student and course are required.', 'error'); return; }

      const { data: studentProfile } = await supabase.from('profiles').select('full_name').eq('id', studentId).single();
      const { error } = await supabase.from('student_grades').insert([{
        student_id: studentId, student_name: studentProfile?.full_name || 'Student',
        course_name: courseName, instructor_id: adminId, midterm, finals, status, numerical,
      }]);
      if (error) throw error;
      toast('Grade record added!', 'success');
      logActivity('Added grade record');
    }

    closeModal_inline('gradeModalOverlay');
    await loadGrades(adminRole, adminId);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Grade'; btn.disabled = false;
  }
}

window._adminDeleteGrade = async function (gradeId) {
  const { error } = await supabase.from('student_grades').delete().eq('id', gradeId);
  if (error) { toast('Delete failed.', 'error'); return; }
  toast('Grade record deleted.', 'success');
  logActivity('Deleted grade record');
  // Refresh
  const role = adminProfile?.role || 'admin';
  await loadGrades(role, adminUser?.id);
};

function exportGradesCsv() {
  const rows = document.querySelectorAll('#gradesTableBody tr');
  const csvRows = [['Student', 'Course', 'Instructor', 'Midterm', 'Finals', 'Numerical', 'Status']];
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length > 1) {
      csvRows.push([...cells].slice(0, 7).map(c => `"${c.textContent.trim()}"`));
    }
  });
  const csvContent = csvRows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'grades_export.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Grades exported!', 'success');
}

// =============================================================================
// ATTENDANCE MODULE
// =============================================================================
async function initAttendance(adminRole, adminId) {
  await loadAttendance(adminRole, adminId);
  setupModalClose_inline('attendanceModalOverlay', 'attModalClose', 'attModalCancel');

  document.getElementById('addAttendanceBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'LOG_ATTENDANCE')) { toast('Permission denied.', 'error'); return; }
    openAttendanceModal(adminRole, adminId);
  });
  document.getElementById('attModalSave')?.addEventListener('click', () => saveAttendance(adminRole, adminId));
  document.getElementById('attendanceStudentFilter')?.addEventListener('change', () => loadAttendance(adminRole, adminId));
}

async function loadAttendance(adminRole, adminId) {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  try {
    let query = supabase.from('attendance').select('*').order('date', { ascending: false });
    if (adminRole === ROLES.TEACHER) query = query.eq('instructor_id', adminId);

    const studentFilter = document.getElementById('attendanceStudentFilter')?.value;
    if (studentFilter) query = query.eq('student_id', studentFilter);

    const { data: records, error } = await query;
    if (error) throw error;

    // Populate student filter
    const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student');
    const sFilter = document.getElementById('attendanceStudentFilter');
    if (sFilter && students) {
      const cur = sFilter.value;
      sFilter.innerHTML = `<option value="">All Students</option>` + students.map(s => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${s.full_name}</option>`).join('');
    }

    // KPI row
    const total = records?.length || 0;
    const present = records?.filter(r => r.status === 'present').length || 0;
    const absent = records?.filter(r => r.status === 'absent').length || 0;
    const late = records?.filter(r => r.status === 'late').length || 0;
    const kpiRow = document.getElementById('attendanceKpiRow');
    if (kpiRow) {
      kpiRow.innerHTML = `
        <div class="pay-summary-card"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Total Records</span><span class="pay-card-icon total"><span class="material-symbols-outlined">list</span></span></div><div class="pay-amount">${total}</div></div></div>
        <div class="pay-summary-card green"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Present</span><span class="pay-card-icon green"><span class="material-symbols-outlined">check_circle</span></span></div><div class="pay-amount">${present}</div></div></div>
        <div class="pay-summary-card red"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Absent</span><span class="pay-card-icon red"><span class="material-symbols-outlined">cancel</span></span></div><div class="pay-amount">${absent}</div></div></div>`;
    }

    if (!records?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-loading-cell">No attendance records found</td></tr>`;
      return;
    }

    const statusStyles = {
      present: { class: 'status-submitted', label: 'Present' },
      absent: { class: 'status-late', label: 'Absent' },
      late: { class: 'status-pending', label: 'Late' },
      excused: { class: 'status-pending', label: 'Excused' },
    };

    tbody.innerHTML = records.map((r, idx) => {
      const ss = statusStyles[r.status] || statusStyles.present;
      const canEdit = can(adminRole, 'EDIT_ATTENDANCE');
      return `
        <tr style="animation: slideInRight 0.3s ease forwards ${idx * 0.025}s; opacity:0;">
          <td style="font-weight:700; color:var(--text-main);">${r.student_name || '—'}</td>
          <td style="color:var(--text-muted); font-size:0.85rem;">${r.course_name || '—'}</td>
          <td style="color:var(--text-muted); font-size:0.85rem; font-weight:600;">${r.date || '—'}</td>
          <td><span class="deadline-status-badge ${ss.class}">${ss.label}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button class="admin-icon-btn delete" title="Delete" onclick="window._adminDeleteAttendance('${r.id}')">
                <span class="material-symbols-outlined">delete</span>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Attendance error:', err.message);
  }
}

async function openAttendanceModal(adminRole, adminId) {
  const [{ data: students }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'student'),
    supabase.from('student_courses').select('id, course_name').order('course_name'),
  ]);

  const sEl = document.getElementById('attStudent');
  const cEl = document.getElementById('attCourse');
  const dateEl = document.getElementById('attDate');

  if (sEl) sEl.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  if (cEl) cEl.innerHTML = `<option value="">Select Course...</option>` + [...new Set((courses || []).map(c => c.course_name))].map(c => `<option value="${c}">${c}</option>`).join('');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  openModal_inline('attendanceModalOverlay');
}

async function saveAttendance(adminRole, adminId) {
  const btn = document.getElementById('attModalSave');
  const studentId = document.getElementById('attStudent')?.value;
  const courseName = document.getElementById('attCourse')?.value;
  const date = document.getElementById('attDate')?.value;
  const status = document.getElementById('attStatus')?.value || 'present';

  if (!studentId || !courseName || !date) { toast('All fields are required.', 'error'); return; }

  btn.textContent = 'Saving...'; btn.disabled = true;

  try {
    const { data: studentProfile } = await supabase.from('profiles').select('full_name').eq('id', studentId).single();
    const { error } = await supabase.from('attendance').insert([{
      student_id: studentId, student_name: studentProfile?.full_name || 'Student',
      course_name: courseName, instructor_id: adminId, date, status,
    }]);
    if (error) throw error;
    toast('Attendance logged!', 'success');
    logActivity(`Logged attendance: ${studentProfile?.full_name} - ${status}`);
    closeModal_inline('attendanceModalOverlay');
    await loadAttendance(adminRole, adminId);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Record'; btn.disabled = false;
  }
}

window._adminDeleteAttendance = async function (recordId) {
  const { error } = await supabase.from('attendance').delete().eq('id', recordId);
  if (error) { toast('Delete failed.', 'error'); return; }
  toast('Record deleted.', 'success');
  const role = adminProfile?.role || 'admin';
  await loadAttendance(role, adminUser?.id);
};

// =============================================================================
// PAYMENTS MODULE
// =============================================================================
async function initPayments(adminRole, adminId) {
  await loadAdminPayments(adminRole, adminId);
  setupModalClose_inline('paymentAdminModalOverlay', 'payModalClose', 'payModalCancel');

  document.getElementById('addPaymentBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'ADD_PAYMENT')) { toast('Only admins can add payment records.', 'error'); return; }
    openPaymentModal(adminRole, adminId);
  });
  document.getElementById('payModalSave')?.addEventListener('click', () => savePayment(adminRole, adminId));
  document.getElementById('paymentStatusFilter')?.addEventListener('change', () => loadAdminPayments(adminRole, adminId));
}

async function loadAdminPayments(adminRole, adminId) {
  const tbody = document.getElementById('adminPaymentsBody');
  if (!tbody) return;

  try {
    let query = supabase.from('student_payments').select('*').order('due_date', { ascending: true });
    const statusFilter = document.getElementById('paymentStatusFilter')?.value || 'all';
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data: payments, error } = await query;
    if (error) throw error;

    // Summary cards
    const summaryRow = document.getElementById('adminPaymentSummaryRow');
    if (summaryRow && payments) {
      const totalAmount = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const paidAmount = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const pendingAmount = totalAmount - paidAmount;
      summaryRow.innerHTML = `
        <div class="pay-summary-card"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Total Billed</span><span class="pay-card-icon total"><span class="material-symbols-outlined">receipt_long</span></span></div><div class="pay-amount">₱${totalAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>
        <div class="pay-summary-card green"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Collected</span><span class="pay-card-icon green"><span class="material-symbols-outlined">verified</span></span></div><div class="pay-amount">₱${paidAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>
        <div class="pay-summary-card red"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Outstanding</span><span class="pay-card-icon red"><span class="material-symbols-outlined">pending_actions</span></span></div><div class="pay-amount">₱${pendingAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>`;
    }

    if (!payments?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-loading-cell">No payment records</td></tr>`;
      return;
    }

    const today = new Date(); today.setHours(0,0,0,0);
    tbody.innerHTML = payments.map((p, idx) => {
      const isOverdue = p.status !== 'Paid' && new Date(p.due_date) < today;
      const statusLabel = p.status === 'Paid' ? 'Paid' : (isOverdue ? 'Overdue' : 'Pending');
      const statusClass = { Paid: 'status-submitted', Overdue: 'status-late', Pending: 'status-pending' }[statusLabel] || 'status-pending';
      const canEdit = can(adminRole, 'EDIT_PAYMENT');
      const canDel = can(adminRole, 'DELETE_PAYMENT');

      return `
        <tr style="animation: slideInRight 0.3s ease forwards ${idx * 0.025}s; opacity:0;">
          <td style="font-weight:700; color:var(--text-main);">${p.student_name || '—'}</td>
          <td style="color:var(--text-muted); font-size:0.85rem;">${p.description || '—'}</td>
          <td style="font-weight:800; font-family:monospace;">₱${parseFloat(p.amount||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
          <td style="color:var(--text-muted); font-size:0.82rem;">${p.due_date ? new Date(p.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
          <td><span class="deadline-status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button class="admin-icon-btn edit" title="Edit" onclick="window._adminEditPayment('${p.id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>` : ''}
              ${canDel ? `<button class="admin-icon-btn delete" title="Delete" onclick="window._adminDeletePayment('${p.id}')">
                <span class="material-symbols-outlined">delete</span>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Payments load error:', err.message);
  }
}

async function openPaymentModal(adminRole, adminId) {
  const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student');
  const sEl = document.getElementById('pmStudent');
  if (sEl) sEl.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  document.getElementById('pmDueDate').value = new Date().toISOString().split('T')[0];
  openModal_inline('paymentAdminModalOverlay');
}

let _editingPaymentId = null;
window._adminEditPayment = async function (payId) {
  const { data: p } = await supabase.from('student_payments').select('*').eq('id', payId).single();
  if (!p) return;
  _editingPaymentId = payId;
  const students = (await supabase.from('profiles').select('id, full_name').eq('role', 'student')).data || [];
  const sEl = document.getElementById('pmStudent');
  if (sEl) { sEl.innerHTML = students.map(s => `<option value="${s.id}" ${s.id === p.student_id ? 'selected' : ''}>${s.full_name}</option>`).join(''); }
  document.getElementById('pmDescription').value = p.description || '';
  document.getElementById('pmAmount').value = p.amount || '';
  document.getElementById('pmDueDate').value = p.due_date || '';
  document.getElementById('pmStatus').value = p.status || 'Pending';
  openModal_inline('paymentAdminModalOverlay');
};

async function savePayment(adminRole, adminId) {
  const btn = document.getElementById('payModalSave');
  const studentId = document.getElementById('pmStudent')?.value;
  const description = document.getElementById('pmDescription')?.value.trim();
  const amount = parseFloat(document.getElementById('pmAmount')?.value || 0);
  const dueDate = document.getElementById('pmDueDate')?.value;
  const status = document.getElementById('pmStatus')?.value || 'Pending';

  if (!studentId || !description || !amount) { toast('Student, description, and amount are required.', 'error'); return; }
  btn.textContent = 'Saving...'; btn.disabled = true;

  try {
    if (_editingPaymentId) {
      const { error } = await supabase.from('student_payments').update({ description, amount, due_date: dueDate, status }).eq('id', _editingPaymentId);
      if (error) throw error;
      toast('Payment record updated!', 'success');
    } else {
      const { data: s } = await supabase.from('profiles').select('full_name').eq('id', studentId).single();
      const { error } = await supabase.from('student_payments').insert([{ student_id: studentId, student_name: s?.full_name || 'Student', description, amount, due_date: dueDate, status }]);
      if (error) throw error;
      toast('Payment record added!', 'success');
    }
    _editingPaymentId = null;
    logActivity(`Saved payment record for student`);
    closeModal_inline('paymentAdminModalOverlay');
    await loadAdminPayments(adminRole, adminId);
  } catch (err) {
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Record'; btn.disabled = false;
  }
}

window._adminDeletePayment = async function (payId) {
  const { error } = await supabase.from('student_payments').delete().eq('id', payId);
  if (error) { toast('Delete failed.', 'error'); return; }
  toast('Payment record deleted.', 'success');
  logActivity('Deleted payment record');
  const role = adminProfile?.role || 'admin';
  await loadAdminPayments(role, adminUser?.id);
};

// =============================================================================
// INLINE MODAL HELPERS (avoids duplicate module imports)
// =============================================================================
function openModal_inline(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; requestAnimationFrame(() => el.classList.add('active')); }
}

function closeModal_inline(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('active'); setTimeout(() => { el.style.display = ''; }, 200); }
}

function setupModalClose_inline(overlayId, ...closeBtnIds) {
  const overlay = document.getElementById(overlayId);
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal_inline(overlayId); });
  closeBtnIds.forEach(id => document.getElementById(id)?.addEventListener('click', () => closeModal_inline(overlayId)));
}