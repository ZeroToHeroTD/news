import { toggleFAB } from './ui-notifications.js';
import { updateHeroStats, getGreeting } from './ui-hero.js';

const debounce = (fn, ms) => { 
    let t; 
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; 
};

export function observeViewChanges() {
    const observer = new MutationObserver(() => {
        const isActive = document.getElementById('view-resources')?.classList.contains('active');
        toggleFAB(!!isActive);
    });
    
    document.querySelectorAll('.view-content').forEach(view => 
        observer.observe(view, { attributes: true, attributeFilter: ['class'] })
    );
}

export function watchResourcesGrid(tagCardsCallback) {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    const observer = new MutationObserver(debounce(() => {
        tagCardsCallback(); // Re-tag metadata on new cards
        updateHeroStats();
    }, 200));

    observer.observe(grid, { childList: true });
}

export function watchUserName() {
    const nameEl = document.getElementById('sidebarUserName');
    if (!nameEl) return;

    const observer = new MutationObserver(() => {
        const greetEl = document.querySelector('.resources-hero-greeting');
        if (greetEl) {
            const first = nameEl.textContent.replace('Loading...', 'Student').split(' ')[0];
            greetEl.textContent = `${getGreeting()}, ${first}`;
        }
    });
    observer.observe(nameEl, { characterData: true, childList: true, subtree: true });
}