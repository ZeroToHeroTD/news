// =============================================================================
// admin.js â€” Admin Dashboard Master Orchestrator
// Orchestrates all modules, enforces auth, applies RBAC.
// =============================================================================



// TO:
import { supabase, can, ROLES } from '../config.js';
import {
  toast, applyRoleUI, logActivity, avatarUrl,
  debounce, filterBySearch, normalizeSearchTerm, initAdminUIComponents,
  openModal, closeModal, setupModalClose,
  getPHNumericalGrade, formatDate, escapeHtml
} from '../utils.js';
import { initUsers, loadUsers, getUserStats } from './admin-users.js';
import { initCourses, loadCourses, getCourseStats } from './admin-courses.js';
import { initAnalytics, refreshAnalytics } from './admin-analytics.js';
import { initAnnouncements, loadAnnouncements } from './admin-announcements.js';
import { initSettings } from './admin-settings.js';

// â”€â”€â”€ Module-level state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let adminUser = null;
let adminProfile = null;
let currentView = 'view-overview';
const gradeState = { all: [], filtered: [] };
const attendanceState = { all: [], filtered: [] };
const paymentState = { all: [], filtered: [] };
const paymentProofState = { all: [], byPaymentId: new Map(), byReferenceNumber: new Map() };
let activePaymentProof = null;
const ADMIN_VIEW_KEY = 'admin:lastView';

function formatPeso(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function buildNameMap(items, fallbackKey = 'full_name') {
  return new Map((items || []).map(item => [item.id, item?.[fallbackKey] || item?.name || '']));
}

function getUniqueOptions(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function resolveInitialAdminView(role) {
  const hashView = window.location.hash ? window.location.hash.replace('#', '') : '';
  const savedView = localStorage.getItem(ADMIN_VIEW_KEY) || '';
  const requestedView = hashView || savedView || 'view-overview';
  const existingView = document.getElementById(requestedView) ? requestedView : 'view-overview';

  if (role !== ROLES.ADMIN && existingView === 'view-settings') {
    return 'view-overview';
  }

  return existingView;
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
// BOOT â€” Auth Guard â†’ Profile Load â†’ Module Init
// =============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initAdminUIComponents();

  // â”€â”€ 1. Authenticate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: { session }, error: authError } = await supabase.auth.getSession();

  if (authError || !session) {
    window.location.replace('index.html');
    return;
  }

  adminUser = session.user;

  // â”€â”€ 2. Load profile and verify role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .single();

  if (profileError || !profile) {
    toast('Failed to load admin profile.', 'error');
    setTimeout(() => window.location.replace('index.html'), 2000);
    return;
  }

  adminProfile = profile;
  const role = profile.role || ROLES.STUDENT;

  // Block students from accessing admin dashboard entirely
  if (role === ROLES.STUDENT) {
    document.body.innerHTML = `
      <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg-body, #e8edf5); font-family:'Inter',sans-serif;">
        <div style="text-align:center; padding:40px; background:#fff; border-radius:20px; box-shadow:0 20px 60px rgba(0,0,0,0.1); max-width:400px;">
          <span style="font-size:3rem;">ðŸ”’</span>
          <h2 style="margin:16px 0 8px; color:#1e293b;">Access Denied</h2>
          <p style="color:#64748b; margin-bottom:24px;">You don't have permission to access the Admin Dashboard.</p>
          <a href="../../next/html/dashboard.html" style="display:inline-flex; align-items:center; gap:8px; padding:12px 24px; background:#0062ff; color:#fff; border-radius:12px; font-weight:700; text-decoration:none;">â† Back to Student Portal</a>
        </div>
      </div>`;
    return;
  }

  // â”€â”€ 3. Update Identity UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const adminStatusDot = document.getElementById('adminStatusDot');
  if (adminStatusDot) {
    adminStatusDot.classList.add('online');
    adminStatusDot.setAttribute('aria-label', 'Online');
    adminStatusDot.title = 'Online';
  }

  // â”€â”€ 4. Apply RBAC UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  applyRoleUI(role);

  // â”€â”€ 5. Theme â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const themeBtn = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const applyTheme = (theme) => {
    const isDark = theme !== 'light';
    document.body.classList.toggle('dark-mode', isDark);
    document.body.dataset.themeReady = 'true';
    if (themeIcon) themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const savedTheme = localStorage.getItem('theme');
  applyTheme(savedTheme === 'light' ? 'light' : 'dark');

  themeBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(nextTheme);
  });

  // â”€â”€ 6. Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sidebar = document.querySelector('.app-sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  let sidebarHistoryOpen = false;
  const closeSidebarNav = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
    sidebarHistoryOpen = false;
  };
  document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
    const willOpen = !sidebar?.classList.contains('open');
    sidebar?.classList.toggle('open', willOpen);
    overlay?.classList.toggle('active', willOpen);
    if (willOpen && !sidebarHistoryOpen) {
      window.history.pushState({ ...(window.history.state || {}), __adminSidebarOpen: true }, '');
      sidebarHistoryOpen = true;
    }
  });
  overlay?.addEventListener('click', closeSidebarNav);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebarNav();
  });
  window.addEventListener('resize', debounce(() => {
    if (window.innerWidth > 900) closeSidebarNav();
  }, 80));

  window.addEventListener('popstate', () => {
    if (sidebar?.classList.contains('open')) {
      closeSidebarNav();
    }
  });

  document.addEventListener('click', e => {
    const target = e.target.closest('[data-target]');
    if (target) {
      e.preventDefault();
      const viewId = target.getAttribute('data-target');
      switchView(viewId, role, adminUser.id, fullName);
      closeSidebarNav();
    }
  });

  // â”€â”€ 7. Global Search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.getElementById('adminGlobalSearch')?.addEventListener('input', debounce(e => {
    globalSearch(e.target.value, role);
  }, 220));

  // â”€â”€ 8. Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('index.html');
  });

  // â”€â”€ 9. Initialize all modules in parallel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await initializeAllModules(role, adminUser.id, fullName, profile.created_at);
  switchView(resolveInitialAdminView(role), role, adminUser.id, fullName, { preserveScroll: false });

  // â”€â”€ 10. Log session start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
