// =============================================================================
// ui.js — Global UI State & Dom Manipulation Engine (Premium SaaS)
// =============================================================================

// ==========================================
// 1. CONSTANTS & CONFIG
// ==========================================

const UI_CONFIG = {
    // Premium fallback avatar matches the primary brand color
    AVATAR_FALLBACK: (name = 'Student') => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0062ff&color=fff&bold=true`,
    
    // CRITICAL: Mapped to 'active' to trigger the CSS animations in base.css
    ACTIVE_CLASS: 'active',
    HIDDEN_CLASS: 'hidden'
};

// ==========================================
// 2. AVATAR ENGINE
// ==========================================

/**
 * Syncs all avatar images across the platform.
 * Maps strictly to the IDs/Classes used in the dashboard HTML.
 */
export function updateAllAvatars(url, nameHint = 'Student') {
    const avatarQueries = [
        '#navAvatar',        // Topbar
        '#settingsAvatar',   // Settings View
        '.sidebar-avatar'    // Sidebar User Card
    ];

    const fallback = UI_CONFIG.AVATAR_FALLBACK(nameHint);
    const finalUrl = url || fallback;

    avatarQueries.forEach(query => {
        const elements = document.querySelectorAll(query);
        elements.forEach(img => {
            img.src = finalUrl;
            
            // Failsafe: Ensure broken links revert to a clean fallback
            img.onerror = () => { 
                if (img.src !== fallback) img.src = fallback; 
            };
        });
    });
}

// ==========================================
// 3. PERMISSIONS & ACCESS CONTROL
// ==========================================

/**
 * Toggles visibility for elements based on user role.
 * Supports granular roles via [data-access] attribute.
 */
export function checkUserPermissions(role = 'student') {
    const userRole = role.toLowerCase().trim();
    const isStaff = ['admin', 'teacher', 'instructor'].includes(userRole);
    
    // 1. Basic Admin/Staff-Only toggles
    document.querySelectorAll('.admin-only, .staff-only').forEach(el => {
        el.style.display = isStaff ? 'flex' : 'none';
    });

    // 2. Advanced: Data-attribute based access (e.g., data-access="admin")
    document.querySelectorAll('[data-access]').forEach(el => {
        const requiredRole = el.getAttribute('data-access').toLowerCase();
        
        // Allow access if the user has the exact role, or if it requires 'staff' and they are staff
        const hasAccess = (requiredRole === 'staff' && isStaff) || (requiredRole === userRole);
        
        if (!hasAccess) {
            el.style.display = 'none';
        } else {
            el.style.display = ''; // Reverts to CSS default (flex, block, etc.)
        }
    });
}

// ==========================================
// 4. NAVIGATION & VIEW ENGINE
// ==========================================

/**
 * Asynchronously loads an HTML component from a specified path into a container element.
 * @param {string} componentPath - The URL path to the HTML component.
 * @param {string} containerId - The ID of the DOM element to load the content into.
 */
export async function loadComponent(componentPath, containerId) {
    try {
        const response = await fetch(componentPath);
        if (!response.ok) {
            throw new Error(`Component fetch failed: ${response.status}`);
        }
        const content = await response.text();
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = content;
        } else {
            console.warn(`[UI Engine]: Container "#${containerId}" not found for component "${componentPath}".`);
        }
    } catch (error) {
        console.error(`[UI Engine]: Failed to load component "${componentPath}".`, error);
    }
}


/**
 * Manages the transition between dashboard views.
 * Dynamically loads view content on demand.
 * Triggers the slideInRight keyframes from base.css.
 */
export async function switchView(targetId) {
    if (!targetId) return;

    const targetView = document.getElementById(targetId);

    if (!targetView) {
        console.warn(`[UI Engine]: View "${targetId}" not found in DOM.`);
        return;
    }

    // 1. Load content if the view is empty
    if (targetView.innerHTML.trim() === '') {
        // Assumes component HTML files are named after the view ID.
        // e.g., view 'view-courses' maps to 'components/view-courses.html'
        const componentName = targetId.replace('view-', '');
        await loadComponent(`../html/components/${targetId}.html`, targetId);
    }
    
    // 2. Update Content Views
    const views = document.querySelectorAll('.view-content');
    views.forEach(view => {
        view.classList.toggle(UI_CONFIG.ACTIVE_CLASS, view.id === targetId);
    });

    // 3. Update Sidebar Navigation Glow States
    document.querySelectorAll('.nav-links li').forEach(li => {
        const link = li.querySelector('a');
        if (link) {
            const isTarget = link.getAttribute('data-target') === targetId;
            li.classList.toggle(UI_CONFIG.ACTIVE_CLASS, isTarget);
        }
    });

    // 4. Reset Scroll Position smoothly
    resetMainScroll();
}

/**
 * Smoothly resets the main content area scroll to the top.
 */
function resetMainScroll() {
    const mainArea = document.querySelector('.app-main');
    if (mainArea) {
        mainArea.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}