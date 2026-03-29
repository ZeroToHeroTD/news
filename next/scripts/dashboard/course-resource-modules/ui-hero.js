export function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export function buildHero() {
    const section = document.getElementById('view-resources');
    if (!section || section.querySelector('.resources-hero')) return;

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
          <h1 class="resources-hero-title">Academic <span>Resources</span></h1>
          <p class="resources-hero-sub">All your study files, organized and ready.</p>
        </div>
        <div class="resources-hero-stats" id="heroStats">
          <div class="hero-stat-chip"><span class="hero-stat-number" id="heroTotalFiles">—</span><span class="hero-stat-label">Total Files</span></div>
          <div class="hero-stat-chip"><span class="hero-stat-number" id="heroPdfCount">—</span><span class="hero-stat-label">PDFs</span></div>
          <div class="hero-stat-chip"><span class="hero-stat-number" id="heroRecentCount">—</span><span class="hero-stat-label">This Week</span></div>
        </div>
      </div>`;

    const header = section.querySelector('.resources-header');
    header ? section.insertBefore(hero, header) : section.prepend(hero);
}

export function updateHeroStats() {
    const cards = [...document.querySelectorAll('#resourcesGrid .resource-card')];
    const total = cards.length;
    const pdfs = cards.filter(c => c.getAttribute('data-ext') === 'pdf').length;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = cards.filter(c => parseInt(c.getAttribute('data-created') || '0') > oneWeekAgo).length;

    const setNum = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setNum('heroTotalFiles', total);
    setNum('heroPdfCount', pdfs);
    setNum('heroRecentCount', recent || '—');
}