function switchView(targetId, role, userId, userName, options = {}) {
  const { preserveScroll = true } = options;
  if (role !== ROLES.ADMIN && targetId === 'view-settings') {
    toast('Settings is restricted to Administrators.', 'error'); return;
  }

  currentView = targetId;
  localStorage.setItem(ADMIN_VIEW_KEY, targetId);
  if (window.location.hash !== `#${targetId}`) {
    window.history.replaceState(window.history.state, '', `#${targetId}`);
  }
  document.querySelectorAll('.view-content').forEach(v => {
    v.classList.toggle('active', v.id === targetId);
  });

  document.querySelectorAll('.nav-links li').forEach(li => {
    const a = li.querySelector('a');
    if (a) li.classList.toggle('active', a.getAttribute('data-target') === targetId);
  });

  if (preserveScroll) {
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
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
  setupGradeSteppers();
  document.getElementById('addGradeBtn')?.addEventListener('click', () => openGradeModal(null, adminRole));
  document.getElementById('gradeModalSave')?.addEventListener('click', () => saveGrade(adminRole, adminId));
  document.getElementById('gradesStudentFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));
  document.getElementById('gradesCourseFilter')?.addEventListener('change', () => loadGrades(adminRole, adminId));
  document.getElementById('gradesSearchInput')?.addEventListener('input', debounce(() => loadGrades(adminRole, adminId), 220));
  document.getElementById('exportGradesBtn')?.addEventListener('click', exportGradesCsv);
  await loadGrades(adminRole, adminId);
}

function setupGradeSteppers() {
  [
    ['gmMidterm', 'gmMidtermDecrement', 'gmMidtermIncrement'],
    ['gmFinals', 'gmFinalsDecrement', 'gmFinalsIncrement']
  ].forEach(([inputId, decrementId, incrementId]) => {
    const input = document.getElementById(inputId);
    const decrementBtn = document.getElementById(decrementId);
    const incrementBtn = document.getElementById(incrementId);

    if (!input || !decrementBtn || !incrementBtn || input.dataset.stepperBound === 'true') return;

    const applyDelta = (delta) => {
      const min = parseInt(input.min || '0', 10);
      const max = parseInt(input.max || '100', 10);
      const current = parseInt(input.value || '0', 10);
      const base = Number.isNaN(current) ? min : current;
      const next = Math.min(max, Math.max(min, base + delta));
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    decrementBtn.addEventListener('click', () => applyDelta(-1));
    incrementBtn.addEventListener('click', () => applyDelta(1));
    input.dataset.stepperBound = 'true';
  });
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
      supabase.from('profiles').select('id, full_name, email'),
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
    renderGradeInsights();

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
      const midtermMarkup = `<span class="admin-grade-score${midtermScore === null ? ' empty' : ''}">${midtermScore === null ? 'â€”' : `${midtermScore}%`}</span>`;
      const finalsMarkup = `<span class="admin-grade-score${finalsScore === null ? ' empty' : ''}">${finalsScore === null ? 'â€”' : `${finalsScore}%`}</span>`;
      const numericalMarkup = `<span class="admin-grade-numerical${numerical ? '' : ' empty'}">${numerical ? numerical.toFixed(2) : 'â€”'}</span>`;

      return `
        <tr data-search="${rowSearch}">
          <td><span class="admin-grade-student">${g.student?.full_name || g.student_name || 'â€”'}</span></td>
          <td><span class="admin-grade-course">${g.course_name || 'â€”'}</span></td>
          <td><span class="admin-grade-instructor">${g.instructor_name || 'â€”'}</span></td>
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
    decorateGradeTableRows();
  } catch (err) {
    console.error('Grades load error:', err.message);
    toast('Failed to load grades.', 'error');
  }
}

function decorateGradeTableRows() {
  const rows = document.querySelectorAll('#gradesTableBody tr');
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;

    const studentCell = cells[0];
    const courseCell = cells[1];
    const instructorCell = cells[2];
    const midtermEl = cells[3].querySelector('.admin-grade-score');
    const finalsEl = cells[4].querySelector('.admin-grade-score');
    const numericalEl = cells[5].querySelector('.admin-grade-numerical');

    if (!studentCell.querySelector('.admin-grade-primary')) {
      const studentText = studentCell.textContent.trim() || 'â€”';
      studentCell.innerHTML = `<div class="admin-grade-primary"><span class="admin-grade-student">${studentText}</span><span class="admin-grade-meta">Student record</span></div>`;
    }

    if (!courseCell.querySelector('.admin-grade-primary')) {
      const courseText = courseCell.textContent.trim() || 'â€”';
      courseCell.innerHTML = `<div class="admin-grade-primary"><span class="admin-grade-course">${courseText}</span><span class="admin-grade-meta">Course assignment</span></div>`;
    }

    if (!instructorCell.querySelector('.admin-grade-primary')) {
      const instructorText = instructorCell.textContent.trim() || 'â€”';
      instructorCell.innerHTML = `<div class="admin-grade-primary"><span class="admin-grade-instructor">${instructorText}</span><span class="admin-grade-meta">Faculty owner</span></div>`;
    }

    applyGradeScoreTone(midtermEl, parsePercent(midtermEl?.textContent));
    applyGradeScoreTone(finalsEl, parsePercent(finalsEl?.textContent));
    applyNumericalTone(numericalEl, parseFloat(numericalEl?.textContent));
  });
}

function parsePercent(value) {
  const parsed = parseFloat(String(value || '').replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function applyGradeScoreTone(element, score) {
  if (!element || score === null) return;
  element.classList.remove('is-strong', 'is-steady', 'is-alert');
  if (score >= 90) element.classList.add('is-strong');
  else if (score >= 75) element.classList.add('is-steady');
  else element.classList.add('is-alert');
}

function applyNumericalTone(element, score) {
  if (!element || !Number.isFinite(score)) return;
  element.classList.remove('is-strong', 'is-steady', 'is-alert');
  if (score <= 1.75) element.classList.add('is-strong');
  else if (score <= 3) element.classList.add('is-steady');
  else element.classList.add('is-alert');
}

function renderGradeInsights() {
  const strip = document.getElementById('gradesStatsStrip');
  if (!strip) return;

  const items = gradeState.filtered.length ? gradeState.filtered : gradeState.all;
  const total = items.length;
  const passed = items.filter(item => String(item.status).toLowerCase() === 'passed').length;
  const review = items.filter(item => ['in progress', 'incomplete'].includes(String(item.status).toLowerCase())).length;
  const numericalValues = items.map(item => Number(item.numerical)).filter(value => Number.isFinite(value));
  const average = numericalValues.length
    ? (numericalValues.reduce((sum, value) => sum + value, 0) / numericalValues.length).toFixed(2)
    : 'â€”';
  const passRate = total ? `${Math.round((passed / total) * 100)}%` : '0%';

  strip.innerHTML = `
    <article class="admin-grade-insight-card admin-grade-insight-card-total">
      <span class="admin-grade-insight-label">Grade Records</span>
      <strong class="admin-grade-insight-value">${total}</strong>
      <span class="admin-grade-insight-meta">Filtered working set</span>
    </article>
    <article class="admin-grade-insight-card admin-grade-insight-card-pass">
      <span class="admin-grade-insight-label">Pass Rate</span>
      <strong class="admin-grade-insight-value">${passRate}</strong>
      <span class="admin-grade-insight-meta">${passed} student results passed</span>
    </article>
    <article class="admin-grade-insight-card admin-grade-insight-card-average">
      <span class="admin-grade-insight-label">Average Numerical</span>
      <strong class="admin-grade-insight-value">${average}</strong>
      <span class="admin-grade-insight-meta">Current class standing</span>
    </article>
    <article class="admin-grade-insight-card admin-grade-insight-card-review">
      <span class="admin-grade-insight-label">Needs Review</span>
      <strong class="admin-grade-insight-value">${review}</strong>
      <span class="admin-grade-insight-meta">In progress or incomplete</span>
    </article>
  `;
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
    supabase.from('profiles').select('id, full_name, email'),
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
      supabase.from('profiles').select('id, full_name, email'),
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
          <td><span class="admin-attendance-student">${r.student_name || 'â€”'}</span></td>
          <td><span class="admin-attendance-course">${r.course_name || 'â€”'}</span></td>
          <td><span class="admin-attendance-date">${r.date || 'â€”'}</span></td>
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
    supabase.from('profiles').select('id, full_name, email'),
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
  setupModalClose('paymentProofModalOverlay', 'paymentProofModalClose', 'paymentProofModalCancel');
  setupPaymentStudentPicker();

  document.getElementById('paymentProofApproveBtn')?.addEventListener('click', () => {
    if (activePaymentProof?.paymentId) window._adminApprovePayment(activePaymentProof.paymentId);
  });
  document.getElementById('paymentProofDeclineBtn')?.addEventListener('click', () => {
    if (activePaymentProof?.paymentId) window._adminDeclinePayment(activePaymentProof.paymentId);
  });

  document.getElementById('addPaymentBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'ADD_PAYMENT')) { toast('Only admins can add payment records.', 'error'); return; }
    openPaymentModal(adminRole, adminId);
  });
  document.getElementById('payModalSave')?.addEventListener('click', () => savePayment(adminRole, adminId));
  document.getElementById('paymentStatusFilter')?.addEventListener('change', () => loadAdminPayments(adminRole, adminId));
  document.getElementById('paymentSearchInput')?.addEventListener('input', debounce(() => loadAdminPayments(adminRole, adminId), 220));
  await loadAdminPayments(adminRole, adminId);
}

function getPaymentStudentPickerParts() {
  const select = document.getElementById('pmStudent');
  const search = document.getElementById('pmStudentSearch');
  const list = document.getElementById('pmStudentList');
  return { select, search, list };
}

function renderPaymentStudentPicker(filterTerm = '') {
  const { select, list } = getPaymentStudentPickerParts();
  if (!select || !list) return;

  const options = Array.from(select.options).filter(option => option.value);
  const normalizedTerm = String(filterTerm || '').toLowerCase().trim();
  const filteredOptions = options.filter(option => {
    const haystack = `${option.textContent || ''} ${option.dataset.email || ''}`.toLowerCase();
    return !normalizedTerm || haystack.includes(normalizedTerm);
  });

  if (!filteredOptions.length) {
    list.innerHTML = '<div class="admin-empty-picker-text">No matching students found.</div>';
    return;
  }

  list.innerHTML = filteredOptions.map(option => {
    const isSelected = String(option.value) === String(select.value);
    return `
      <button type="button" class="admin-payment-student-option${isSelected ? ' is-selected' : ''}" data-value="${option.value}">
        <span class="admin-payment-student-option-name">${option.textContent}</span>
        <span class="admin-payment-student-option-meta">${option.dataset.email || 'Student account'}</span>
      </button>`;
  }).join('');
}

function setupPaymentStudentPicker() {
  const { select, search, list } = getPaymentStudentPickerParts();
  if (!select || !search || !list || list.dataset.bound === 'true') return;

  search.addEventListener('input', () => renderPaymentStudentPicker(search.value));
  list.addEventListener('click', (event) => {
    const option = event.target.closest('[data-value]');
    if (!option || select.disabled) return;
    select.value = option.getAttribute('data-value') || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  select.addEventListener('change', () => renderPaymentStudentPicker(search.value));
  list.dataset.bound = 'true';
}

function hydratePaymentStudentOptions(students = [], selectedId = '', disabled = false) {
  const { select, search } = getPaymentStudentPickerParts();
  if (!select) return;

  select.innerHTML = `<option value="">Select Student...</option>` + (students || []).map(student => {
    const selected = String(student.id) === String(selectedId) ? 'selected' : '';
    const email = student.email ? ` data-email="${escapeHtml(student.email)}"` : '';
    return `<option value="${student.id}"${selected}${email}>${escapeHtml(student.full_name || 'Unnamed Student')}</option>`;
  }).join('');

  select.disabled = disabled;
  if (search) {
    search.value = '';
    search.disabled = disabled;
  }
  renderPaymentStudentPicker('');
}

function normalizePaymentProofRecord(record) {
  if (!record) return null;
  return {
    ...record,
    payment_id: record.payment_id || record.student_payment_id || '',
    proof_url: record.proof_url || record.receipt_url || record.image_url || record.file_url || record.public_url || '',
    payment_method: record.payment_method || record.method || '',
    status_label: record.review_status || record.status || 'Pending',
    submitted_label: record.submitted_at || record.created_at || record.updated_at || '',
  };
}

function hydratePaymentProofState(records = []) {
  paymentProofState.all = (records || [])
    .map(normalizePaymentProofRecord)
    .filter(Boolean)
    .sort((a, b) => new Date(b.submitted_label || 0).getTime() - new Date(a.submitted_label || 0).getTime());
  paymentProofState.byPaymentId = new Map();
  paymentProofState.byReferenceNumber = new Map();

  for (const record of paymentProofState.all) {
    if (!record.payment_id || paymentProofState.byPaymentId.has(record.payment_id)) continue;
    paymentProofState.byPaymentId.set(record.payment_id, record);
  }

  for (const record of paymentProofState.all) {
    const ref = String(record.reference_number || '').trim();
    if (!ref || paymentProofState.byReferenceNumber.has(ref)) continue;
    paymentProofState.byReferenceNumber.set(ref, record);
  }
}

function getPaymentProofRecord(paymentOrId) {
  const payment = typeof paymentOrId === 'object'
    ? paymentOrId
    : paymentState.all.find(item => String(item.id) === String(paymentOrId));

  if (!payment) return null;

  const direct = paymentProofState.byPaymentId.get(payment.id);
  if (direct) return direct;

  const ref = String(payment.reference_number || '').trim();
  if (ref && paymentProofState.byReferenceNumber.has(ref)) {
    return paymentProofState.byReferenceNumber.get(ref) || null;
  }

  return paymentProofState.all.find(record =>
    String(record.payment_id || '') === String(payment.id) ||
    (ref && String(record.reference_number || '').trim() === ref)
  ) || null;
}

function renderPaymentProofPreview(record) {
  const preview = document.getElementById('paymentProofPreview');
  if (!preview) return;

  if (record?.proof_url) {
    preview.innerHTML = `
      <div class="admin-payment-proof-stage">
        <a class="admin-payment-proof-link" href="${record.proof_url}" target="_blank" rel="noopener noreferrer">
          <img src="${record.proof_url}" alt="Payment proof receipt" class="admin-payment-proof-image">
        </a>
      </div>
      <div class="admin-payment-proof-toolbar">
        <a class="admin-text-btn admin-payment-proof-open" href="${record.proof_url}" target="_blank" rel="noopener noreferrer">
          <span class="material-symbols-outlined">open_in_new</span>Open Full Image
        </a>
      </div>`;
    return;
  }

  preview.innerHTML = `
    <div class="admin-payment-proof-empty">
      <span class="material-symbols-outlined">image_not_supported</span>
      <span>No proof image available for this submission.</span>
    </div>`;
}

function openPaymentProofModal(paymentId) {
  const payment = paymentState.all.find(item => String(item.id) === String(paymentId));
  const proof = getPaymentProofRecord(payment) || null;
  if (!payment) return;

  activePaymentProof = { paymentId, proofId: proof?.id || null };
  document.getElementById('paymentProofStudent').textContent = payment.student_name || '—';
  document.getElementById('paymentProofReference').textContent = proof?.reference_number || payment.reference_number || 'No reference number';
  document.getElementById('paymentProofMethod').textContent = proof?.payment_method || 'Manual';
  document.getElementById('paymentProofSubmitted').textContent = proof?.submitted_label ? formatDate(proof.submitted_label) : 'Not submitted';
  renderPaymentProofPreview(proof);

  const shouldShowDecision = payment.status_label === 'Pending';
  const approveBtn = document.getElementById('paymentProofApproveBtn');
  const declineBtn = document.getElementById('paymentProofDeclineBtn');
  if (approveBtn) approveBtn.hidden = !shouldShowDecision;
  if (declineBtn) declineBtn.hidden = !shouldShowDecision;

  openModal('paymentProofModalOverlay');
}

async function updatePaymentProofReviewStatus(proofId, nextStatus, payment = null) {
  const paymentId = payment?.id || '';
  const referenceNumber = String(payment?.reference_number || '').trim();
  const attempts = [
    { review_status: nextStatus },
    { status: nextStatus },
  ];

  for (const payload of attempts) {
    if (proofId) {
      const { error } = await supabase.from('payment_submissions').update(payload).eq('id', proofId);
      if (!error) return true;
    }
    if (paymentId) {
      const { error } = await supabase.from('payment_submissions').update(payload).eq('payment_id', paymentId);
      if (!error) return true;
    }
    if (referenceNumber) {
      const { error } = await supabase.from('payment_submissions').update(payload).eq('reference_number', referenceNumber);
      if (!error) return true;
    }
  }

  return false;
}

async function loadAdminPayments(adminRole, adminId) {
  const tbody = document.getElementById('adminPaymentsBody');
  if (!tbody) return;

  try {
    let query = supabase.from('student_payments').select('*').order('due_date', { ascending: true });
    const statusFilter = document.getElementById('paymentStatusFilter')?.value || 'all';
    const searchTerm = document.getElementById('paymentSearchInput')?.value || '';

    const [{ data: payments, error }, { data: students }, { data: submissions, error: submissionsError }] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name, email'),
      supabase.from('payment_submissions').select('*'),
    ]);
    if (error) throw error;
    if (submissionsError) {
      console.warn('Payment submissions unavailable:', submissionsError.message);
    }

    const studentMap = buildNameMap(students);
    hydratePaymentProofState(submissions || []);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    paymentState.all = (payments || []).map(payment => {
      const proof = getPaymentProofRecord(payment) || null;
      const proofReview = String(proof?.status_label || '').trim();
      const normalizedStatus = String(payment.status || '').trim();
      const isDeclined = proofReview === 'Declined';
      const isPaid = normalizedStatus === 'Paid' || proofReview === 'Approved';
      const isOverdue = !isPaid && !isDeclined && payment.due_date && new Date(payment.due_date) < today;
      return {
        ...payment,
        student_name: payment.student_name || studentMap.get(payment.student_id) || 'Student',
        status_label: isPaid ? 'Paid' : (isDeclined ? 'Declined' : (isOverdue ? 'Overdue' : 'Pending')),
      };
    });

    paymentState.filtered = paymentState.all
      .filter(payment => statusFilter === 'all' || payment.status_label === statusFilter)
      .filter(payment => filterBySearch([payment], searchTerm, ['student_name', 'description', 'status_label', 'reference_number']).length > 0);

    const summaryRow = document.getElementById('adminPaymentSummaryRow');
    if (summaryRow) {
      const totalAmount = paymentState.filtered.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const paidAmount = paymentState.filtered.filter(p => p.status_label === 'Paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
      const pendingAmount = totalAmount - paidAmount;
      summaryRow.innerHTML = `
        <div class="pay-summary-card"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Total Billed</span><span class="pay-card-icon total"><span class="material-symbols-outlined">receipt_long</span></span></div><div class="pay-amount">${formatPeso(totalAmount)}</div></div></div>
        <div class="pay-summary-card green"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Collected</span><span class="pay-card-icon green"><span class="material-symbols-outlined">verified</span></span></div><div class="pay-amount">${formatPeso(paidAmount)}</div></div></div>
        <div class="pay-summary-card red"><div class="pay-card-inner"><div class="pay-card-header"><span class="pay-label">Outstanding</span><span class="pay-card-icon red"><span class="material-symbols-outlined">pending_actions</span></span></div><div class="pay-amount">${formatPeso(pendingAmount)}</div></div></div>`;
    }

    if (!paymentState.filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="admin-loading-cell">No payment records</td></tr>`;
      return;
    }

    tbody.innerHTML = paymentState.filtered.map((p) => {
      const statusLabel = p.status_label;
      const statusClass = { Paid: 'status-submitted', Overdue: 'status-late', Pending: 'status-pending', Declined: 'status-failed' }[statusLabel] || 'status-pending';
      const canEdit = can(adminRole, 'EDIT_PAYMENT');
      const canDel = can(adminRole, 'DELETE_PAYMENT');
      const proof = getPaymentProofRecord(p) || null;
      const canReviewProof = can(adminRole, 'EDIT_PAYMENT') && statusLabel === 'Pending' && !!proof;

      const amountValue = parseFloat(p.amount || 0);
      const dueDate = p.due_date ? new Date(p.due_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      const referenceNumber = proof?.reference_number || p.reference_number || 'No reference number';
      const proofMeta = statusLabel === 'Declined'
        ? 'Proof declined — waiting for student resubmission'
        : (proof?.proof_url ? 'Proof attached for review' : 'Student payment record');
      const proofSubmitted = proof?.submitted_label ? formatDate(proof.submitted_label) : '';

      return `
        <tr data-search="${[p.id, p.student_id, p.student_name, p.description, statusLabel, p.reference_number].join(' ')}">
          <td>
            <div class="admin-payment-primary">
              <span class="admin-payment-student">${p.student_name || '—'}</span>
              <span class="admin-payment-meta">${proofSubmitted ? `${proofMeta} • ${proofSubmitted}` : proofMeta}</span>
            </div>
          </td>
          <td>
            <div class="admin-payment-primary">
              <span class="admin-payment-description">${p.description || '—'}</span>
              <span class="admin-payment-reference">Ref # ${referenceNumber}</span>
            </div>
          </td>
          <td>
            <div class="admin-payment-primary">
              <span class="admin-payment-amount">${formatPeso(amountValue)}</span>
              <span class="admin-payment-meta">Recorded amount</span>
            </div>
          </td>
          <td>
            <div class="admin-payment-primary">
              <span class="admin-payment-date">${dueDate}</span>
              <span class="admin-payment-meta">${createdDate ? `Created ${createdDate}` : 'Schedule pending'}</span>
            </div>
          </td>
          <td><span class="deadline-status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <div class="admin-row-actions">
              ${proof ? `<button type="button" class="admin-icon-btn view" title="Review payment proof" onclick="window._adminReviewPaymentProof('${p.id}')">
                <span class="material-symbols-outlined">image_search</span>
              </button>` : ''}
              ${canReviewProof ? `<button type="button" class="admin-icon-btn approve" title="Approve submitted proof" onclick="window._adminApprovePayment('${p.id}')">
                <span class="material-symbols-outlined">check_circle</span>
              </button>` : ''}
              ${canReviewProof ? `<button type="button" class="admin-icon-btn reject" title="Decline submitted proof" onclick="window._adminDeclinePayment('${p.id}')">
                <span class="material-symbols-outlined">cancel</span>
              </button>` : ''}
              ${canEdit ? `<button type="button" class="admin-icon-btn edit" title="Edit" onclick="window._adminEditPayment('${p.id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>` : ''}
              ${canDel ? `<button type="button" class="admin-icon-btn delete" title="Delete billing record" onclick="window._adminDeletePayment('${p.id}')">
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
  const { data: students } = await supabase.from('profiles').select('id, full_name, email');
  hydratePaymentStudentOptions(students || [], '', false);
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
  const students = (await supabase.from('profiles').select('id, full_name, email')).data || [];
  hydratePaymentStudentOptions(students, p.student_id, true);
  document.getElementById('pmStudent').disabled = true;
  document.getElementById('pmDescription').value = p.description || '';
  document.getElementById('pmAmount').value = p.amount || '';
  document.getElementById('pmDueDate').value = p.due_date || '';
  document.getElementById('pmStatus').value = p.status === 'Paid' ? 'Paid' : 'Pending';
  openModal('paymentAdminModalOverlay');
};

async function savePayment(adminRole, adminId) {
  const btn = document.getElementById('payModalSave');
  const studentId = document.getElementById('pmStudent')?.value;
  const description = document.getElementById('pmDescription')?.value.trim();
  const amount = parseFloat(document.getElementById('pmAmount')?.value || 0);
  const dueDate = document.getElementById('pmDueDate')?.value;
  const rawStatus = document.getElementById('pmStatus')?.value || 'Pending';
  const status = rawStatus === 'Paid' ? 'Paid' : 'Pending';

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
  const payment = paymentState.all.find(item => String(item.id) === String(payId)) || null;
  try {
    const proof = getPaymentProofRecord(payment || payId);

    if (proof?.id) {
      const { error: proofDeleteError } = await supabase.from('payment_submissions').delete().eq('id', proof.id);
      if (proofDeleteError) throw proofDeleteError;
    } else {
      const referenceNumber = String(payment?.reference_number || '').trim();
      const deleteFilters = [];

      deleteFilters.push(supabase.from('payment_submissions').delete().eq('payment_id', payId));
      if (referenceNumber) {
        deleteFilters.push(supabase.from('payment_submissions').delete().eq('reference_number', referenceNumber));
      }

      for (const request of deleteFilters) {
        const { error: linkedDeleteError } = await request;
        if (linkedDeleteError) throw linkedDeleteError;
      }
    }

    const { error } = await supabase.from('student_payments').delete().eq('id', payId);
    if (error) throw error;

    toast('Payment record deleted.', 'success');
    logActivity('Deleted payment record');
    const role = adminProfile?.role || 'admin';
    await loadAdminPayments(role, adminUser?.id);
    await syncOverviewAnalytics();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, 'error');
  }
};

window._adminReviewPaymentProof = function (payId) {
  openPaymentProofModal(payId);
};

window._adminApprovePayment = async function (payId) {
  const payment = paymentState.all.find(item => String(item.id) === String(payId)) || null;
  const { error } = await supabase.from('student_payments').update({ status: 'Paid' }).eq('id', payId);
  if (error) { toast(`Approval failed: ${error.message}`, 'error'); return; }
  const proof = activePaymentProof?.paymentId === payId
    ? { id: activePaymentProof?.proofId || null }
    : getPaymentProofRecord(payment);
  const proofUpdated = await updatePaymentProofReviewStatus(proof?.id || null, 'Approved', payment);
  if (!proofUpdated) {
    toast('Payment marked as paid, but the proof review row could not be updated.', 'warning');
  }
  toast('Payment approved.', 'success');
  logActivity('Approved payment submission');
  closeModal('paymentProofModalOverlay');
  activePaymentProof = null;
  const role = adminProfile?.role || 'admin';
  await loadAdminPayments(role, adminUser?.id);
  await syncOverviewAnalytics();
};

window._adminDeclinePayment = async function (payId) {
  const payment = paymentState.all.find(item => String(item.id) === String(payId)) || null;
  const { error } = await supabase.from('student_payments').update({ status: 'Pending' }).eq('id', payId);
  if (error) { toast(`Decline failed: ${error.message}`, 'error'); return; }
  const proof = activePaymentProof?.paymentId === payId
    ? { id: activePaymentProof?.proofId || null }
    : getPaymentProofRecord(payment);
  const proofUpdated = await updatePaymentProofReviewStatus(proof?.id || null, 'Declined', payment);
  if (!proofUpdated) {
    toast('Decline action ran, but no matching proof submission row was updated.', 'warning');
    return;
  }
  toast('Payment declined.', 'success');
  logActivity('Declined payment submission');
  closeModal('paymentProofModalOverlay');
  activePaymentProof = null;
  const role = adminProfile?.role || 'admin';
  await loadAdminPayments(role, adminUser?.id);
  await syncOverviewAnalytics();
};


