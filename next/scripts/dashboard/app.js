// ============================================================
// app.js — Application entry point: orchestrates api.js + ui.js
//           Wires all events and initializes all modules
// ============================================================

import {
    getSession, signOut,
    fetchProfile, updateProfile, upsertProfile, fetchSenderName,
    uploadAvatar,
    fetchTodaysSchedule, fetchWeeklySchedule, fetchNextClass,
    fetchPersonalMessages, fetchAnnouncements, fetchUnreadCount,
    markMessageRead, sendMessage,
    fetchPayments, fetchUnpaidTotal,
    fetchDeadlines, fetchNextDeadline,
    fetchCourses, fetchGrades, fetchGradesForChart, fetchProgressForChart,
    fetchResources, fetchNotices, fetchAttendance
} from './api.js';

import {
    showToast, updateAllAvatars,
    renderProfile, updateProfileNameInUI, applyPermissions,
    switchView,
    renderTodaysSchedule, renderWeeklySchedule,
    renderNextClass, renderUnreadCount, renderPaymentLabel, renderNextDeadline,
    renderMessages, markMessageReadInDOM, openMessageModal, closeMessageModal,
    renderPayments,
    renderDeadlines, openDeadlineModal, closeDeadlineModal,
    renderCourses,
    renderGrades, renderGwaComparison,
    renderResources,
    renderNotices,
    renderAttendance,
    openCompose, closeCompose, getComposeValues, setComposeSending,
    applyStoredTheme, toggleTheme,
    buildGradeChart, buildProgressChart,
    getPHNumericalGrade, getTimeAgo, escapeAttr
} from './ui.js';

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

    // ── 1. Auth guard ──────────────────────────────────────
    const session = await getSession();
    if (!session) { window.location.href = 'index.html'; return; }
    const user = session.user;

    // ── 2. Theme ───────────────────────────────────────────
    applyStoredTheme();

    // ── 3. Expose globals needed by inline onclick HTML ────
    // (These bridge the gap between module scope and HTML onclick attributes)
    window.__openMessageModal  = (id, subject, content, senderName, timeAgo, isUnread) =>
        handleMessageOpen(id, subject, content, senderName, timeAgo, isUnread);
    window.__openDeadlineModal = (data) =>
        openDeadlineModal(typeof data === 'string' ? JSON.parse(data) : data);
    window.__openComposeToInstructor = (instructorName, courseName) =>
        openCompose({ toDisplay: `${instructorName} — ${courseName}`, recipientId: instructorName, subject: `Re: ${courseName}` });

    // ── 4. Start everything ────────────────────────────────
    await startAllModules(user);
    wireAllEvents(user);
});

// ─────────────────────────────────────────
// INITIALIZER
// ─────────────────────────────────────────

async function startAllModules(user) {
    // Profile first so name/avatar appear immediately
    await initProfile(user);

    const userId = user.id;

    // Date stamp
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Load all data in parallel
    await Promise.all([
        loadSmartDashboard(userId),
        loadPerformanceChart(userId, 'grades'),
        loadSchedule(userId),
        loadResources(),
        loadMessages(userId),
        loadPayments(userId),
        loadCourses(userId),
        loadGrades(userId),
        loadNotices(),
        loadDeadlines(userId),
        loadAttendance(userId),
    ]);
}

// ─────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────

async function initProfile(user) {
    const profile = await fetchProfile(user.id);
    const fullName = profile?.full_name || user.user_metadata?.full_name || 'Student';
    const email    = profile?.email    || user.email;
    const bio      = profile?.bio      || user.user_metadata?.bio || 'Passionate learner!';
    const avatarUrl = profile?.avatar_url
        || user.user_metadata?.avatar_url
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0062ff&color=fff`;

    renderProfile({ fullName, email, bio, avatarUrl, targetGwa: profile?.target_gwa });
    applyPermissions(profile?.role);
}

// ─────────────────────────────────────────
// SMART DASHBOARD
// ─────────────────────────────────────────

async function loadSmartDashboard(userId) {
    const today   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

    const [nextClass, unreadCount, unpaidRows, nextDeadline] = await Promise.all([
        fetchNextClass(userId, today, nowTime),
        fetchUnreadCount(userId),
        fetchUnpaidTotal(userId),
        fetchNextDeadline(userId),
    ]);

    renderNextClass(nextClass);
    renderUnreadCount(unreadCount);
    renderPaymentLabel(unpaidRows);
    renderNextDeadline(nextDeadline);
}

// ─────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────

async function loadSchedule(userId) {
    const today   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const [todayItems, allItems] = await Promise.all([
        fetchTodaysSchedule(userId, today),
        fetchWeeklySchedule(userId),
    ]);
    renderTodaysSchedule(todayItems);
    renderWeeklySchedule(allItems);
}

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────

async function loadMessages(userId) {
    const [personal, announcements] = await Promise.all([
        fetchPersonalMessages(userId),
        fetchAnnouncements(),
    ]);

    const combined = [
        ...announcements.map(m => ({ ...m, _type: 'announcement' })),
        ...personal.map(m => ({ ...m, _type: 'personal' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    renderMessages(combined);

    const count = await fetchUnreadCount(userId);
    renderUnreadCount(count);
}

async function handleMessageOpen(msgId, subject, content, senderName, timeAgo, isUnread) {
    openMessageModal({ subject, content, senderName, timeAgo });
    if (isUnread) {
        await markMessageRead(msgId);
        markMessageReadInDOM(msgId);
        // Re-fetch count and re-render badge
        const count = await fetchUnreadCount(currentUserId());
        renderUnreadCount(count);
    }
}

// ─────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────

async function loadPayments(userId) {
    const payments = await fetchPayments(userId);
    renderPayments(payments);
}

// ─────────────────────────────────────────
// DEADLINES
// ─────────────────────────────────────────

async function loadDeadlines(userId) {
    const { data, error } = await fetchDeadlines(userId);
    if (error) {
        console.warn("Deadlines table not found:", error.message);
        const container = document.getElementById('deadlinesContainer');
        if (container) container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No deadlines table found. Create one in Supabase.</p>`;
        renderNextDeadline(null);
        return;
    }
    renderDeadlines(data);
    const upcoming = data.find(d => d.status !== 'submitted') || null;
    renderNextDeadline(upcoming);
}

