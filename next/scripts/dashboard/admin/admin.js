// =============================================================================
// admin.js — Admin Dashboard Master Orchestrator
// Orchestrates all modules, enforces auth, applies RBAC.
// =============================================================================



// TO:
import { supabase, can, ROLES } from '../config.js';
import {
  toast, applyRoleUI, logActivity, avatarUrl,
  debounce, filterBySearch, normalizeSearchTerm, initAdminUIComponents,
  openModal, closeModal, setupModalClose,
  getPHNumericalGrade, formatDate
} from '../utils.js';
import { initUsers, loadUsers, getUserStats } from './admin-users.js';
import { initCourses, loadCourses, getCourseStats } from './admin-courses.js';
import { initAnalytics, refreshAnalytics } from './admin-analytics.js';
import { initAnnouncements, loadAnnouncements } from './admin-announcements.js';
import { initSettings } from './admin-settings.js';

// ─── Module-level state ───────────────────────────────────────────────────────
let adminUser = null;
let adminProfile = null;
let currentView = 'view-overview';
const gradeState = { all: [], filtered: [] };
const attendanceState = { all: [], filtered: [] };
const paymentState = { all: [], filtered: [] };

function buildNameMap(items, fallbackKey = 'full_name') {
  return new Map((items || []).map(item => [item.id, item?.[fallbackKey] || item?.name || '']));
}

function getUniqueOptions(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function updateSelectOptions(selectId, options, defaultLabel, selectedValue = '') {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = `<option value="">${defaultLabel}</option>` +
    options.map(option => `<option value="${option.value}" ${String(option.value) === String(selectedValue) ? 'selected' : ''}>${option.label}</option>`).join('');
}

async function syncOverviewAnalytics() {
  await refreshAnalytics(getUserStats());
}

// =============================================================================
// BOOT — Auth Guard → Profile Load → Module Init
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initAdminUIComponents();

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
  const closeSidebarNav = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  };
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('active');
  });
  overlay?.addEventListener('click', closeSidebarNav);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebarNav();
  });
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth > 900) closeSidebarNav();
  }, 80));

  document.addEventListener('click', e => {
    const target = e.target.closest('[data-target]');
    if (target) {
      e.preventDefault();
      const viewId = target.getAttribute('data-target');
      switchView(viewId, role, adminUser.id, fullName);
      closeSidebarNav();
    }
  });

  // ── 7. Global Search ──────────────────────────────────────────────────────
  document.getElementById('adminGlobalSearch')?.addEventListener('input', debounce(e => {
    globalSearch(e.target.value, role);
  }, 220));

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
  const normalizedTerm = normalizeSearchTerm(term);

  const filterElements = (selector) => {
    document.querySelectorAll(selector).forEach(el => {
      const haystack = normalizeSearchTerm(el.dataset.search || el.textContent);
      el.style.display = !normalizedTerm || haystack.includes(normalizedTerm) ? '' : 'none';
    });
  };

  filterElements('#usersTableBody tr');
  filterElements('.course-card');
  filterElements('.admin-ann-card');
  filterElements('#gradesTableBody tr');
  filterElements('#attendanceTableBody tr');
  filterElements('#adminPaymentsBody tr');
}

