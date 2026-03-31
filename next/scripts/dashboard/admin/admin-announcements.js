// =============================================================================
// adminAnnouncements.js — Announcement Management Module
// RBAC: Admin = full control | Instructor = own announcements only
// =============================================================================

import { supabase, can, ROLES } from '../config.js';
import {
  toast, openModal, closeModal, setupModalClose,
  confirmDelete, formatDate, getTimeAgo,
  escapeHtml, logActivity, filterBySearch, debounce
} from '../utils.js';

const state = {
  allAnnouncements: [],
  currentRole: 'admin',
  currentUserId: null,
  currentUserName: '',
  editingId: null,
};

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initAnnouncements(adminRole, adminId, adminName = 'Admin') {
  state.currentRole = adminRole;
  state.currentUserId = adminId;
  state.currentUserName = adminName;

  setupModalClose('annModalOverlay', 'annModalClose', 'annModalCancel');

  document.getElementById('createAnnBtn')?.addEventListener('click', () => {
    if (!can(adminRole, 'CREATE_ANN')) {
      toast('You do not have permission to create announcements.', 'error'); return;
    }
    openCreateModal();
  });

  document.getElementById('annModalSave')?.addEventListener('click', saveAnnouncement);

  document.getElementById('annAudienceFilter')?.addEventListener('change', applyFilters);
  document.getElementById('annSearchInput')?.addEventListener('input', debounce(applyFilters, 220));

  // Instructors cannot broadcast to everyone, restrict audience dropdown
  if (adminRole === ROLES.TEACHER) {
    const audienceGroup = document.getElementById('annAudienceGroup');
    const annAudience = document.getElementById('annAudience');
    if (annAudience) {
      annAudience.innerHTML = `<option value="students">My Students</option>`;
      annAudience.disabled = true;
    }
  }

  await loadAnnouncements();
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
export async function loadAnnouncements() {
  try {
    let query = supabase
      .from('portal_messages')
      .select('*')
      .is('receiver_id', null) // Announcements have no specific receiver
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    // Instructors only see their own announcements
    if (state.currentRole === ROLES.TEACHER) {
      state.allAnnouncements = (data || []).filter(a => a.sender_id === state.currentUserId);
    } else {
      state.allAnnouncements = data || [];
    }

    applyFilters();
  } catch (err) {
    console.error('Announcements load error:', err.message);
    toast('Failed to load announcements.', 'error');
  }
}

function applyFilters() {
  const audienceFilter = document.getElementById('annAudienceFilter')?.value || 'all';
  const searchTerm = document.getElementById('annSearchInput')?.value || '';
  let filtered = [...state.allAnnouncements];

  if (audienceFilter !== 'all') {
    filtered = filtered.filter(a => (a.audience || 'all') === audienceFilter);
  }

  if (searchTerm.trim()) {
    filtered = filterBySearch(filtered, searchTerm, ['subject', 'content', 'sender_name', 'audience']);
  }

  renderAnnouncementsGrid(filtered);
}

// ─── Render Grid ──────────────────────────────────────────────────────────────
function renderAnnouncementsGrid(announcements) {
  const grid = document.getElementById('announcementsGrid');
  if (!grid) return;

  if (!announcements.length) {
    grid.innerHTML = `
      <div class="admin-empty-state" style="grid-column:1/-1; background:var(--card-bg); border-radius:20px; border:1px dashed var(--border-color);">
        <div class="admin-empty-icon">📢</div>
        <h3>No announcements yet</h3>
        <p>Create your first announcement to notify students and instructors</p>
      </div>`;
    return;
  }

  const audienceColors = {
    all: { bg: 'var(--primary-soft)', color: 'var(--primary)', label: 'Everyone' },
    students: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'Students Only' },
    instructors: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7', label: 'Instructors Only' },
  };

  grid.innerHTML = announcements.map((ann, idx) => {
    const aud = audienceColors[ann.audience || 'all'] || audienceColors.all;
    const isOwn = ann.sender_id === state.currentUserId;
    const canEdit = can(state.currentRole, 'EDIT_ANY_ANN') || (can(state.currentRole, 'EDIT_OWN_ANN') && isOwn);
    const canDel = can(state.currentRole, 'DELETE_ANY_ANN') || (can(state.currentRole, 'DELETE_OWN_ANN') && isOwn);

    return `
      <div class="admin-ann-card admin-ann-feed-card" data-search="${escapeHtml([ann.subject, ann.content, ann.sender_name, ann.audience].filter(Boolean).join(' '))}" style="animation: slideInRight 0.35s ease forwards ${idx * 0.04}s; opacity:0;">
        <div class="admin-ann-card-top">
          <h4 class="admin-ann-title">${escapeHtml(ann.subject || 'Untitled')}</h4>
          <span class="admin-ann-audience" style="background:${aud.bg}; color:${aud.color}; border-color:${aud.color}33;">
            ${aud.label}
          </span>
        </div>
        <p class="admin-ann-body">${escapeHtml(ann.content || '')}</p>
        <div class="admin-ann-footer">
          <div>
            <div class="admin-ann-meta">
              <span class="material-symbols-outlined" style="font-size:14px;">person</span>
              ${escapeHtml(ann.sender_name || 'Admin')}
            </div>
            <div class="admin-ann-meta" style="margin-top:4px;">
              <span class="material-symbols-outlined" style="font-size:14px;">schedule</span>
              ${getTimeAgo(ann.created_at)}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            ${canEdit ? `<button class="admin-icon-btn edit" title="Edit" onclick="window._adminEditAnn('${ann.id}')">
              <span class="material-symbols-outlined">edit</span>
            </button>` : ''}
            ${canDel ? `<button class="admin-icon-btn delete" title="Delete" onclick="window._adminDeleteAnn('${ann.id}', '${escapeHtml(ann.subject)}')">
              <span class="material-symbols-outlined">delete</span>
            </button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ─── Create Modal ─────────────────────────────────────────────────────────────
function openCreateModal() {
  state.editingId = null;
  document.getElementById('annModalTitle').textContent = 'New Announcement';
  document.getElementById('annSubject').value = '';
  document.getElementById('annContent').value = '';
  if (state.currentRole === ROLES.ADMIN) {
    const aud = document.getElementById('annAudience');
    if (aud) aud.value = 'all';
  }
  openModal('annModalOverlay');
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
window._adminEditAnn = function (annId) {
  const ann = state.allAnnouncements.find(a => String(a.id) === String(annId));
  if (!ann) return;

  const isOwn = ann.sender_id === state.currentUserId;
  if (state.currentRole === ROLES.TEACHER && !isOwn) {
    toast('You can only edit your own announcements.', 'error'); return;
  }

  state.editingId = annId;
  document.getElementById('annModalTitle').textContent = 'Edit Announcement';
  document.getElementById('annSubject').value = ann.subject || '';
  document.getElementById('annContent').value = ann.content || '';
  const aud = document.getElementById('annAudience');
  if (aud && state.currentRole === ROLES.ADMIN) aud.value = ann.audience || 'all';

  openModal('annModalOverlay');
};

// ─── Save Announcement ────────────────────────────────────────────────────────
async function saveAnnouncement() {
  const btn = document.getElementById('annModalSave');
  const subject = document.getElementById('annSubject')?.value.trim();
  const content = document.getElementById('annContent')?.value.trim();
  const audience = document.getElementById('annAudience')?.value || 'all';

  if (!subject || !content) { toast('Subject and content are required.', 'error'); return; }

  btn.textContent = 'Publishing...'; btn.disabled = true;

  try {
    if (state.editingId) {
      const { error } = await supabase
        .from('portal_messages')
        .update({ subject, content, audience })
        .eq('id', state.editingId);
      if (error) throw error;
      toast('Announcement updated!', 'success');
      logActivity(`Updated announcement: "${subject}"`);
    } else {
      const { error } = await supabase.from('portal_messages').insert([{
        sender_id: state.currentUserId,
        sender_name: state.currentUserName,
        subject,
        content,
        receiver_id: null, // null = announcement (not a DM)
        audience,
        is_read: false,
      }]);
      if (error) throw error;
      toast('Announcement published!', 'success');
      logActivity(`Published announcement: "${subject}" → ${audience}`);
    }

    closeModal('annModalOverlay');
    await loadAnnouncements();
  } catch (err) {
    console.error('Announcement save error:', err.message);
    toast(`Error: ${err.message}`, 'error');
  } finally {
    btn.innerHTML = '<span class="material-symbols-outlined">campaign</span> Publish';
    btn.disabled = false;
  }
}

// ─── Delete Announcement ──────────────────────────────────────────────────────
window._adminDeleteAnn = async function (annId, annTitle) {
  const ann = state.allAnnouncements.find(a => String(a.id) === String(annId));
  if (!ann) return;

  const isOwn = ann.sender_id === state.currentUserId;
  if (state.currentRole === ROLES.TEACHER && !isOwn) {
    toast('You can only delete your own announcements.', 'error'); return;
  }

  const confirmed = await confirmDelete(
    'Delete Announcement',
    `Delete "${annTitle}"? All students who received it will no longer see it.`
  );
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('portal_messages').delete().eq('id', annId);
    if (error) throw error;
    toast('Announcement deleted.', 'success');
    logActivity(`Deleted announcement: "${annTitle}"`);
    await loadAnnouncements();
  } catch (err) {
    toast(`Delete failed: ${err.message}`, 'error');
  }
};
