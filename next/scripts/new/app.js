// =============================================================================
// app.js — The Master Dashboard Orchestrator
// Coordinates Auth, Universal Search, Profile Settings, and Modular Loading.
// =============================================================================

import { supabaseClient } from '../new/config.js';
import { showToast } from '../new/utils.js';
import { updateAllAvatars, switchView } from '../new/ui.js';

// Modular Loaders
import { initProfile } from '../new/profile.js';
import { loadAttendance } from '../new/attendance.js';
import { loadCoursesData, loadResources } from '../new/courses-resource.js';
import { loadDeadlines } from '../new/deadlines.js';
import { loadGradesData, loadPerformanceChart, initializeChartListener } from '../new/grades.js';
import { loadMessages, updateUnreadCount, initializeAutocomplete, setupMessageActions } from '../new/messages.js';
import { loadNotices, loadSmartDashboardData } from '../new/notices-dashboard.js';
import { loadPaymentData } from '../new/payments.js';
import { loadTodaysSchedule, loadWeeklySchedule } from '../new/schedule.js';
import { loadSocialDirectory, initializePresence } from '../new/social.js';

// Global state for messaging functionality
window.secretReceiverId = null; 

document.addEventListener('DOMContentLoaded', async () => {

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & SESSION GUARD
    // -------------------------------------------------------------------------
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
    
    if (authError || !session) {
        window.location.href = '../index.html'; 
        return;
    }
    const user = session.user;
    const userId = user.id;

    // -------------------------------------------------------------------------
    // 2. UNIVERSAL LIVE SEARCH (Optimized with Debounce)
    // -------------------------------------------------------------------------
    const topSearchInput = document.querySelector('.search-bar input');
    let searchTimeout;

    if (topSearchInput) {
        topSearchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const term = e.target.value.toLowerCase().trim();
                const activeView = document.querySelector('.view-content.active');
                if (!activeView) return;

                const searchMap = {
                    'view-grades': '#gradesTableBody tr',
                    'view-courses': '.course-card',
                    'view-resources': '.resource-card',
                    'view-messages': '.message-card', // Updated to match new CSS
                    'view-social': '.social-card-minimal',
                    'view-deadlines': '.deadline-item'
                };

                const targetSelector = searchMap[activeView.id];
                if (targetSelector) {
                    document.querySelectorAll(targetSelector).forEach(el => {
                        const isMatch = el.textContent.toLowerCase().includes(term);
                        // Use flex/table-row depending on element type, or default to empty string
                        el.style.display = isMatch ? "" : "none";
                    });
                }
            }, 200); // 200ms debounce for performance
        });
    }

    // -------------------------------------------------------------------------
    // 3. SETTINGS: PROFILE, GWA, & AVATAR UPLOAD
    // -------------------------------------------------------------------------
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = settingsForm.querySelector('[type="submit"]');
            const name = document.getElementById('settingName')?.value?.trim();
            const bio  = document.getElementById('settingBio')?.value?.trim();

            if (saveBtn) { 
                saveBtn.textContent = 'Saving...'; 
                saveBtn.disabled = true; 
            }

            const { error } = await supabaseClient
                .from('profiles')
                .update({ full_name: name, bio: bio })
                .eq('id', userId);

            if (!error) {
                showToast('Profile updated successfully!', 'success');
                initProfile(user); 
            } else {
                showToast('Update failed. Please try again.', 'error');
            }

            if (saveBtn) { 
                saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Profile Changes'; 
                saveBtn.disabled = false; 
            }
        });
    }

    // Target GWA Save Logic
    document.getElementById('saveGwaBtn')?.addEventListener('click', async () => {
        const val = parseFloat(document.getElementById('targetGwaInput')?.value);
        if (isNaN(val) || val < 1.0 || val > 5.0) {
            showToast('Please enter a valid GWA (1.0 - 5.0)', 'error');
            return;
        }

        const { error } = await supabaseClient
            .from('profiles')
            .update({ target_gwa: val })
            .eq('id', userId);

        if (!error) {
            showToast('Target GWA saved!', 'success');
            initProfile(user);
        }
    });

    // Avatar Upload Logic
    const uploadBtn = document.getElementById('uploadBtn');
    const avatarInput = document.getElementById('avatarInput');
    if (uploadBtn && avatarInput) {
        uploadBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            uploadBtn.textContent = 'Uploading...';
            const fileExt = file.name.split('.').pop();
            const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

            const { error: upErr } = await supabaseClient.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (upErr) { 
                showToast('Upload failed', 'error'); 
                uploadBtn.textContent = 'Upload New Photo'; 
                return; 
            }

            const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);
            const { error: dbError } = await supabaseClient.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

            if (!dbError) {
                updateAllAvatars(publicUrl);
                showToast('Profile photo updated!', 'success');
            }
            uploadBtn.textContent = 'Upload New Photo';
        });
    }

    // -------------------------------------------------------------------------
    // 4. THEME, TABS & MOBILE SIDEBAR NAVIGATION
    // -------------------------------------------------------------------------
