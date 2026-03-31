// =============================================================================
// app.js — The Master Dashboard Orchestrator
// =============================================================================

import { supabaseClient } from './config.js';
import { toast as showToast } from './utils.js';
import { updateAllAvatars, switchView } from './ui.js';

// Modular Loaders
import { initProfile } from './profile.js';
import { loadAttendance } from './attendance.js';
import { loadCoursesData, loadResources } from './courses-resource.js';
import { loadDeadlines } from './deadlines.js';
import { loadGradesData, loadPerformanceChart, initializeChartListener } from './grades.js';
import { loadNotices, loadSmartDashboardData } from './notices-dashboard.js';
import { loadPaymentData } from './payments.js';
import { loadTodaysSchedule, loadWeeklySchedule } from './schedule.js';
import { loadSocialDirectory, initializePresence } from './social.js';
// Message Module Imports
import { loadMessages } from './message-modules/index.js';
import { 
    initializeAutocomplete, 
    setupMessageActions, 
    openComposeModal, 
    selectRecipient 
} from './message-modules/ui-actions.js';

document.addEventListener('DOMContentLoaded', async () => {

    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION & SESSION GUARD
    // -------------------------------------------------------------------------
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
    
    if (authError || !session) {
        window.location.href = 'index.html'; 
        return;
    }
    const user = session.user;
    const userId = user.id;

    // -------------------------------------------------------------------------
    // 2. UNIVERSAL LIVE SEARCH
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
                    'view-messages': '.conv-item',
                    'view-social': '.social-card-minimal',
                    'view-deadlines': '.deadline-item'
                };

                const targetSelector = searchMap[activeView.id];
                if (targetSelector) {
                    document.querySelectorAll(targetSelector).forEach(el => {
                        const isMatch = el.textContent.toLowerCase().includes(term);
                        el.style.display = isMatch ? "" : "none";
                    });
                }
            }, 200);
        });
    }

    // -------------------------------------------------------------------------
    // 3. SETTINGS & PROFILE
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
                await initProfile(user); 
            } else {
                showToast('Update failed. Please try again.', 'error');
            }

            if (saveBtn) { 
                saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Save Profile Changes'; 
                saveBtn.disabled = false; 
            }
        });
    }

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
    // 4. THEME & NAVIGATION
    // -------------------------------------------------------------------------
    const themeBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.remove('dark-mode');
        if (themeIcon) themeIcon.textContent = 'light_mode';
    } else {
        document.body.classList.add('dark-mode');
        if (themeIcon) themeIcon.textContent = 'dark_mode';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', (e) => {
            // 👉 THE FIX: Stop the click from triggering global view changers!
            e.stopPropagation();
            
            themeBtn.classList.add('rotating');
            setTimeout(() => themeBtn.classList.remove('rotating'), 500);

            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            
            if (themeIcon) themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
            localStorage.setItem('theme', isDark ? 'dark' : 'light');

            // Re-render chart for theme sync
            const chartFilter = document.getElementById('chartFilter');
            if (typeof loadPerformanceChart === 'function' && chartFilter) {
                loadPerformanceChart(userId, chartFilter.value || 'grades');
            }
        });
    }

    // Tab & Sidebar Navigation
    const sidebar = document.querySelector('.app-sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const hamburgerBtn = document.getElementById('hamburgerBtn');

    if (hamburgerBtn && sidebar && sidebarOverlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });

        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('active');
        });
    }

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target]');
        if (target) {
            e.preventDefault();
            const viewId = target.getAttribute('data-target');
            switchView(viewId);
            if(sidebar) sidebar.classList.remove('open');
            if(sidebarOverlay) sidebarOverlay.classList.remove('active');
        }
    });

    // -------------------------------------------------------------------------
    // 5. MASTER INITIALIZATION
    // -------------------------------------------------------------------------
    async function startDashboard() {
        try {
            const dateEl = document.getElementById('currentDate');
            if (dateEl) {
                dateEl.textContent = new Date().toLocaleDateString('en-US', { 
                    month: 'long', day: 'numeric', year: 'numeric' 
                });
            }

            // A. Load critical data first
            await initProfile(user);

            // B. Start live presence as early as possible so status stays accurate
            // even if a later dashboard module fails to load.
            initializePresence(userId);

            // C. Parallel Data Loading
            const moduleResults = await Promise.allSettled([
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

            const failedModules = moduleResults.filter(result => result.status === 'rejected');
            if (failedModules.length) {
                console.error('Dashboard module load failures:', failedModules.map(result => result.reason));
                showToast('Some dashboard sections could not fully load.', 'warning');
            }

            // D. Setup Interactive Features
            initializeAutocomplete();
            setupMessageActions();
            initializeChartListener(userId);

            // Expose these to window so your courses cards can click them
            window.openComposeModal = openComposeModal;
            window.selectRecipient = selectRecipient;

        } catch (error) {
            console.error("Dashboard Initialization Error:", error);
            showToast("Some modules failed to load. Please refresh.", "error");
        }
    }

    startDashboard();
});

window.handleLogout = async () => {
    await supabaseClient.auth.signOut();
    window.location.replace('index.html'); 
};