// =============================================================================
// GRADES MODULE (inline, uses existing patterns)
// =============================================================================
async function initGrades(adminRole, adminId) {
  setupModalClose('gradeModalOverlay', 'gradeModalClose', 'gradeModalCancel');
  document.getElementById('addGradeBtn')?.addEventListener('click', () => openGradeModal(null, adminRole));
  document.getElementById('gradeModalSave')?.addEventListener('click', () => saveGrade(adminRole, adminId));
  document.getElementById('gradesStudentFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));
  document.getElementById('gradesCourseFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));
  document.getElementById('gradesSearchInput')?.addEventListener('input', debounce(() => loadGrades(adminRole, adminId), 220));
  document.getElementById('exportGradesBtn')?.addEventListener('click', exportGradesCsv);
  await loadGrades(adminRole, adminId);
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

    const studentFilter = document.getElementById('gradesStudentFilter')?.value || '';
    const courseFilter = document.getElementById('gradesCourseFilter')?.value || '';
    const searchTerm = document.getElementById('gradesSearchInput')?.value || '';
    if (studentFilter) query = query.eq('student_id', studentFilter);
    if (courseFilter) query = query.eq('course_name', courseFilter);

    const [{ data: grades, error }, { data: students }, { data: instructors }, { data: courseRows }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').eq('role', 'student'),
      supabase.from('profiles').select('id, full_name, role').neq('role', 'student'),
      supabase.from('student_courses').select('course_name').order('course_name'),
    ]);
    if (error) throw error;

    const studentMap = buildNameMap(students);
    const instructorMap = buildNameMap(instructors);
    populateGradeFilters(students || [], courseRows || []);

    gradeState.all = (grades || []).map(grade => {
      const numerical = Number.parseFloat(grade.numerical);
      return {
        ...grade,
        student_name: grade.student_name || studentMap.get(grade.student_id) || 'Student',
        instructor_name: grade.instructor_name || instructorMap.get(grade.instructor_id) || 'Unassigned',
        course_name: grade.course_name || 'Untitled Course',
        numerical: Number.isFinite(numerical) ? numerical : null,
        status: grade.status || (Number.isFinite(numerical) ? (numerical <= 3 ? 'Passed' : 'Failed') : 'In Progress'),
      };
    });

    gradeState.filtered = filterBySearch(gradeState.all, searchTerm, ['student_name', 'course_name', 'instructor_name', 'status']);

    if (!gradeState.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="admin-loading-cell">No grade records found</td></tr>`;
      return;
    }

    tbody.innerHTML = gradeState.filtered.map((g) => {
      const statusClass = { Passed: 'status-passed', Failed: 'status-failed', 'In Progress': 'status-inc', Incomplete: 'status-inc' }[g.status] || 'status-inc';
      const canEdit = can(adminRole, 'EDIT_ANY_GRADE') || (adminRole === ROLES.TEACHER && g.instructor_id === adminId);
      const rowSearch = [g.id, g.student_id, g.student_name, g.course_name, g.instructor_name, g.status].join(' ');
      const numerical = g.numerical;
      const status = g.status;
      const midtermScore = g.midterm ?? null;
      const finalsScore = g.finals ?? null;
      const midtermMarkup = `<span class="admin-grade-score${midtermScore === null ? ' empty' : ''}">${midtermScore === null ? '—' : `${midtermScore}%`}</span>`;
      const finalsMarkup = `<span class="admin-grade-score${finalsScore === null ? ' empty' : ''}">${finalsScore === null ? '—' : `${finalsScore}%`}</span>`;
      const numericalMarkup = `<span class="admin-grade-numerical${numerical ? '' : ' empty'}">${numerical ? numerical.toFixed(2) : '—'}</span>`;

      return `
        <tr data-search="${rowSearch}">
          <td><span class="admin-grade-student">${g.student?.full_name || g.student_name || '—'}</span></td>
          <td><span class="admin-grade-course">${g.course_name || '—'}</span></td>
          <td><span class="admin-grade-instructor">${g.instructor_name || '—'}</span></td>
          <td>${midtermMarkup}</td>
          <td>${finalsMarkup}</td>
          <td>${numericalMarkup}</td>
          <td><span class="status-badge ${statusClass}">${status.toUpperCase()}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button type="button" class="admin-icon-btn edit" title="Edit" onclick="window._adminEditGrade('${g.id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>` : ''}
              ${can(adminRole, 'EDIT_ANY_GRADE') ? `<button type="button" class="admin-icon-btn delete" title="Delete" onclick="window._adminDeleteGrade('${g.id}')">
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

function populateGradeFilters(students = [], courses = []) {
  updateSelectOptions(
    'gradesStudentFilter',
    (students || []).map(student => ({ value: student.id, label: student.full_name || 'Unnamed Student' })),
    'All Students',
    document.getElementById('gradesStudentFilter')?.value || ''
  );

  updateSelectOptions(
    'gradesCourseFilter',
    getUniqueOptions((courses || []).map(course => course.course_name)).map(courseName => ({ value: courseName, label: courseName })),
    'All Courses',
    document.getElementById('gradesCourseFilter')?.value || ''
  );
}

let _editingGradeId = null;

window._adminEditGrade = async function (gradeId) {
  const { data: grade } = await supabase.from('student_grades').select('*').eq('id', gradeId).single();
  if (!grade) return;
  await openGradeModal(gradeId, adminProfile?.role || 'admin');
  _editingGradeId = gradeId;
  document.getElementById('gradeModalTitle').textContent = 'Edit Grade Record';
  document.getElementById('gmStudent').value = grade.student_id || '';
  document.getElementById('gmCourse').value = grade.course_name || '';
  document.getElementById('gmStudent').disabled = true;
  document.getElementById('gmCourse').disabled = true;
  document.getElementById('gmMidterm').value = grade.midterm || '';
  document.getElementById('gmFinals').value = grade.finals || '';
  document.getElementById('gmStatus').value = grade.status || 'In Progress';
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
  if (sEl) sEl.disabled = Boolean(gradeId);
  if (cEl) cEl.disabled = Boolean(gradeId);
  if (sEl) sEl.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  if (cEl) cEl.innerHTML = `<option value="">Select Course...</option>` + [...new Set((courses || []).map(c => c.course_name))].map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('gmMidterm').value = '';
  document.getElementById('gmFinals').value = '';
  document.getElementById('gmStatus').value = 'In Progress';

  openModal('gradeModalOverlay');
}

async function saveGrade(adminRole, adminId) {
  const btn = document.getElementById('gradeModalSave');
  btn.textContent = 'Saving...'; btn.disabled = true;

  const midterm = parseFloat(document.getElementById('gmMidterm')?.value) || null;
  const finals = parseFloat(document.getElementById('gmFinals')?.value) || null;
  const status = document.getElementById('gmStatus')?.value || 'In Progress';

  let numerical = null;
  if (midterm !== null && finals !== null) {
    numerical = getPHNumericalGrade((midterm + finals) / 2);
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

    closeModal('gradeModalOverlay');
    await loadGrades(adminRole, adminId);
    await syncOverviewAnalytics();
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
  const role = adminProfile?.role || 'admin';
  await loadGrades(role, adminUser?.id);
  await syncOverviewAnalytics();
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
  setupModalClose('attendanceModalOverlay', 'attModalClose', 'attModalCancel');

  document.getElementById('addAttendanceBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'LOG_ATTENDANCE')) { toast('Permission denied.', 'error'); return; }
    openAttendanceModal(adminRole, adminId);
  });
  document.getElementById('attModalSave')?.addEventListener('click', () => saveAttendance(adminRole, adminId));
  document.getElementById('attendanceStudentFilter')?.addEventListener('change', () => loadAttendance(adminRole, adminId));
  document.getElementById('attendanceSearchInput')?.addEventListener('input', debounce(() => loadAttendance(adminRole, adminId), 220));
  await loadAttendance(adminRole, adminId);
}

async function loadAttendance(adminRole, adminId) {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody) return;

  try {
    let query = supabase.from('attendance').select('*').order('date', { ascending: false });
    if (adminRole === ROLES.TEACHER) query = query.eq('instructor_id', adminId);

    const studentFilter = document.getElementById('attendanceStudentFilter')?.value || '';
    const searchTerm = document.getElementById('attendanceSearchInput')?.value || '';
    if (studentFilter) query = query.eq('student_id', studentFilter);

    const [{ data: records, error }, { data: students }, { data: courseRows }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').eq('role', 'student'),
      supabase.from('student_courses').select('student_id, course_name'),
    ]);
    if (error) throw error;

    updateSelectOptions(
      'attendanceStudentFilter',
      (students || []).map(student => ({ value: student.id, label: student.full_name || 'Unnamed Student' })),
      'All Students',
      studentFilter
    );

    const studentMap = buildNameMap(students);
    const courseByStudent = new Map();
    (courseRows || []).forEach(course => {
      if (course.student_id && course.course_name && !courseByStudent.has(course.student_id)) {
        courseByStudent.set(course.student_id, course.course_name);
      }
    });

    attendanceState.all = (records || []).map(record => ({
      ...record,
      student_name: record.student_name || studentMap.get(record.student_id) || 'Student',
      course_name: record.course_name || courseByStudent.get(record.student_id) || 'Unassigned Course',
    }));
    attendanceState.filtered = filterBySearch(attendanceState.all, searchTerm, ['student_name', 'course_name', 'status', 'date']);
    renderAttendanceKpis(attendanceState.filtered);

    if (!attendanceState.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-loading-cell">No attendance records found</td></tr>`;
      return;
    }

    const statusStyles = {
      present: { class: 'status-submitted', label: 'Present' },
      absent: { class: 'status-late', label: 'Absent' },
      late: { class: 'status-pending', label: 'Late' },
      excused: { class: 'status-pending', label: 'Excused' },
    };

    tbody.innerHTML = attendanceState.filtered.map((r) => {
      const ss = statusStyles[r.status] || statusStyles.present;
      const canEdit = can(adminRole, 'EDIT_ATTENDANCE');
      return `
        <tr data-search="${[r.id, r.student_id, r.student_name, r.course_name, r.status, r.date].join(' ')}">
          <td><span class="admin-attendance-student">${r.student_name || '—'}</span></td>
          <td><span class="admin-attendance-course">${r.course_name || '—'}</span></td>
          <td><span class="admin-attendance-date">${r.date || '—'}</span></td>
          <td><span class="deadline-status-badge ${ss.class}">${ss.label}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button type="button" class="admin-icon-btn delete" title="Delete" onclick="window._adminDeleteAttendance('${r.id}')">
                <span class="material-symbols-outlined">delete</span>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Attendance error:', err.message);
    toast('Failed to load attendance.', 'error');
  }
}

function renderAttendanceKpis(records = []) {
  const row = document.getElementById('attendanceKpiRow');
  if (!row) return;

  const totals = records.reduce((acc, record) => {
    acc.total += 1;
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0, excused: 0 });

  const presentRate = totals.total ? Math.round((totals.present / totals.total) * 100) : 0;
  row.innerHTML = `
    <div class="pay-summary-card">
      <div class="pay-card-inner">
        <div class="pay-card-header"><span class="pay-label">Attendance Records</span></div>
        <div class="pay-amount">${totals.total}</div>
      </div>
    </div>
    <div class="pay-summary-card green">
      <div class="pay-card-inner">
        <div class="pay-card-header"><span class="pay-label">Present Rate</span></div>
        <div class="pay-amount">${presentRate}%</div>
      </div>
    </div>
    <div class="pay-summary-card red">
      <div class="pay-card-inner">
        <div class="pay-card-header"><span class="pay-label">Absent / Late</span></div>
        <div class="pay-amount">${totals.absent + totals.late}</div>
      </div>
    </div>`;
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
  document.getElementById('attStatus').value = 'present';

  openModal('attendanceModalOverlay');
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
    closeModal('attendanceModalOverlay');
    await loadAttendance(adminRole, adminId);
    await syncOverviewAnalytics();
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
  await syncOverviewAnalytics();
};

// =============================================================================
// PAYMENTS MODULE
// =============================================================================
async function initPayments(adminRole, adminId) {
  setupModalClose('paymentAdminModalOverlay', 'payModalClose', 'payModalCancel');

  document.getElementById('addPaymentBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'ADD_PAYMENT')) { toast('Only admins can add payment records.', 'error'); return; }
    openPaymentModal(adminRole, adminId);
  });
  document.getElementById('payModalSave')?.addEventListener('click', () => savePayment(adminRole, adminId));
  document.getElementById('paymentStatusFilter')?.addEventListener('change', () => loadAdminPayments(adminRole, adminId));
  document.getElementById('paymentSearchInput')?.addEventListener('input', debounce(() => loadAdminPayments(adminRole, adminId), 220));
  await loadAdminPayments(adminRole, adminId);
}

async function loadAdminPayments(adminRole, adminId) {
  const tbody = document.getElementById('adminPaymentsBody');
  if (!tbody) return;

  try {
    let query = supabase.from('student_payments').select('*').order('due_date', { ascending: true });
    const statusFilter = document.getElementById('paymentStatusFilter')?.value || 'all';
    const searchTerm = document.getElementById('paymentSearchInput')?.value || '';

    const [{ data: payments, error }, { data: students }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').eq('role', 'student'),
    ]);
    if (error) throw error;

    const studentMap = buildNameMap(students);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    paymentState.all = (payments || []).map(payment => {
      const isOverdue = payment.status !== 'Paid' && payment.due_date && new Date(payment.due_date) < today;
      return {
        ...payment,
        student_name: payment.student_name || studentMap.get(payment.student_id) || 'Student',
        status_label: payment.status === 'Paid' ? 'Paid' : (isOverdue ? 'Overdue' : 'Pending'),
      };
    });

    paymentState.filtered = paymentState.all
      .filter(payment => statusFilter === 'all' || payment.status_label === statusFilter)
      .filter(payment => filterBySearch([payment], searchTerm, ['student_name', 'description', 'status_label']).length > 0);

    const summaryRow = document.getElementById('adminPaymentSummaryRow');
    if (summaryRow) {
      const totalAmount = paymentState.filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const paidAmount = paymentState.filtered.filter(p => p.status_label === 'Paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const pendingAmount = totalAmount - paidAmount;
      summaryRow.innerHTML = `
        <div class="pay-summary-card"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Total Billed</span><span class="pay-card-icon total"><span class="material-symbols-outlined">receipt_long</span></span></div><div class="pay-amount">₱${totalAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>
        <div class="pay-summary-card green"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Collected</span><span class="pay-card-icon green"><span class="material-symbols-outlined">verified</span></span></div><div class="pay-amount">₱${paidAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>
        <div class="pay-summary-card red"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Outstanding</span><span class="pay-card-icon red"><span class="material-symbols-outlined">pending_actions</span></span></div><div class="pay-amount">₱${pendingAmount.toLocaleString('en-PH', {minimumFractionDigits:2})}</div></div></div>`;
    }

    if (!paymentState.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-loading-cell">No payment records</td></tr>`;
      return;
    }

    tbody.innerHTML = paymentState.filtered.map((p) => {
      const statusLabel = p.status_label;
      const statusClass = { Paid: 'status-submitted', Overdue: 'status-late', Pending: 'status-pending' }[statusLabel] || 'status-pending';
      const canEdit = can(adminRole, 'EDIT_PAYMENT');
      const canDel = can(adminRole, 'DELETE_PAYMENT');

      return `
        <tr data-search="${[p.id, p.student_id, p.student_name, p.description, statusLabel].join(' ')}">
          <td><span class="admin-payment-student">${p.student?.full_name || p.student_name || '—'}</span></td>
          <td><span class="admin-payment-description">${p.description || '—'}</span></td>
          <td><span class="admin-payment-amount">₱${parseFloat(p.amount||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></td>
          <td><span class="admin-payment-date">${p.due_date ? new Date(p.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</span></td>
          <td><span class="deadline-status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <div class="admin-row-actions">
              ${canEdit ? `<button type="button" class="admin-icon-btn edit" title="Edit" onclick="window._adminEditPayment('${p.id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>` : ''}
              ${canDel ? `<button type="button" class="admin-icon-btn delete" title="Delete" onclick="window._adminDeletePayment('${p.id}')">
                <span class="material-symbols-outlined">delete</span>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('Payments load error:', err.message);
    toast('Failed to load payments.', 'error');
  }
}

async function openPaymentModal(adminRole, adminId) {
  const { data: students } = await supabase.from('profiles').select('id, full_name').eq('role', 'student');
  const sEl = document.getElementById('pmStudent');
  if (sEl) sEl.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(s => `<option value="${s.id}">${s.full_name}</option>`).join('');
  document.getElementById('payModalTitle').textContent = 'Add Payment Record';
  document.getElementById('pmStudent').disabled = false;
  document.getElementById('pmDescription').value = '';
  document.getElementById('pmAmount').value = '';
  document.getElementById('pmDueDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('pmStatus').value = 'Pending';
  _editingPaymentId = null;
  openModal('paymentAdminModalOverlay');
}

let _editingPaymentId = null;
window._adminEditPayment = async function (payId) {
  const { data: p } = await supabase.from('student_payments').select('*').eq('id', payId).single();
  if (!p) return;
  _editingPaymentId = payId;
  document.getElementById('payModalTitle').textContent = 'Edit Payment Record';
  const students = (await supabase.from('profiles').select('id, full_name').eq('role', 'student')).data || [];
  const sEl = document.getElementById('pmStudent');
  if (sEl) { sEl.innerHTML = students.map(s => `<option value="${s.id}" ${s.id === p.student_id ? 'selected' : ''}>${s.full_name}</option>`).join(''); }
  document.getElementById('pmStudent').disabled = true;
  document.getElementById('pmDescription').value = p.description || '';
  document.getElementById('pmAmount').value = p.amount || '';
  document.getElementById('pmDueDate').value = p.due_date || '';
  document.getElementById('pmStatus').value = p.status || 'Pending';
  openModal('paymentAdminModalOverlay');
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
    closeModal('paymentAdminModalOverlay');
    await loadAdminPayments(adminRole, adminId);
    await syncOverviewAnalytics();
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
  await syncOverviewAnalytics();
};
