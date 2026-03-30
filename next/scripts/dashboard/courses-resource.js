// =============================================================================
// courses-resources-premium.js
// Combined Module: Core Grid Loaders + Premium UI Enhancements
// =============================================================================

import { supabase as supabaseClient } from './config.js';
import { escapeAttr } from './utils.js';

// Premium cycling icon set for course cards
const COURSE_ICONS = ['📘', '🧪', '📐', '💻', '📊', '🎨', '🌐', '📝'];

/**
 * Loads the student's enrolled courses.
 */
export async function loadCoursesData(userId) {
    const container = document.getElementById('db-courses-container');
    const countDisplay = document.getElementById('courseCount');
    if (!container) return;

    try {
        const { data: courses, error } = await supabaseClient
            .from('student_courses')
            .select('id, course_name, course_code, progress, color_theme, instructor_name, instructor_id, units')
            .eq('student_id', userId);

        if (error) throw error;
        if (countDisplay) countDisplay.textContent = courses?.length || 0;

        if (!courses || courses.length === 0) {
            container.innerHTML = `<div class="empty-state">No Enrolled Courses Found.</div>`;
            return;
        }

        container.innerHTML = courses.map((course, idx) => {
            const progressValue = course.progress || 0;
            const color = course.color_theme || 'var(--primary)';
            const icon = COURSE_ICONS[idx % COURSE_ICONS.length];
            const instructorName = course.instructor_name || 'Instructor TBA';
            const instructorId = course.instructor_id;
            
            const canMessage = !!instructorId;

            return `
            <div class="course-card" style="animation: slideInRight 0.5s ease forwards ${idx * 0.08}s; opacity: 0;">
                <div class="course-card-top-bar" style="background: ${color};"></div>
                <div class="course-card-body">
                    <div class="course-card-header">
                        <div class="course-card-icon">${icon}</div>
                        <span class="course-card-code">${course.course_code || 'CODE'}</span>
                    </div>
                    <h3>${course.course_name}</h3>
                    <p class="instructor-name">
                        <span class="material-symbols-outlined" style="font-size:1.1rem; color:var(--primary);">person</span>
                        ${instructorName}
                    </p>
                    <div class="course-progress-label">
                        <span>Progress</span><span>${progressValue}%</span>
                    </div>
                    <div class="course-progress-bar">
                        <div class="course-progress-fill" data-target="${progressValue}" style="width: 0%; background: ${color};"></div>
                    </div>
                </div>
                <div class="course-card-footer">
                    <span class="course-units-label">${course.units || 0} Units</span>
                    
                    ${canMessage ? `
                        <button class="msg-instructor-btn" 
                                onclick="window.openComposeToInstructor('${escapeAttr(instructorName)}', '${instructorId}', 'Query: ${escapeAttr(course.course_name)}')">
                            <span class="material-symbols-outlined">send</span> Message
                        </button>
                    ` : `
                        <button class="msg-instructor-btn" style="opacity: 0.5; cursor: not-allowed;" disabled>
                            <span class="material-symbols-outlined">block</span> N/A
                        </button>
                    `}
                </div>
            </div>`;
        }).join('');

        setTimeout(() => {
            container.querySelectorAll('.course-progress-fill').forEach(bar => {
                bar.style.width = bar.getAttribute('data-target') + '%';
            });
        }, 100);

    } catch (err) {
        console.error("Courses load error:", err.message);
        container.innerHTML = `<p style="color:var(--accent-red); padding:20px;">Error loading courses: ${err.message}</p>`;
    }
}

/**
 * Loads portal resources (files)
 */
