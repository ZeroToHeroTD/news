import { supabaseClient } from './config.js';
import { showToast } from './utils.js';
import { updateAllAvatars, switchView } from './ui.js';
import { 
    initProfile, loadResources, loadTodaysSchedule, loadWeeklySchedule, 
    loadMessages, updateUnreadCount, loadPaymentData, loadDeadlines, 
    loadAttendance, loadCoursesData, loadGradesData, loadNotices, 
    loadSmartDashboardData, loadPerformanceChart, loadSocialDirectory, 
    initializePresence, myChart 
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
    // 2. UNIVERSAL LIVE SEARCH LOGIC
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

    // ==========================================
    // 3. SETTINGS & PROFILE UPDATES
    // ==========================================
    const settingsForm = document.querySelector('.settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('settingName')?.value?.trim();
            const bio = document.getElementById('settingBio')?.value?.trim();
            const course = document.getElementById('settingCourse')?.value?.trim();
            const section = document.getElementById('settingSection')?.value?.trim();
            
            const saveBtn = settingsForm.querySelector('[type="submit"]');
            if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }

            const { error } = await supabaseClient.from('profiles').upsert({ 
                id: user.id, 
                full_name: name, 
                bio: bio,
                course: course,
                section: section
            }, { onConflict: 'id' });

            if (!error) {
                const topbarName = document.getElementById('topbarName');
                if (topbarName) topbarName.textContent = name;
                const welcomeMsg = document.getElementById('welcomeMessage');
                if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${name.split(' ')[0]}!`;
                
                const roleDisplay = document.querySelector('.sidebar-user-role');
                if (roleDisplay) {
                    roleDisplay.textContent = course ? `${course} ${section ? '• ' + section : ''}` : 'Student';
                }
            } else {
                console.error("Save Error:", error.message);
            }
            
            if (saveBtn) { 
                saveBtn.textContent = error ? 'Error - Retry' : 'Saved! ✓'; 
                saveBtn.disabled = false; 
                setTimeout(() => { saveBtn.textContent = 'Save Profile Changes'; }, 2500); 
            }
        });
    }

    const saveGwaBtn = document.getElementById('saveGwaBtn');
    if (saveGwaBtn) {
        saveGwaBtn.addEventListener('click', async () => {
            const val = parseFloat(document.getElementById('targetGwaInput')?.value);
            if (isNaN(val) || val < 1.0 || val > 5.0) { alert('Please enter a valid GWA between 1.00 and 5.00'); return; }
            
            saveGwaBtn.textContent = 'Saving...';
            
            const { error } = await supabaseClient.from('profiles').upsert({ 
                id: user.id, 
                target_gwa: val 
            }, { onConflict: 'id' });
            
            if (!error) {
                const targetGwaDisplay = document.getElementById('targetGwaDisplay');
                if (targetGwaDisplay) targetGwaDisplay.textContent = val.toFixed(2);
                
                const targetGwaSettingDisplay = document.getElementById('targetGwaSettingDisplay');
                if (targetGwaSettingDisplay) targetGwaSettingDisplay.textContent = val.toFixed(2);
                
                showToast('Target GWA saved!', 'success');
            } else {
                console.error("GWA Save Error:", error.message);
                showToast('Failed to save GWA', 'error');
            }
            
            saveGwaBtn.textContent = 'Save';
        });
    }

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

    // ==========================================
    // 4. VIEW MODALS (Inbox & Deadlines)
    // ==========================================
    window.showToast = showToast;

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

    // Close logic for view modals
    document.getElementById('msgModalClose')?.addEventListener('click', () => {
        document.getElementById('messageModalOverlay')?.classList.remove('open');
    });
    document.getElementById('messageModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('messageModalOverlay')) e.target.classList.remove('open');
    });

    document.getElementById('dlModalClose')?.addEventListener('click', () => {
        document.getElementById('deadlineModalOverlay')?.classList.remove('open');
    });
    document.getElementById('deadlineModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('deadlineModalOverlay')) e.target.classList.remove('open');
    });

    // ==========================================
    // 5. MASTER COMPOSE MESSAGE LOGIC
    // ==========================================

// Add this to the VERY TOP of your script (outside any functions)
let secretReceiverId = null; 

window.openComposeToInstructor = function(name, idOrCourse) {
    // 1. Regex to check if the string is a Supabase UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCourse);
    const overlay = document.getElementById('composeModalOverlay');
    const displayTo = document.getElementById('composeToDisplay');
    const subjectField = document.getElementById('composeSubject');
    
    if (overlay) overlay.classList.add('open'); 
    
    if (isUUID) {
        // Direct Message Mode
        secretReceiverId = idOrCourse;
        if (subjectField) subjectField.value = ''; 
        if (displayTo) displayTo.textContent = `To: ${name}`;
    } else {
        // Course Reply Mode
        secretReceiverId = null; 
        if (subjectField) subjectField.value = `Question: ${idOrCourse}`;
        if (displayTo) displayTo.textContent = `To: ${name} (${idOrCourse})`;
    }

    // Populate visible read-only field (if you have one)
    const recipientField = document.getElementById('composeRecipientId');
    if (recipientField) recipientField.value = name;
    
    // Auto-focus the content
    const contentField = document.getElementById('composeContent');
    if (contentField) { 
        contentField.value = ''; 
        setTimeout(() => contentField.focus(), 250); 
    }
};
    // Open from "New Message" Button in Inbox
    const composeNewBtn = document.getElementById('composeNewBtn');
    if (composeNewBtn) {
        composeNewBtn.addEventListener('click', () => {
            secretReceiverId = null; 
            const overlay = document.getElementById('composeModalOverlay');
            if (overlay) overlay.classList.add('open');
            
            if (document.getElementById('composeToDisplay')) document.getElementById('composeToDisplay').textContent = 'New Message';
            if (document.getElementById('composeRecipientId')) document.getElementById('composeRecipientId').value = '';
            if (document.getElementById('composeSubject')) document.getElementById('composeSubject').value = '';
            if (document.getElementById('composeContent')) document.getElementById('composeContent').value = '';
        });
    }

    // Close Compose Modal
    function closeComposeModal() {
        document.getElementById('composeModalOverlay')?.classList.remove('open');
    }
    document.getElementById('composeCloseBtn')?.addEventListener('click', closeComposeModal);
    document.getElementById('composeCancelBtn')?.addEventListener('click', closeComposeModal);
    document.getElementById('composeModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('composeModalOverlay')) closeComposeModal();
    });

 // The ONE AND ONLY Send Button Listener
    const composeSendBtn = document.getElementById('composeSendBtn');
    if (composeSendBtn) {
        composeSendBtn.addEventListener('click', async () => {
            let finalReceiverId = secretReceiverId;
            const manualRecipientId = document.getElementById('composeRecipientId')?.value?.trim();
            
            if (!finalReceiverId && manualRecipientId) {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(manualRecipientId);
                if (isUUID) {
                    finalReceiverId = manualRecipientId;
                } else {
                    alert("Please use the Social tab to message users securely.");
                    return;
                }
            }

            if (!finalReceiverId) { alert("Please select a valid recipient."); return; }

            const subject = document.getElementById('composeSubject')?.value?.trim() || 'No Subject';
            const content = document.getElementById('composeContent')?.value?.trim() || '';
            
            if (!content) { alert("Please type a message first!"); return; }

            const originalText = composeSendBtn.innerHTML;
            composeSendBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1rem;">hourglass_empty</span> Sending...';
            composeSendBtn.disabled = true;

            // FIX 1: Securely fetch your actual profile name before sending
            const { data: senderProfile } = await supabaseClient.from('profiles').select('full_name').eq('id', user.id).single();
            const senderName = senderProfile?.full_name || user.email;

            // FIX 2: Use recipient_id and sender_name correctly!
            const { error } = await supabaseClient.from('portal_messages').insert({
                sender_id: user.id,
                recipient_id: finalReceiverId, // Changed back from receiver_id
                sender_name: senderName,       // Attached your actual name!
                subject: subject,
                content: content
            });

            if (error) {
                console.error("Message Error:", error.message);
                alert("Message failed to send: " + error.message);
            } else {
                showToast('Message sent successfully!', 'success');
                closeComposeModal();
                if (document.getElementById('composeSubject')) document.getElementById('composeSubject').value = '';
                if (document.getElementById('composeContent')) document.getElementById('composeContent').value = '';
            }

            composeSendBtn.innerHTML = originalText;
            composeSendBtn.disabled = false;
        });
    }
    // ==========================================
    // 6. UI TOGGLES (THEME & TABS)
    // ==========================================
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

    // ==========================================
    // 7. INITIALIZATION (FIRE IT UP!)
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
            loadSocialDirectory(userId),
        ]);

        initializePresence(userId);
    }

    startAllModules();
});