// =============================================================================
// profile.js — Identity & Settings Engine (Premium SaaS Edition)
// =============================================================================

import { supabase as supabaseClient } from './config.js';
import { updateAllAvatars, checkUserPermissions } from './ui.js';

// ==========================================
// 1. DATA NORMALIZATION HELPER
// ==========================================

/**
 * Merges Supabase profile data with Auth metadata and provides premium fallbacks.
 * Ensures the UI never breaks due to missing data fields.
 */
const normalizeProfile = (profile, authUser) => {
    const fullName = profile?.full_name || authUser?.user_metadata?.full_name || 'Student';
    const firstName = fullName.split(' ')[0];
    
    // Default avatar uses the primary brand color (0062ff) for consistency
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0062ff&color=fff&rounded=true&bold=true`;
    
    return {
        id: authUser?.id,
        fullName,
        firstName,
        email: profile?.email || authUser?.email || 'No email provided',
        bio: profile?.bio || authUser?.user_metadata?.bio || '', // Empty string is cleaner for form inputs than a generic phrase
        role: profile?.role || 'Student',
        course: profile?.course_name || 'Unassigned',
        section: profile?.section || 'Unassigned',
        targetGwa: profile?.target_gwa ? parseFloat(profile.target_gwa).toFixed(2) : null,
        avatarUrl: profile?.avatar_url || authUser?.user_metadata?.avatar_url || defaultAvatar
    };
};

// ==========================================
// 2. MAIN INITIALIZATION ENGINE
// ==========================================

export async function initProfile(authUser) {
    if (!authUser || !authUser.id) return;

    try {
        const { data: rawProfile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

        // If no row exists, we proceed anyway using Auth fallbacks via normalization
        if (error && error.code !== 'PGRST116') throw error; 

        const profile = normalizeProfile(rawProfile, authUser);

        // --- Execute UI Updates ---
        updateIdentityUI(profile);
        populateSettingsForm(profile);
        syncGwaTargetDisplay(profile);
        
        // Global UI triggers (Defensive checks ensure the dashboard doesn't crash if ui.js is edited)
        if (typeof updateAllAvatars === 'function') updateAllAvatars(profile.avatarUrl);
        if (typeof checkUserPermissions === 'function') checkUserPermissions(profile.role);

    } catch (err) {
        console.error("Profile Engine Error:", err.message);
        
        // Premium Failsafe: Ensure UI doesn't say "Loading..." forever
        const welcome = document.getElementById('welcomeMessage');
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarRole = document.getElementById('sidebarUserRole');
        
        if (welcome) welcome.textContent = 'Welcome back!';
        if (sidebarName) sidebarName.textContent = authUser?.email?.split('@')[0] || 'Student';
        if (sidebarRole) sidebarRole.textContent = 'Student';
    }
}

// ==========================================
// 3. SUB-RENDERERS (THE "HTML" REFACTOR)
// ==========================================

function updateIdentityUI(p) {
    const els = {
        topbar: document.getElementById('topbarName'),
        welcome: document.getElementById('welcomeMessage'),
        sidebarName: document.getElementById('sidebarUserName'),
        sidebarRole: document.getElementById('sidebarUserRole')
    };

    // 1. Topbar & Welcome
    if (els.topbar)  els.topbar.textContent = p.fullName;
    if (els.welcome) els.welcome.textContent = `Welcome back, ${p.firstName}!`;

    // 2. Sidebar Identity
    if (els.sidebarName) els.sidebarName.textContent = p.fullName;
    if (els.sidebarRole && p.role) {
        // Capitalize role for a professional look
        els.sidebarRole.textContent = p.role.charAt(0).toUpperCase() + p.role.slice(1).toLowerCase();
    }
}

function populateSettingsForm(p) {
    const fields = {
        'settingName': p.fullName,
        'settingEmail': p.email,
        'settingBio': p.bio,
        'settingUserId': p.id,
        'settingCourse': p.course,
        'settingSection': p.section
    };

    // Populate and handle locked state
    for (const [id, value] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) {
            el.value = value || '';
            
            // Phase 1 Lockdown: Ensure read-only fields feel locked visually to match base.css
            if (['settingCourse', 'settingSection', 'settingUserId', 'settingEmail'].includes(id)) {
                el.classList.add('input-locked');
                el.readOnly = true;
                
                // Explicit styling backup in case class is missing from CSS
                el.style.backgroundColor = 'var(--input-bg)';
                el.style.opacity = '0.7';
                el.style.cursor = 'not-allowed';
            }
        }
    }
}

function syncGwaTargetDisplay(p) {
    const displays = {
        input: document.getElementById('targetGwaInput'),
        dashboard: document.getElementById('targetGwaDisplay'),
        settings: document.getElementById('targetGwaSettingDisplay')
    };

    if (p.targetGwa) {
        if (displays.input)     displays.input.value = p.targetGwa;
        if (displays.dashboard) displays.dashboard.textContent = p.targetGwa;
        if (displays.settings)  displays.settings.textContent = p.targetGwa;
        
        // Add a premium pop of color to the dashboard GWA
        if (displays.dashboard) displays.dashboard.style.color = 'var(--primary)';
    } else {
        if (displays.dashboard) {
            displays.dashboard.textContent = '--';
            displays.dashboard.style.color = 'var(--text-main)';
        }
        if (displays.settings)  displays.settings.textContent = 'None Set';
    }
}