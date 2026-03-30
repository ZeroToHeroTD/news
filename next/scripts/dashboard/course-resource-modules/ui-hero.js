/**
 * Helper to determine the correct time of day for the greeting.
 */
export function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Injects the Hero Banner into the Resources view.
 */
export function buildHero() {
    const section = document.getElementById('view-resources');
    if (!section) return;
    
    // Prevent duplicate injections
    if (section.querySelector('.resources-hero')) return; 

    // Grab the first name from the sidebar or topbar
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

    // Insert it right above the filter bar
    const header = section.querySelector('.resources-header');
    if (header) {
        section.insertBefore(hero, header);
    } else {
        section.prepend(hero);
    }
}

/**
 * Scans the loaded files and updates the numbers on the Hero Banner.
 */
export function updateHeroStats() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.resource-card'));
    const total = cards.length;
    const pdfs  = cards.filter(c => c.getAttribute('data-ext') === 'pdf').length;

    // Calculate files added in the last 7 days
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