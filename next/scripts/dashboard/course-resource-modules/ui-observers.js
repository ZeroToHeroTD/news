/**
 * Helper to prevent functions from firing too rapidly.
 */
function debounce(fn, ms) { 
    let t; 
    return (...args) => { 
        clearTimeout(t); 
        t = setTimeout(() => fn(...args), ms); 
    }; 
}

/**
 * Watches the resources grid for changes and updates the Hero stats automatically.
 */
export function watchResourcesGrid() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    
    // We dynamically import the needed functions so there are no circular dependencies
    const observer = new MutationObserver(debounce(async () => { 
        const { tagResourceCards } = await import('./ui-filters.js');
        const { updateHeroStats } = await import('./ui-hero.js');
        
        tagResourceCards(); 
        updateHeroStats(); 
    }, 200));
    
    observer.observe(grid, { childList: true, subtree: false });
}

/**
 * Watches the sidebar name. When it loads from Supabase, it updates the "Good evening" banner!
 */
export function watchUserName() {
    const nameEl = document.getElementById('sidebarUserName');
    if (!nameEl) return;
    
    const observer = new MutationObserver(() => {
        const section = document.getElementById('view-resources');
        const greetEl = section?.querySelector('.resources-hero-greeting');
        
        if (greetEl) {
            const first = nameEl.textContent.replace('Loading...', 'Student').split(' ')[0];
            
            const h = new Date().getHours();
            const greeting = h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
            
            greetEl.textContent = `${greeting}, ${first}`;
        }
    });
    
    observer.observe(nameEl, { characterData: true, childList: true, subtree: true });
}