export async function loadResources() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    try {
        const { data: files, error } = await supabaseClient
            .from('portal_resources')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!files || files.length === 0) {
            grid.innerHTML = `<div class="empty-state">No Resources Found</div>`;
            return;
        }

        grid.innerHTML = files.map((file, idx) => {
            const ext = (file.file_type || 'other').toLowerCase().trim();
            const iconMap = { pdf: '📕', docx: '📘', pptx: '📙', xlsx: '📗' };
            const icon = iconMap[ext] || '📁';
            const rawDate = file.created_at
                ? new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Unknown Date';

            return `
            <div class="resource-card" style="animation: cardEntrance 0.5s ease forwards ${idx * 0.05}s; opacity: 0;" onclick="window.open('${file.file_url}', '_blank')">
                <div class="resource-card-preview">${icon}</div>
                <div class="resource-card-body">
                    <h4>${file.title}</h4>
                    <span class="resource-type-badge">${ext.toUpperCase()}</span>
                </div>
                <div class="resource-card-footer">
                    <span class="resource-date">${rawDate}</span>
                    <button class="resource-open-btn">
                        Open <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>`;
        }).join('');
        
    } catch (err) {
        console.error("Resources load error:", err.message);
        grid.innerHTML = `<p style="color:var(--accent-red);">Failed to load resources.</p>`;
    }
}

// =============================================================================
// Premium UX Overlay Enhancements
// Automatically bootstraps overlay functions safely.
// =============================================================================