// Inside your DOMContentLoaded in app.js
const themeBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// Initial setup based on localStorage
if (localStorage.getItem('theme') === 'light') {
    document.body.classList.remove('dark-mode');
    if (themeIcon) themeIcon.textContent = 'light_mode';
} else {
    document.body.classList.add('dark-mode');
    if (themeIcon) themeIcon.textContent = 'dark_mode';
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        // Add rotation class for the animation
        themeBtn.classList.add('rotating');
        setTimeout(() => themeBtn.classList.remove('rotating'), 500);

        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // SWAP THE ICONS
        if (themeIcon) {
            themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
        }

        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        // Re-render chart if necessary
        const chartFilter = document.getElementById('chartFilter');
        if (typeof loadPerformanceChart === 'function' && chartFilter) {
            loadPerformanceChart(userId, chartFilter.value || 'grades');
        }
    });
}
    // Mobile Sidebar Elements
    const sidebar = document.querySelector('.app-sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn') || document.querySelector('.hamburger-btn');

    // Toggle Mobile Menu
    if (hamburgerBtn && sidebar && sidebarOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });

        // Close when clicking overlay
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // Tab Navigation Logic
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target]');
        if (target) {
            e.preventDefault();
            const viewId = target.getAttribute('data-target');
            
            if(typeof switchView === 'function') {
                switchView(viewId);
            }
            
            // Auto-close mobile sidebar if it's open
            if(sidebar) sidebar.classList.remove('open');
            if(sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
    });

    // -------------------------------------------------------------------------
    // 5. MASTER INITIALIZATION (Parallel Loading)
    // -------------------------------------------------------------------------
    async function startDashboard() {
        try {
            const dateEl = document.getElementById('currentDate');
            if (dateEl) {
                dateEl.textContent = new Date().toLocaleDateString('en-US', { 
                    month: 'long', day: 'numeric', year: 'numeric' 
                });
            }

            // A. Load critical profile data first to set names and avatars
            await initProfile(user);

            // B. Load all data modules simultaneously for maximum speed
            await Promise.all([
                loadSmartDashboardData(userId),
                loadPerformanceChart(userId, 'grades'),
                loadTodaysSchedule(userId),
                loadWeeklySchedule(userId),
                loadResources(),
                loadMessages(userId),
                loadPaymentData(userId),
                loadCoursesData(userId),
                loadGradesData(userId),
                loadNotices(),
                loadDeadlines(userId),
                loadAttendance(userId),
                loadSocialDirectory(userId)
                
            ]);

            // C. Final interactive wiring
            initializeAutocomplete();
            setupMessageActions();
            initializePresence(userId);
            initializeChartListener(userId);

        } catch (error) {
            console.error("Dashboard Initialization Error:", error);
            showToast("Some modules failed to load. Please refresh.", "error");
        }
    }

    // Ignite the engine
    startDashboard();
});

// Exposed Global Helpers for inline HTML event handlers
window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '../index.html';
};