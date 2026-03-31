// =============================================================================
// adminCourses.js — Course / Subject Management Module
// RBAC: Admin = full CRUD | Instructor = enroll students in their courses only
// =============================================================================

import { supabase, can, ROLES } from '../config.js';
import {
  toast, openModal, closeModal, setupModalClose,
  confirmDelete, filterBySearch, escapeHtml,
  avatarUrl, logActivity, debounce
} from '../utils.js';

const state = {
  allCourses: [],
  allStudents: [],
  allInstructors: [],
  currentRole: 'admin',
  currentUserId: null,
  editingId: null,
};

function setupUnitsStepper() {
  const input = document.getElementById('cmUnits');
  const decrementBtn = document.getElementById('cmUnitsDecrement');
  const incrementBtn = document.getElementById('cmUnitsIncrement');

  if (!input || !decrementBtn || !incrementBtn || input.dataset.stepperBound === 'true') return;

  const applyDelta = (delta) => {
    const min = parseInt(input.min || '1', 10);
    const max = parseInt(input.max || '99', 10);
    const current = parseInt(input.value || input.placeholder || String(min), 10);
    const nextValue = Math.min(max, Math.max(min, (Number.isNaN(current) ? min : current) + delta));
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  decrementBtn.addEventListener('click', () => applyDelta(-1));
  incrementBtn.addEventListener('click', () => applyDelta(1));
  input.dataset.stepperBound = 'true';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initCourses(adminRole, adminId) {
  state.currentRole = adminRole;
  state.currentUserId = adminId;

  setupModalClose('courseModalOverlay', 'courseModalClose', 'courseModalCancel');
  setupUnitsStepper();

  document.getElementById('createCourseBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'CREATE_COURSE')) {
      toast('Only admins can create courses.', 'error'); return;
    }
    openCreateModal();
  });

  document.getElementById('courseModalSave')?.addEventListener('click', saveCourse);

  const debouncedCourseSearch = debounce((value) => {
    renderCoursesGrid(filterBySearch(state.allCourses, value, ['course_name', 'course_code', 'instructor_name']));
  }, 220);

  document.getElementById('courseSearchInput')?.addEventListener('input', e => {
    debouncedCourseSearch(e.target.value);
  });

  await Promise.all([loadCourses(), loadPeople()]);
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
export async function loadCourses() {
  const grid = document.getElementById('adminCoursesGrid');
  try {
    let query = supabase.from('student_courses').select('*').order('course_name');

    // Instructors only see their own courses
    if (state.currentRole === ROLES.TEACHER) {
      query = query.eq('instructor_id', state.currentUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Deduplicate by course_code
    const seen = new Set();
    state.allCourses = (data || []).filter(c => {
      const key = c.course_code || c.course_name;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    renderCoursesGrid(state.allCourses);
  } catch (err) {
    console.error('Courses load error:', err.message);
    if (grid) grid.innerHTML = `<div class="admin-empty-state"><p class="admin-inline-error">Failed to load courses.</p></div>`;
  }
}

async function loadPeople() {
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role, email, avatar_url');
  if (profiles) {
    state.allStudents = profiles.filter(p => p.role === ROLES.STUDENT);
    state.allInstructors = profiles.filter(p => p.role === ROLES.TEACHER || p.role === ROLES.ADMIN);
  }
}

// ─── Render Grid ──────────────────────────────────────────────────────────────
function renderCoursesGrid(courses) {
  const grid = document.getElementById('adminCoursesGrid');
  if (!grid) return;

  if (!courses?.length) {
    grid.innerHTML = `
      <div class="admin-empty-state admin-empty-courses">
        <div class="admin-empty-icon">📚</div>
        <h3>No courses found</h3>
        <p>Create your first course to get started</p>
        ${can(state.currentRole, 'CREATE_COURSE') ? `<button class="admin-btn admin-btn-primary" onclick="document.getElementById('createCourseBtn').click()">+ Add Course</button>` : ''}
      </div>`;
    return;
  }

  const ICONS = ['📘', '🧪', '📐', '💻', '📊', '🎨', '🌐', '📝', '🔬', '📖'];

  grid.innerHTML = courses.map((course, idx) => {
    const icon = ICONS[idx % ICONS.length];
    const progress = course.progress || 0;
    const color = course.color_theme || 'var(--primary)';
    const canEdit = can(state.currentRole, 'CREATE_COURSE') ||
      (state.currentRole === ROLES.TEACHER && course.instructor_id === state.currentUserId);
    const canDel = can(state.currentRole, 'DELETE_COURSE');

    return `
      <div class="course-card admin-course-card" data-search="${escapeHtml([course.course_name, course.course_code, course.instructor_name].filter(Boolean).join(' '))}" style="animation: slideInRight 0.4s ease forwards ${idx * 0.05}s; opacity:0;">
        <div class="course-card-top-bar" style="background:${color};"></div>
        <div class="course-card-body">
          <div class="course-card-header">
            <div class="course-card-icon">${icon}</div>
            <span class="course-card-code">${escapeHtml(course.course_code || 'N/A')}</span>
          </div>
          <h3>${escapeHtml(course.course_name)}</h3>
          <p class="instructor-name">
            <span class="material-symbols-outlined">person</span>
            ${escapeHtml(course.instructor_name || 'Unassigned')}
          </p>
          <div class="course-progress-label">
            <span>Completion</span><span>${progress}%</span>
          </div>
          <div class="course-progress-bar">
            <div class="course-progress-fill" style="width:${progress}%; background:${color};"></div>
          </div>
        </div>
        <div class="course-card-footer">
          <span class="course-units-label">${course.units || 0} Units</span>
          <div class="admin-course-actions">
            ${canEdit ? `<button class="admin-icon-btn edit" title="Edit course" onclick="window._adminEditCourse('${course.id}')">
              <span class="material-symbols-outlined">edit</span>
            </button>` : ''}
            ${canDel ? `<button class="admin-icon-btn delete" title="Delete course" onclick="window._adminDeleteCourse('${course.id}', '${escapeHtml(course.course_name)}')">
              <span class="material-symbols-outlined">delete</span>
            </button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function openCreateModal() {
  state.editingId = null;
  document.getElementById('courseModalTitle').textContent = 'Add New Course';
  const form = document.getElementById('courseModalForm');
  form.reset();
  form.scrollTop = 0;
  populateInstructorDropdown();
  populateStudentEnrollList([]);
  const studentSearch = document.getElementById('cmStudentSearch');
  if (studentSearch) studentSearch.value = '';
  const unitsInput = document.getElementById('cmUnits');
  if (unitsInput && !unitsInput.value) unitsInput.value = unitsInput.placeholder || '3';
  openModal('courseModalOverlay');
}

window._adminEditCourse = function (courseId) {
  const course = state.allCourses.find(c => c.id === courseId);
  if (!course) return;

  if (state.currentRole === ROLES.TEACHER && course.instructor_id !== state.currentUserId) {
    toast('You can only edit courses assigned to you.', 'error'); return;
  }

  state.editingId = courseId;
  document.getElementById('courseModalTitle').textContent = 'Edit Course';
  document.getElementById('cmCourseName').value = course.course_name || '';
  document.getElementById('cmCourseCode').value = course.course_code || '';
  document.getElementById('cmUnits').value = course.units || '';
  document.getElementById('courseModalForm').scrollTop = 0;
  const studentSearch = document.getElementById('cmStudentSearch');
  if (studentSearch) studentSearch.value = '';

  populateInstructorDropdown(course.instructor_id);
  populateStudentEnrollList([], course);
  openModal('courseModalOverlay');
};

function populateInstructorDropdown(selectedId = '') {
  const select = document.getElementById('cmInstructor');
  if (!select) return;

  // Instructors cannot reassign instructor (only admins)
  if (state.currentRole === ROLES.TEACHER) {
    select.disabled = true;
    select.innerHTML = `<option value="${state.currentUserId}">Yourself (Instructor)</option>`;
    return;
  }

  select.disabled = false;
  select.innerHTML = `<option value="">Select Instructor...</option>` +
    state.allInstructors.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${escapeHtml(i.full_name)}</option>`).join('');
}

function populateStudentEnrollList(enrolledIds = [], course = null) {
  const container = document.getElementById('cmStudentEnrollList');
  if (!container) return;

  if (!state.allStudents.length) {
    container.innerHTML = '<p class="admin-empty-picker-text">No students available.</p>';
    return;
  }

  container.innerHTML = state.allStudents.map(s => `
    <label class="admin-enroll-item admin-student-row" for="enroll_${s.id}" data-student-name="${escapeHtml(s.full_name).toLowerCase()}">
      <input class="admin-student-check" type="checkbox" id="enroll_${s.id}" value="${s.id}" ${enrolledIds.includes(s.id) ? 'checked' : ''}>
      <img src="${avatarUrl(s.full_name, s.avatar_url)}" class="admin-student-avatar" alt="${escapeHtml(s.full_name)}" onerror="this.src='https://ui-avatars.com/api/?name=S&background=2563eb&color=fff'">
      <span class="admin-student-meta">
        <span class="admin-student-name">${escapeHtml(s.full_name)}</span>
        <span class="admin-student-subtitle">${escapeHtml(s.email || 'Student')}</span>
      </span>
      <span class="admin-student-check-ui" aria-hidden="true">
        <span class="material-symbols-outlined">check</span>
      </span>
    </label>
  `).join('');

  updateSelectAllButtonLabel();
}

function updateSelectAllButtonLabel() {
  const selectAllBtn = document.getElementById('cmSelectAllBtn');
  const checkboxes = Array.from(document.querySelectorAll('#cmStudentEnrollList input[type="checkbox"]'));
  if (!selectAllBtn || checkboxes.length === 0) return;

  const allChecked = checkboxes.every(cb => cb.checked);
  selectAllBtn.textContent = allChecked ? 'Clear All' : 'Select All';
}

// ─── Save Course ──────────────────────────────────────────────────────────────
async function saveCourse() {
  const btn = document.getElementById('courseModalSave');
  const courseName = document.getElementById('cmCourseName')?.value.trim();
  const courseCode = document.getElementById('cmCourseCode')?.value.trim();
  const units = parseInt(document.getElementById('cmUnits')?.value || 0);
  const instructorId = document.getElementById('cmInstructor')?.value;

  if (!courseName) { toast('Course name is required.', 'error'); return; }

  const instructorProfile = state.allInstructors.find(i => i.id === instructorId);
  const instructorName = instructorProfile?.full_name || 'TBA';

  const checkedStudents = Array.from(
    document.querySelectorAll('#cmStudentEnrollList input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  btn.textContent = 'Saving...'; btn.disabled = true;

  try {
    if (state.editingId) {
      // Update course for all enrolled students
      const { error } = await supabase
        .from('student_courses')
        .update({ course_name: courseName, course_code: courseCode, units, instructor_name: instructorName, instructor_id: instructorId || null })
        .eq('id', state.editingId);
      if (error) throw error;
      toast('Course updated!', 'success');
      logActivity(`Updated course: ${courseName}`);
    } else {
      // Create rows for each enrolled student
      if (checkedStudents.length === 0) {
        toast('Please enroll at least one student.', 'error');
        btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Course'; btn.disabled = false;
        return;
      }

      const inserts = checkedStudents.map(studentId => ({
        student_id: studentId,
        course_name: courseName,
        course_code: courseCode,
        units,
        instructor_name: instructorName,
        instructor_id: instructorId || null,
        progress: 0,
        color_theme: 'var(--primary)',
      }));

      const { error } = await supabase.from('student_courses').insert(inserts);
      if (error) throw error;
      toast(`Course created and ${checkedStudents.length} student(s) enrolled!`, 'success');
      logActivity(`Created course: ${courseName} with ${checkedStudents.length} students`);
    }

    closeModal('courseModalOverlay');
    await loadCourses();
  } catch (err) {
    console.error('Save course error:', err.message);
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Course';
    btn.disabled = false;
  }
}

// ─── Delete Course ────────────────────────────────────────────────────────────
window._adminDeleteCourse = async function (courseId, courseName) {
  if (!can(state.currentRole, 'DELETE_COURSE')) {
    toast('Only admins can delete courses.', 'error'); return;
  }

  const confirmed = await confirmDelete(
    'Delete Course',
    `Delete "${courseName}"? This will remove all enrollment records for this course.`
  );
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('student_courses').delete().eq('id', courseId);
    if (error) throw error;
    toast(`"${courseName}" deleted.`, 'success');
    logActivity(`Deleted course: ${courseName}`);
    await loadCourses();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, 'error');
  }
};

export function getCourseStats() {
  return { total: state.allCourses.length, all: state.allCourses };
}   

document.getElementById('cmSelectAllBtn')?.addEventListener('click', () => {
  const checkboxes = document.querySelectorAll('#cmStudentEnrollList input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);

  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
  });

  updateSelectAllButtonLabel();
});

document.getElementById('cmStudentEnrollList')?.addEventListener('change', (event) => {
  if (!event.target.matches('input[type="checkbox"]')) return;
  updateSelectAllButtonLabel();
});

// Live Search for Student Enrollment
  document.getElementById('cmStudentSearch')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const studentItems = document.querySelectorAll('#cmStudentEnrollList .admin-enroll-item');
    
    studentItems.forEach(item => {
      const studentName = item.dataset.studentName || item.querySelector('label').textContent.toLowerCase();
      
      if (studentName.includes(searchTerm)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });
