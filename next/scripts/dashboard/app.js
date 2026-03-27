import { supabaseClient } from './config.js';
import { showToast } from './utils.js';
import { updateAllAvatars, switchView } from './ui.js';
import { 
    initProfile, loadResources, loadTodaysSchedule, loadWeeklySchedule, 
    loadMessages, updateUnreadCount, loadPaymentData, loadDeadlines, 
    loadAttendance, loadCoursesData, loadGradesData, loadNotices, 
    loadSmartDashboardData, loadPerformanceChart, myChart 
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. AUTHENTICATION & SESSION CHECK
    // ==========================================
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    const user = session.user;

    // ==========================================
    // 2. UNIVERSAL LIVE SEARCH LOGIC (UPGRADED)
    // ==========================================
    const topSearchInput = document.querySelector('.search-bar input');
    if (topSearchInput) {
        topSearchInput.addEventListener('keyup', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const activeView = document.querySelector('.page-view.active');
            if (!activeView) return;

            if (activeView.id === 'view-grades') {
                document.querySelectorAll('#gradesTableBody tr').forEach(row => {
                    row.style.display = row.cells[0]?.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            }
            if (activeView.id === 'view-courses') {
                document.querySelectorAll('#db-courses-container .course-card').forEach(card => {
                    card.style.display = card.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            }
            if (activeView.id === 'view-resources') {
                document.querySelectorAll('#resourcesGrid .resource-card').forEach(card => {
                    card.style.display = card.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            }
            if (activeView.id === 'view-messages') {
                document.querySelectorAll('#messageInboxList .message-item').forEach(item => {
                    item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            }
        });
    }

    // SETTINGS: Save profile changes
    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('settingName')?.value?.trim();
            const bio = document.getElementById('settingBio')?.value?.trim();
            const saveBtn = settingsForm.querySelector('[type="submit"]');
            if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }

            const { error } = await supabaseClient.from('profiles').update({ full_name: name, bio }).eq('id', user.id);
            if (!error) {
                const topbarName = document.getElementById('topbarName');
                if (topbarName) topbarName.textContent = name;
                const welcomeMsg = document.getElementById('welcomeMessage');
                if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${name.split(' ')[0]}!`;
            }
            if (saveBtn) { saveBtn.textContent = error ? 'Error - Retry' : 'Saved! ✓'; saveBtn.disabled = false; setTimeout(() => { saveBtn.textContent = 'Save Profile Changes'; }, 2500); }
        });
    }

    // TARGET GWA SAVE
    const saveGwaBtn = document.getElementById('saveGwaBtn');
    if (saveGwaBtn) {
        saveGwaBtn.addEventListener('click', async () => {
            const val = parseFloat(document.getElementById('targetGwaInput')?.value);
            if (isNaN(val) || val < 1.0 || val > 5.0) { alert('Please enter a valid GWA between 1.00 and 5.00'); return; }
            saveGwaBtn.textContent = 'Saving...';
            const { error } = await supabaseClient.from('profiles').update({ target_gwa: val }).eq('id', user.id);
            if (!error) {
                const targetGwaDisplay = document.getElementById('targetGwaDisplay');
                if (targetGwaDisplay) targetGwaDisplay.textContent = val.toFixed(2);
                showToast('Target GWA saved!', 'success');
            }
            saveGwaBtn.textContent = 'Save';
        });
    }

    // PHOTO UPLOAD LOGIC (FIXED)
    const uploadBtn = document.getElementById('uploadBtn');
    const avatarInput = document.getElementById('avatarInput');
    if (uploadBtn && avatarInput) {
        uploadBtn.addEventListener('click', () => avatarInput.click());
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            uploadBtn.textContent = 'Uploading...';
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/avatar.${fileExt}`;

            await supabaseClient.storage.from('avatars').remove([filePath]);

            const { error: upErr } = await supabaseClient.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (upErr) { console.error("Upload Error:", upErr.message); uploadBtn.textContent = 'Retry Upload'; return; }

            const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);

            const { error: dbError } = await supabaseClient.from('profiles').upsert({ id: user.id, avatar_url: publicUrl }, { onConflict: 'id' });

            if (dbError) {
                console.error("Database Update Error:", dbError.message);
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

    // GLOBAL MODALS AND HANDLERS 
    window.openMessageModal = async function(msgId, subject, content, senderName, timeAgo, isUnread) {
        const overlay = document.getElementById('messageModalOverlay');
        if (!overlay) return;

        document.getElementById('msgModalSubject').textContent = subject;
        document.getElementById('msgModalContent').textContent = content;
        document.getElementById('msgModalSender').textContent = `From: ${senderName}`;
        document.getElementById('msgModalTime').textContent = timeAgo;
        overlay.classList.add('open');

        if (isUnread) {
            await supabaseClient.from('portal_messages').update({ is_read: true }).eq('id', msgId);

            const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
            if (msgEl) {
                msgEl.classList.remove('unread');
                const badge = msgEl.querySelector('.unread-badge');
                if (badge) badge.remove();
                const icon = msgEl.querySelector('.message-icon');
                if (icon) icon.classList.remove('unread-icon');
            }
            updateUnreadCount(user.id);
        }
    };

    window.openDeadlineModal = function(deadlineData) {
        const d = typeof deadlineData === 'string' ? JSON.parse(deadlineData) : deadlineData;
        const overlay = document.getElementById('deadlineModalOverlay');
        if (!overlay) return;

        const dueDate = new Date(d.due_date);
        const isLate = d.status !== 'submitted' && dueDate < new Date();

        document.getElementById('dlModalTitle').textContent = d.title || '—';
        document.getElementById('dlModalSubject').textContent = d.subject || '—';
        document.getElementById('dlModalType').textContent = (d.type || 'Task').toUpperCase();
        document.getElementById('dlModalDue').textContent = dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        document.getElementById('dlModalStatus').textContent = isLate && d.status !== 'submitted' ? 'Late' : d.status || 'Pending';
        document.getElementById('dlModalStatus').className = `dl-status-value status-${isLate && d.status !== 'submitted' ? 'late' : (d.status || 'pending').toLowerCase()}`;
        document.getElementById('dlModalScore').textContent = d.score !== null && d.score !== undefined ? d.score : 'Not yet graded';
        document.getElementById('dlModalNotes').textContent = d.notes || 'No additional notes.';

        overlay.classList.add('open');
    };

    window.openComposeToInstructor = function(instructorName, courseName) {
        const overlay = document.getElementById('composeModalOverlay');
        if (overlay) overlay.classList.add('open');
        const toField = document.getElementById('composeToDisplay');
        if (toField) toField.textContent = `${instructorName} — ${courseName}`;
        const subjectField = document.getElementById('composeSubject');
        if (subjectField) subjectField.value = `Re: ${courseName}`;
        const recipientField = document.getElementById('composeRecipientId');
        if (recipientField) recipientField.value = instructorName;
        const contentField = document.getElementById('composeContent');
        if (contentField) { contentField.value = ''; setTimeout(() => contentField.focus(), 100); }
    };

    document.getElementById('msgModalClose')?.addEventListener('click', () => {
        document.getElementById('messageModalOverlay')?.classList.remove('open');
    });
    document.getElementById('messageModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('messageModalOverlay'))
            document.getElementById('messageModalOverlay').classList.remove('open');
    });

    document.getElementById('dlModalClose')?.addEventListener('click', () => {
        document.getElementById('deadlineModalOverlay')?.classList.remove('open');
    });
    document.getElementById('deadlineModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('deadlineModalOverlay'))
            document.getElementById('deadlineModalOverlay').classList.remove('open');
    });

    // DARK MODE & THEME TOGGLE
    const themeBtn = document.getElementById('themeToggle');
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            if (myChart) {
                const currentFilter = document.getElementById('chartFilter')?.value || 'grades';
                loadPerformanceChart(user.id, currentFilter);
            }
        });
    }

    const chartFilter = document.getElementById('chartFilter');
    if (chartFilter) {
        chartFilter.addEventListener('change', (e) => {
            loadPerformanceChart(user.id, e.target.value);
        });
    }

    // COMPOSE MODAL LOGIC
    const composeOverlay = document.getElementById('composeModalOverlay');
    const composeCloseBtn = document.getElementById('composeCloseBtn');
    const composeCancelBtn = document.getElementById('composeCancelBtn');
    const composeSendBtn = document.getElementById('composeSendBtn');
    const composeNewBtn = document.getElementById('composeNewBtn');

    function openCompose() {
        const overlay = document.getElementById('composeModalOverlay');
        if (overlay) overlay.classList.add('open');
        const toField = document.getElementById('composeToDisplay');
        if (toField) toField.textContent = 'New Message';
        const recipientField = document.getElementById('composeRecipientId');
        if (recipientField) recipientField.value = '';
        const subjectField = document.getElementById('composeSubject');
        if (subjectField) subjectField.value = '';
        const contentField = document.getElementById('composeContent');
        if (contentField) contentField.value = '';
    }

    function closeCompose() {
        const overlay = document.getElementById('composeModalOverlay');
        if (overlay) overlay.classList.remove('open');
    }

    if (composeCloseBtn) composeCloseBtn.addEventListener('click', closeCompose);
    if (composeCancelBtn) composeCancelBtn.addEventListener('click', closeCompose);
    if (composeNewBtn) composeNewBtn.addEventListener('click', openCompose);
    if (composeOverlay) composeOverlay.addEventListener('click', (e) => { if (e.target === composeOverlay) closeCompose(); });

    if (composeSendBtn) {
        composeSendBtn.addEventListener('click', async () => {
            const recipientId = document.getElementById('composeRecipientId')?.value?.trim();
            const subject = document.getElementById('composeSubject')?.value?.trim();
            const content = document.getElementById('composeContent')?.value?.trim();
            if (!subject || !content) { alert('Please fill in subject and message.'); return; }

            composeSendBtn.textContent = 'Sending...';
            composeSendBtn.disabled = true;

            const { data: senderProfile } = await supabaseClient.from('profiles').select('full_name').eq('id', user.id).single();
            const senderName = senderProfile?.full_name || user.email;

            const { error } = await supabaseClient.from('portal_messages').insert({
                recipient_id: recipientId || null,
                sender_id: user.id,
                sender_name: senderName,
                subject, content, is_read: false
            });

            if (error) {
                alert('Message failed to send. Please try again.');
                console.error("Send Error:", error.message);
            } else {
                closeCompose();
                showToast('Message sent!', 'success');
                await loadMessages(user.id);
            }

            composeSendBtn.innerHTML = '<span class="material-symbols-outlined">send</span> Send';
            composeSendBtn.disabled = false;
        });
    }

    // ==========================================
    // 7. INITIALIZATION & LOGOUT
    // ==========================================
    async function startAllModules() {
        await initProfile(user);
        const userId = user.id;
        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        await Promise.all([
            loadSmartDashboardData(userId),
            loadPerformanceChart(userId),
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
        ]);
    }

    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-target]');
        if (target) {
            e.preventDefault();
            switchView(target.getAttribute('data-target'));
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    });

    startAllModules();
});