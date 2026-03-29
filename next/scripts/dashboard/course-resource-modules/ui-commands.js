export function buildCommandPalette() {
    if (document.getElementById('cmdOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'cmd-overlay';
    overlay.id = 'cmdOverlay';
    overlay.innerHTML = `
      <div class="cmd-palette" id="cmdPalette">
        <div class="cmd-search-row">
          <span class="material-symbols-outlined">search</span>
          <input class="cmd-input" id="cmdInput" placeholder="Search resources, navigate…" autocomplete="off">
          <span class="cmd-shortcut-badge">ESC</span>
        </div>
        <div class="cmd-results" id="cmdResults">
          <p class="cmd-section-label">Quick Navigation</p>
          <div class="cmd-item" data-nav="view-dashboard">Dashboard</div>
          <div class="cmd-item" data-nav="view-courses">My Courses</div>
          <div id="cmdResourceItems"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    
    // Add Event Listeners for closing and navigation...
    // (Include the toggleCmd and filterCmd logic here)
}

export function toggleCmd() {
    const overlay = document.getElementById('cmdOverlay');
    if (!overlay) return;
    overlay.classList.toggle('active');
    if (overlay.classList.contains('active')) document.getElementById('cmdInput')?.focus();
}   