(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* -----------------------------------------------------------------------
     1. HERO SECTION
  ----------------------------------------------------------------------- */
  function buildHero() {
    const section = document.getElementById('view-resources');
    if (!section) return;
    if (section.querySelector('.resources-hero')) return; 

    const userName = (
      document.getElementById('sidebarUserName')?.textContent ||
      document.getElementById('topbarName')?.textContent ||
      'Student'
    ).replace('Loading...', 'Student').split(' ')[0];

    const hero = document.createElement('div');
    hero.className = 'resources-hero';
    hero.innerHTML = `
      <div class="resources-hero-inner">
        <div class="resources-hero-text">
          <p class="resources-hero-greeting">${getGreeting()}, ${userName}</p>
          <h1 class="resources-hero-title">
            Academic <span>Resources</span>
          </h1>
          <p class="resources-hero-sub">All your study files, organized and ready.</p>
        </div>
        <div class="resources-hero-stats" id="heroStats">
          <div class="hero-stat-chip">
            <span class="hero-stat-number" id="heroTotalFiles">—</span>
            <span class="hero-stat-label">Total Files</span>
          </div>
          <div class="hero-stat-chip">
            <span class="hero-stat-number" id="heroPdfCount">—</span>
            <span class="hero-stat-label">PDFs</span>
          </div>
          <div class="hero-stat-chip">
            <span class="hero-stat-number" id="heroRecentCount">—</span>
            <span class="hero-stat-label">This Week</span>
          </div>
        </div>
      </div>`;

    const header = section.querySelector('.resources-header');
    if (header) {
      section.insertBefore(hero, header);
    } else {
      section.prepend(hero);
    }
  }

  function updateHeroStats() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    const cards = $$('.resource-card', grid);
    const total = cards.length;
    const pdfs  = cards.filter(c => c.getAttribute('data-ext') === 'pdf').length;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = cards.filter(c => {
      const d = parseInt(c.getAttribute('data-created') || '0', 10);
      return d > oneWeekAgo;
    }).length;

    const setNum = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    setNum('heroTotalFiles', total);
    setNum('heroPdfCount', pdfs);
    setNum('heroRecentCount', recent || '—');
  }

  /* -----------------------------------------------------------------------
     2. TAG RESOURCE CARDS
  ----------------------------------------------------------------------- */
  function tagResourceCards() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    $$('.resource-card', grid).forEach(card => {
      if (card.getAttribute('data-ext')) return;

      const badge = card.querySelector('.resource-type-badge');
      if (!badge) return;
      const ext = badge.textContent.trim().toLowerCase();
      card.setAttribute('data-ext', ext);

      const dateEl = card.querySelector('.resource-date');
      if (dateEl) {
        const parsed = Date.parse(dateEl.textContent);
        if (!isNaN(parsed)) card.setAttribute('data-created', String(parsed));
      }
    });
  }

  /* -----------------------------------------------------------------------
     3. ENHANCED FILTER PILLS
  ----------------------------------------------------------------------- */
  function enhanceFilterPills() {
    const bar  = document.querySelector('.resources-filter-bar');
    const grid = document.getElementById('resourcesGrid');
    if (!bar || !grid) return;

    bar.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;

      $$('.filter-pill', bar).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const label = pill.textContent.trim().toLowerCase();

      const extMap = {
        'all files': null,
        'pdfs': 'pdf',
        'presentations': 'pptx',
        'documents': 'docx',
        'spreadsheets': 'xlsx',
      };

      const targetExt = extMap[label] ?? (label === 'all files' ? null : label);

      grid.classList.add('filtering');

      $$('.resource-card', grid).forEach((card, i) => {
        const ext = card.getAttribute('data-ext');
        const show = targetExt === null || ext === targetExt;

        card.style.transition = `opacity 0.2s ease ${i * 30}ms, transform 0.2s ease ${i * 30}ms`;

        if (show) {
          card.style.display = '';
          requestAnimationFrame(() => {
            card.style.opacity = '1';
            card.style.transform = '';
          });
        } else {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => { card.style.display = 'none'; }, 220 + i * 30);
        }
      });

      setTimeout(() => grid.classList.remove('filtering'), 400);
    });
  }

  /* -----------------------------------------------------------------------
     4. COMMAND PALETTE
  ----------------------------------------------------------------------- */
  function buildCommandPalette() {
    if (document.getElementById('cmdOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cmd-overlay';
    overlay.id = 'cmdOverlay';
    overlay.innerHTML = `
      <div class="cmd-palette" id="cmdPalette">
        <div class="cmd-search-row">
          <span class="material-symbols-outlined">search</span>
          <input class="cmd-input" id="cmdInput" placeholder="Search resources, navigate…" autocomplete="off" spellcheck="false">
          <span class="cmd-shortcut-badge">ESC</span>
        </div>
        <div class="cmd-results" id="cmdResults">
          <p class="cmd-section-label">Quick Navigation</p>
          ${[
            { icon: 'dashboard',   label: 'Dashboard',  target: 'view-dashboard' },
            { icon: 'menu_book',   label: 'My Courses', target: 'view-courses' },
            { icon: 'folder_open', label: 'Resources',  target: 'view-resources' },
            { icon: 'calendar_month', label: 'Schedule', target: 'view-schedule' },
          ].map(item => `
            <div class="cmd-item" data-nav="${item.target}">
              <div class="cmd-item-icon"><span class="material-symbols-outlined" style="color:var(--primary);">${item.icon}</span></div>
              <div class="cmd-item-info"><div class="cmd-item-name">${item.label}</div></div>
            </div>`).join('')}
          <p class="cmd-section-label" style="margin-top:10px;">Resources</p>
          <div id="cmdResourceItems"></div>
        </div>
        <div class="cmd-footer">
          <span class="cmd-hint"><span class="cmd-key">Enter</span> Open</span>
          <span class="cmd-hint"><span class="cmd-key">ESC</span> Close</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (!e.target.closest('#cmdPalette')) closeCmd(); });
    overlay.addEventListener('click', (e) => {
      const item = e.target.closest('[data-nav]');
      if (!item) return;
      closeCmd();
      const target = item.dataset.nav;
      const link = document.querySelector(`[data-target="${target}"]`);
      if (link) link.click();
    });

    overlay.addEventListener('click', (e) => {
      const item = e.target.closest('[data-open-url]');
      if (!item) return;
      closeCmd();
      window.open(item.dataset.openUrl, '_blank');
    });

    document.getElementById('cmdInput').addEventListener('input', debounce(filterCmd, 200));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleCmd(); }
      if (e.key === 'Escape') closeCmd();
    });
  }

  function populateCmdResources() {
    const container = document.getElementById('cmdResourceItems');
    if (!container) return;
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    const cards = $$('.resource-card', grid);
    if (!cards.length) { container.innerHTML = '<p style="padding:8px 10px;font-size:0.8rem;color:var(--text-muted);">No resources loaded.</p>'; return; }

    container.innerHTML = cards.slice(0, 8).map(card => {
      const title = card.querySelector('h4')?.textContent?.trim() || 'Resource';
      const ext   = card.getAttribute('data-ext') || 'file';
      const url   = card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || '#';
      const iconMap = { pdf: '📕', docx: '📘', pptx: '📙', xlsx: '📗' };
      
      return `<div class="cmd-item" data-open-url="${url}">
        <div class="cmd-item-icon">${iconMap[ext] || '📁'}</div>
        <div class="cmd-item-info">
          <div class="cmd-item-name">${title}</div>
          <div class="cmd-item-meta">${ext.toUpperCase()}</div>
        </div>
      </div>`;
    }).join('');
  }

  function filterCmd() {
    const q = document.getElementById('cmdInput')?.value?.toLowerCase().trim();
    if (!q) { $$('#cmdResults .cmd-item').forEach(el => el.style.display = ''); return; }
    $$('#cmdResults .cmd-item').forEach(el => {
      const text = el.querySelector('.cmd-item-name')?.textContent?.toLowerCase() || '';
      el.style.display = text.includes(q) ? '' : 'none';
    });
  }

  function toggleCmd() {
    const overlay = document.getElementById('cmdOverlay');
    if (!overlay) return;
    if (overlay.classList.contains('active')) closeCmd();
    else { overlay.classList.add('active'); populateCmdResources(); setTimeout(() => document.getElementById('cmdInput')?.focus(), 50); }
  }

  function closeCmd() {
    const overlay = document.getElementById('cmdOverlay');
    if (overlay) { overlay.classList.remove('active'); const input = document.getElementById('cmdInput'); if (input) input.value = ''; }
  }

  /* -----------------------------------------------------------------------
     5. PREMIUM TOAST SYSTEM
  ----------------------------------------------------------------------- */
  function buildToastContainer() {
    if (document.querySelector('.toast-container')) return;
    const tc = document.createElement('div');
    tc.className = 'toast-container';
    tc.id = 'toastContainer';
    document.body.appendChild(tc);
  }

  function showToastPremium(message, type = 'info') {
    const iconMap = { success: 'check_circle', info: 'info', warning: 'warning', error: 'error' };
    const tc = document.getElementById('toastContainer');
    if (!tc) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<div class="toast-icon"><span class="material-symbols-outlined">${iconMap[type] || 'info'}</span></div><span>${message}</span>`;
    tc.appendChild(toast);

    setTimeout(() => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 280); }, 3200);
  }

  const _origShowToast = window.showToast;
  window.showToast = function (message, type = 'info') {
    showToastPremium(message, type);
    if (typeof _origShowToast === 'function') { try { _origShowToast(message, type); } catch (_) {} }
  };

  /* -----------------------------------------------------------------------
     6. VIEW STATE OBSERVERS
  ----------------------------------------------------------------------- */
  function watchResourcesGrid() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    const observer = new MutationObserver(debounce(() => { tagResourceCards(); updateHeroStats(); populateCmdResources(); }, 200));
    observer.observe(grid, { childList: true, subtree: false });
    tagResourceCards(); updateHeroStats();
  }

  function watchUserName() {
    const nameEl = document.getElementById('sidebarUserName');
    if (!nameEl) return;
    const observer = new MutationObserver(() => {
      const section = document.getElementById('view-resources');
      const greetEl = section?.querySelector('.resources-hero-greeting');
      if (greetEl) {
        const first = nameEl.textContent.replace('Loading...', 'Student').split(' ')[0];
        greetEl.textContent = `${getGreeting()}, ${first}`;
      }
    });
    observer.observe(nameEl, { characterData: true, childList: true, subtree: true });
  }

/* -----------------------------------------------------------------------
     7. MESSAGE INSTRUCTOR BRIDGE
  ----------------------------------------------------------------------- */
  window.openComposeToInstructor = function(instructorName, instructorId, defaultSubject) {
    const modal = document.getElementById('composeModalOverlay');
    if (!modal) {
        showToastPremium('Messaging module is still loading...', 'warning');
        return;
    }
    
    modal.classList.add('active');

    const recipientInput = document.getElementById('composeRecipientId');
    const subjectInput = document.getElementById('composeSubject');
    const contentInput = document.getElementById('composeContent');
    
    if (recipientInput) recipientInput.value = instructorName;
    if (subjectInput) subjectInput.value = defaultSubject;
    if (contentInput) contentInput.focus();

    window.secretReceiverId = instructorId;
  };

  /* -----------------------------------------------------------------------
     HELPERS & BOOTSTRAP
  ----------------------------------------------------------------------- */
  function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

  function init() {
    buildToastContainer();
    buildHero();
    buildCommandPalette();
    enhanceFilterPills();
    watchResourcesGrid();
    watchUserName();
    window.toggleCommandPalette = toggleCmd;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);

})();