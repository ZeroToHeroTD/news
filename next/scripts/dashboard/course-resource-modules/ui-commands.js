/** ui-commands.js
 * Helper to prevent search functions from firing too rapidly.
 */
function debounce(fn, ms) { 
    let t; 
    return (...args) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...args), ms); 
    }; 
}

/**
 * Grabs the loaded resources from the grid to populate the command palette search.
 */
function populateCmdResources() {
    const container = document.getElementById('cmdResourceItems');
    const grid = document.getElementById('resourcesGrid');
    if (!container || !grid) return;

    const cards = Array.from(grid.querySelectorAll('.resource-card'));
    
    if (!cards.length) { 
        container.innerHTML = '<p style="padding:8px 10px;font-size:0.8rem;color:var(--text-muted);">No resources loaded.</p>'; 
        return; 
    }

    container.innerHTML = cards.slice(0, 8).map(card => {
        const title = card.querySelector('h4')?.textContent?.trim() || 'Resource';
        const ext   = card.getAttribute('data-ext') || 'file';
        const url   = card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || '#';
        const iconMap = { pdf: '📕', docx: '📘', pptx: '📙', xlsx: '📗' };
        
        return `
        <div class="cmd-item" data-open-url="${url}">
            <div class="cmd-item-icon">${iconMap[ext] || '📁'}</div>
            <div class="cmd-item-info">
                <div class="cmd-item-name">${title}</div>
                <div class="cmd-item-meta">${ext.toUpperCase()}</div>
            </div>
        </div>`;
    }).join('');
}

/**
 * Filters the command palette items based on user input.
 */
function filterCmd() {
    const q = document.getElementById('cmdInput')?.value?.toLowerCase().trim();
    const items = Array.from(document.querySelectorAll('#cmdResults .cmd-item'));
    
    if (!q) { 
        items.forEach(el => el.style.display = ''); 
        return; 
    }
    
    items.forEach(el => {
        const text = el.querySelector('.cmd-item-name')?.textContent?.toLowerCase() || '';
        el.style.display = text.includes(q) ? '' : 'none';
    });
}

/**
 * Closes the command palette and clears the search input.
 */
export function closeCmd() {
    const overlay = document.getElementById('cmdOverlay');
    if (overlay) { 
        overlay.classList.remove('active'); 
        const input = document.getElementById('cmdInput'); 
        if (input) input.value = ''; 
    }
}

/**
 * Toggles the command palette open/closed.
 */
export function toggleCmd() {
    const overlay = document.getElementById('cmdOverlay');
    if (!overlay) return;
    
    if (overlay.classList.contains('active')) {
        closeCmd();
    } else { 
        overlay.classList.add('active'); 
        populateCmdResources(); 
        setTimeout(() => document.getElementById('cmdInput')?.focus(), 50); 
    }
}

/**
 * Builds the HTML overlay for the Command Palette and attaches event listeners.
 */
export function buildCommandPalette() {
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

    // Event Listeners for clicks
    overlay.addEventListener('click', (e) => { 
        if (!e.target.closest('#cmdPalette')) closeCmd(); 
    });
    
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

    // Event Listener for typing
    document.getElementById('cmdInput').addEventListener('input', debounce(filterCmd, 200));

    // Global keyboard shortcuts (Ctrl+K and Escape)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { 
            e.preventDefault(); 
            toggleCmd(); 
        }
        if (e.key === 'Escape') closeCmd();
    });

    // Expose toggle globally so buttons can trigger it if needed
    window.toggleCommandPalette = toggleCmd;
} 