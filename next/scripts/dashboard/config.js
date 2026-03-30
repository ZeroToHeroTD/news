// =============================================================================
// admin/config.js — Supabase Client (Shared with student dashboard)
// Reuses the same project credentials — no new Supabase project needed.
// =============================================================================

export const SUPABASE_URL = "https://ekayczuyxmhbiyvyjwad.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
export const supabaseClient = supabase;

// =============================================================================
// ROLE CONSTANTS
// =============================================================================
export const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student'
};

// =============================================================================
// RBAC PERMISSION MATRIX
// Defines exactly what each role can do.
// =============================================================================
export const PERMISSIONS = {
  // User management
  CREATE_USER:       [ROLES.ADMIN],
  DELETE_USER:       [ROLES.ADMIN],
  EDIT_ANY_USER:     [ROLES.ADMIN],
  EDIT_OWN_PROFILE:  [ROLES.ADMIN, ROLES.TEACHER],
  ASSIGN_ROLES:      [ROLES.ADMIN],
  VIEW_USERS:        [ROLES.ADMIN, ROLES.TEACHER],

  // Course management
  CREATE_COURSE:     [ROLES.ADMIN],
  DELETE_COURSE:     [ROLES.ADMIN],
  ASSIGN_INSTRUCTOR: [ROLES.ADMIN],
  ENROLL_STUDENT:    [ROLES.ADMIN, ROLES.TEACHER],
  VIEW_COURSES:      [ROLES.ADMIN, ROLES.TEACHER],

  // Grades
  EDIT_ANY_GRADE:    [ROLES.ADMIN],
  EDIT_OWN_GRADES:   [ROLES.ADMIN, ROLES.TEACHER], // teacher can only edit their students
  VIEW_ALL_GRADES:   [ROLES.ADMIN],
  VIEW_OWN_GRADES:   [ROLES.TEACHER],
  ADD_GRADE:         [ROLES.ADMIN, ROLES.TEACHER],

  // Attendance
  LOG_ATTENDANCE:    [ROLES.ADMIN, ROLES.TEACHER],
  EDIT_ATTENDANCE:   [ROLES.ADMIN, ROLES.TEACHER],
  VIEW_ATTENDANCE:   [ROLES.ADMIN, ROLES.TEACHER],

  // Announcements
  CREATE_ANN:        [ROLES.ADMIN, ROLES.TEACHER],
  DELETE_ANY_ANN:    [ROLES.ADMIN],
  DELETE_OWN_ANN:    [ROLES.TEACHER],
  EDIT_ANY_ANN:      [ROLES.ADMIN],
  EDIT_OWN_ANN:      [ROLES.TEACHER],
  ANN_ALL_USERS:     [ROLES.ADMIN],      // broadcast to everyone
  ANN_OWN_STUDENTS:  [ROLES.TEACHER],    // teacher can only target their students

  // Settings
  VIEW_SETTINGS:     [ROLES.ADMIN],
  EDIT_SETTINGS:     [ROLES.ADMIN],
  VIEW_ACTIVITY_LOG: [ROLES.ADMIN],

  // Payments
  ADD_PAYMENT:       [ROLES.ADMIN],
  EDIT_PAYMENT:      [ROLES.ADMIN],
  DELETE_PAYMENT:    [ROLES.ADMIN],
  VIEW_PAYMENTS:     [ROLES.ADMIN, ROLES.TEACHER],
};

/**
 * Check if a role has a specific permission.
 * @param {string} role  - The user's role (admin, teacher, student)
 * @param {string} permission - Key from PERMISSIONS
 * @returns {boolean}
 */
export function can(role, permission) {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role);
}