// ─────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────

async function loadCourses(userId) {
    const courses = await fetchCourses(userId);
    renderCourses(courses);
}

// ─────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────

async function loadGrades(userId) {
    const grades = await fetchGrades(userId);
    const computedGwa = renderGrades(grades);
    if (computedGwa !== null) renderGwaComparison(computedGwa);
}

// ─────────────────────────────────────────
// RESOURCES
// ─────────────────────────────────────────

async function loadResources() {
    const files = await fetchResources();
    renderResources(files);
}

// ─────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────

async function loadNotices() {
    const { data } = await fetchNotices();
    renderNotices(data);
}

// ─────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────

async function loadAttendance(userId) {
    const { data, error } = await fetchAttendance(userId);
    if (error) { console.warn("Attendance table missing:", error.message); return; }
    renderAttendance(data);
}

// ─────────────────────────────────────────
// PERFORMANCE CHART
// ─────────────────────────────────────────

let myChart = null;

async function loadPerformanceChart(userId, filterType = 'grades') {
    const ctx = document.getElementById('performanceChart');
    if (!ctx) return;
    if (myChart) { myChart.destroy(); myChart = null; }

    const isDark = document.body.classList.contains('dark-mode');

    if (filterType === 'grades') {
        const grades = await fetchGradesForChart(userId);
        if (!grades.length) return;
        myChart = buildGradeChart(ctx, grades, isDark);
    } else if (filterType === 'progress') {
        const courses = await fetchProgressForChart(userId);
        if (!courses.length) return;
        myChart = buildProgressChart(ctx, courses, isDark);
    }
}

// ─────────────────────────────────────────
// EVENT WIRING
// ─────────────────────────────────────────

