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
 * Manages the transition between dashboard views.
 * Triggers the slideInRight keyframes from base.css.
 */
export function switchView(targetId) {
    if (!targetId) return;

    // 1. Update Content Views
    const views = document.querySelectorAll('.view-content');
    let targetExists = false;

    views.forEach(view => {
        const isActive = view.id === targetId;
        
        if (isActive) {
            view.classList.add(UI_CONFIG.ACTIVE_CLASS);
            targetExists = true;
        } else {
            view.classList.remove(UI_CONFIG.ACTIVE_CLASS);
        }
    });

    if (!targetExists) {
        console.warn(`[UI Engine]: View "${targetId}" not found in DOM.`);
        return;
    }

    // 2. Update Sidebar Navigation Glow States
    document.querySelectorAll('.nav-links li').forEach(li => {
        const link = li.querySelector('a');
        if (link) {
            const isTarget = link.getAttribute('data-target') === targetId;
            if (isTarget) {
                li.classList.add(UI_CONFIG.ACTIVE_CLASS);
            } else {
                li.classList.remove(UI_CONFIG.ACTIVE_CLASS);
            }
        }
    });

    // 3. Reset Scroll Position smoothly
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