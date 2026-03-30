/**
 * Scans the resource cards and adds data attributes (extension and date) for easy filtering.
 */
export function tagResourceCards() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    Array.from(grid.querySelectorAll('.resource-card')).forEach(card => {
        // Skip if already tagged
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

/**
 * Initializes the clickable filter pills and handles the smooth filtering animations.
 */
export function enhanceFilterPills() {
    const bar = document.querySelector('.resources-filter-bar');
    const grid = document.getElementById('resourcesGrid');
    if (!bar || !grid) return;

    bar.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Update active styling on the pills
        Array.from(bar.querySelectorAll('.filter-pill')).forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const label = pill.textContent.trim().toLowerCase();

        // Map the button text to the actual file extensions
        const extMap = {
            'all files': null,
            'pdfs': 'pdf',
            'presentations': 'pptx',
            'documents': 'docx',
            'spreadsheets': 'xlsx',
        };

        const targetExt = extMap[label] ?? (label === 'all files' ? null : label);

        grid.classList.add('filtering');

        // Filter cards with staggered animations
        Array.from(grid.querySelectorAll('.resource-card')).forEach((card, i) => {
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

        // Remove filtering lock after animation finishes
        setTimeout(() => grid.classList.remove('filtering'), 400);
    });
}