function wireAllEvents(user) {
    // ── Sidebar / data-target navigation ──────────────────
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target]');
        if (target) { e.preventDefault(); switchView(target.getAttribute('data-target')); }
    });

    // ── Logout ────────────────────────────────────────────
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await signOut();
        window.location.href = 'index.html';
    });

    // ── Theme toggle ──────────────────────────────────────
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        toggleTheme();
        const filterVal = document.getElementById('chartFilter')?.value || 'grades';
        loadPerformanceChart(user.id, filterVal);
    });

    // ── Chart filter ──────────────────────────────────────
    document.getElementById('chartFilter')?.addEventListener('change', (e) => {
        loadPerformanceChart(user.id, e.target.value);
    });

    // ── Live search ───────────────────────────────────────
    document.querySelector('.search-bar input')?.addEventListener('keyup', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeView = document.querySelector('.page-view.active');
        if (!activeView) return;

        const searchMap = {
            'view-grades':    '#gradesTableBody tr',
            'view-courses':   '#db-courses-container .course-card',
            'view-resources': '#resourcesGrid .resource-card',
            'view-messages':  '#messageInboxList .message-item',
        };
        const selector = searchMap[activeView.id];
        if (selector) {
            document.querySelectorAll(selector).forEach(el => {
                const text = activeView.id === 'view-grades'
                    ? el.cells[0]?.textContent.toLowerCase()
                    : el.textContent.toLowerCase();
                el.style.display = text?.includes(searchTerm) ? '' : 'none';
            });
        }
    });

    // ── Message modal close ───────────────────────────────
    document.getElementById('msgModalClose')?.addEventListener('click', closeMessageModal);
    document.getElementById('messageModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('messageModalOverlay')) closeMessageModal();
    });

    // ── Deadline modal close ──────────────────────────────
    document.getElementById('dlModalClose')?.addEventListener('click', closeDeadlineModal);
    document.getElementById('deadlineModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('deadlineModalOverlay')) closeDeadlineModal();
    });

    // ── Compose: open / close ─────────────────────────────
    document.getElementById('composeNewBtn')?.addEventListener('click', () => openCompose());
    document.getElementById('composeCloseBtn')?.addEventListener('click', closeCompose);
    document.getElementById('composeCancelBtn')?.addEventListener('click', closeCompose);
    document.getElementById('composeModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('composeModalOverlay')) closeCompose();
    });

    // ── Compose: send ─────────────────────────────────────
    document.getElementById('composeSendBtn')?.addEventListener('click', async () => {
        const { recipientId, subject, content } = getComposeValues();
        if (!subject || !content) { alert('Please fill in subject and message.'); return; }

        setComposeSending(true);
        const senderName = await fetchSenderName(user.id) || user.email;
        const { error } = await sendMessage({ recipientId, senderId: user.id, senderName, subject, content });

        if (error) {
            alert('Message failed to send. Please try again.');
            console.error("Send Error:", error.message);
        } else {
            closeCompose();
            showToast('Message sent!', 'success');
            await loadMessages(user.id);
        }
        setComposeSending(false);
    });

    // ── Avatar upload ─────────────────────────────────────
    const uploadBtn   = document.getElementById('uploadBtn');
    const avatarInput = document.getElementById('avatarInput');
    if (uploadBtn && avatarInput) {
        uploadBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            uploadBtn.textContent = 'Uploading...';

            const { error, publicUrl } = await uploadAvatar(user.id, file);
            if (error) { console.error("Upload Error:", error.message); uploadBtn.textContent = 'Retry Upload'; return; }

            const { error: dbErr } = await upsertProfile(user.id, { avatar_url: publicUrl });
            if (dbErr) {
                console.error("DB Update Error:", dbErr.message);
                uploadBtn.textContent = 'Retry Upload';
            } else {
                updateAllAvatars(publicUrl);
                uploadBtn.textContent = 'Success! ✓';
                showToast('Profile photo updated!', 'success');
                setTimeout(() => uploadBtn.textContent = 'Upload New Photo', 2000);
            }
            avatarInput.value = '';
        });
    }

    // ── Settings: save profile ────────────────────────────
    document.querySelector('.settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settingName')?.value?.trim();
        const bio  = document.getElementById('settingBio')?.value?.trim();
        const saveBtn = e.target.querySelector('[type="submit"]');
        if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }

        const { error } = await updateProfile(user.id, { full_name: name, bio });
        if (!error) updateProfileNameInUI(name);

        if (saveBtn) {
            saveBtn.textContent = error ? 'Error — Retry' : 'Saved! ✓';
            saveBtn.disabled = false;
            setTimeout(() => { saveBtn.textContent = 'Save Profile Changes'; }, 2500);
        }
    });

    // ── Settings: save Target GWA ─────────────────────────
    document.getElementById('saveGwaBtn')?.addEventListener('click', async () => {
        const val = parseFloat(document.getElementById('targetGwaInput')?.value);
        if (isNaN(val) || val < 1.0 || val > 5.0) { alert('Please enter a valid GWA between 1.00 and 5.00'); return; }

        const btn = document.getElementById('saveGwaBtn');
        if (btn) btn.textContent = 'Saving...';

        const { error } = await updateProfile(user.id, { target_gwa: val });
        if (!error) {
            const display = document.getElementById('targetGwaDisplay');
            if (display) display.textContent = val.toFixed(2);
            showToast('Target GWA saved!', 'success');
        }
        if (btn) btn.textContent = 'Save';
    });

    // ── Resources: filter pills ───────────────────────────
    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-filter');
        document.querySelectorAll('#resourcesGrid .resource-card').forEach(card => {
            const badge = card.querySelector('.resource-type-badge');
            if (!badge) return;
            const type = badge.textContent.toLowerCase();
            if (filter === 'all') card.style.display = '';
            else if (filter === 'pdf') card.style.display = type === 'pdf' ? '' : 'none';
            else if (filter === 'docx') card.style.display = ['docx','doc'].includes(type) ? '' : 'none';
            else card.style.display = !['pdf','docx','doc'].includes(type) ? '' : 'none';
        });
    });
}

// ─────────────────────────────────────────
// HELPER: get current user id from session
// (used in handleMessageOpen without re-passing user object)
// ─────────────────────────────────────────
function currentUserId() {
    // Cached from the boot — avoids another async call
    return window.__currentUserId;
}

// Cache userId at boot for use in callbacks
getSession().then(s => { if (s) window.__currentUserId = s.user.id; });