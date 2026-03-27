// Initialize Supabase
const supabaseUrl = "https://ekayczuyxmhbiyvyjwad.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrYXljenV5eG1oYml5dnlqd2FkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNzYzMDEsImV4cCI6MjA4OTg1MjMwMX0.dRz-nU9dAsYiOV-xKRKwfXrsX9DdLdHGYuwXsm063wQ";
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

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
            // NEW: Search messages
            if (activeView.id === 'view-messages') {
                document.querySelectorAll('#messageInboxList .message-item').forEach(item => {
                    item.style.display = item.textContent.toLowerCase().includes(searchTerm) ? "" : "none";
                });
            }
        });
    }

    // ==========================================
    // 3. PROFILE & AVATAR LOGIC (FIXED)
    // ==========================================
    function updateAllAvatars(url) {
        const cacheBusted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        const navAv = document.getElementById('navAvatar');
        const setAv = document.getElementById('settingsAvatar');
        // Only cache-bust storage URLs, not ui-avatars
        const finalUrl = url.includes('supabase') ? cacheBusted : url;
        if (navAv) { navAv.src = finalUrl; navAv.onerror = () => { navAv.src = `https://ui-avatars.com/api/?name=Student&background=0062ff&color=fff`; }; }
        if (setAv) { setAv.src = finalUrl; setAv.onerror = () => { setAv.src = `https://ui-avatars.com/api/?name=Student&background=0062ff&color=fff`; }; }
    }

    async function initProfile() {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) console.error("Profile Fetch Error:", error.message);

        const fullName = profile?.full_name || user.user_metadata?.full_name || 'Student';
        const email = profile?.email || user.email;
        const bio = profile?.bio || user.user_metadata?.bio || 'Passionate learner!';

        // FIX: Always load avatar from DB first, then fallback
        const avatarUrl = profile?.avatar_url ||
            user.user_metadata?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0062ff&color=fff`;

        const topbarName = document.getElementById('topbarName');
        if (topbarName) topbarName.textContent = fullName;

        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${fullName.split(' ')[0]}!`;

        if (document.getElementById('settingName')) document.getElementById('settingName').value = fullName;
        if (document.getElementById('settingEmail')) document.getElementById('settingEmail').value = email;
        if (document.getElementById('settingBio')) document.getElementById('settingBio').value = bio;

        // Load target GWA
        const targetGwaInput = document.getElementById('targetGwaInput');
        const targetGwaDisplay = document.getElementById('targetGwaDisplay');
        if (targetGwaInput && profile?.target_gwa) targetGwaInput.value = profile.target_gwa;
        if (targetGwaDisplay && profile?.target_gwa) targetGwaDisplay.textContent = parseFloat(profile.target_gwa).toFixed(2);

        updateAllAvatars(avatarUrl);
        checkUserPermissions(profile?.role);
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
            // FIX: Use consistent path so old files are overwritten, preventing stale URL issues
            const filePath = `${user.id}/avatar.${fileExt}`;

            // Remove old avatar first
            await supabaseClient.storage.from('avatars').remove([filePath]);

            const { error: upErr } = await supabaseClient.storage.from('avatars').upload(filePath, file, { upsert: true });
            if (upErr) { console.error("Upload Error:", upErr.message); uploadBtn.textContent = 'Retry Upload'; return; }

            const { data: { publicUrl } } = supabaseClient.storage.from('avatars').getPublicUrl(filePath);

            // FIX: Save to profiles table AND user metadata
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
    // 4. PERMISSIONS & NAVIGATION
    // ==========================================
    function checkUserPermissions(role) {
        const cleanRole = (role || "").trim().toLowerCase();
        const addBtn = document.getElementById('addResourceBtn');
        const composeMsgBtn = document.getElementById('composeMsgBtn');
        const isAdmin = cleanRole === 'admin' || cleanRole === 'teacher';
        if (addBtn) addBtn.style.display = isAdmin ? "block" : "none";
        if (composeMsgBtn) composeMsgBtn.style.display = isAdmin ? "block" : "none";
    }

    const allViews = document.querySelectorAll('.page-view');
    const sidebarLinks = document.querySelectorAll('.nav-links li');

    function switchView(targetId) {
        if (!targetId) return;
        allViews.forEach(v => v.classList.remove('active'));
        sidebarLinks.forEach(l => l.classList.remove('active'));

        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');

        const sidebarItem = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
        if (sidebarItem) sidebarItem.classList.add('active');

        // FIX: DO NOT mark all messages as read when switching to inbox
        // This was the root cause of the read/unread bug
        // Individual message read status is now handled in the click handler
    }

    // ==========================================
    // 5. TOAST NOTIFICATION HELPER
    // ==========================================
    function showToast(message, type = 'info') {
        const existing = document.getElementById('toast-notif');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'toast-notif';
        const colors = { success: '#10b981', error: '#ef4444', info: '#0062ff', warning: '#f59e0b' };
        toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${colors[type]};color:white;padding:14px 22px;border-radius:14px;font-weight:700;font-size:0.88rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:slideInRight 0.3s ease;`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'fadeOut 0.3s ease'; setTimeout(() => toast.remove(), 300); }, 3000);
    }

    // ==========================================
    // 6. DATA LOADERS
    // ==========================================

    async function loadResources() {
        const grid = document.getElementById('resourcesGrid');
        if (!grid) return;
        const { data: files } = await supabaseClient.from('portal_resources').select('*').order('created_at', { ascending: false });
        if (files && files.length > 0) {
            grid.innerHTML = files.map(file => {
                const ext = (file.file_type || 'other').toLowerCase();
                const iconMap = { pdf: '📕', docx: '📘', doc: '📘', pptx: '📙', ppt: '📙', xlsx: '📗', xls: '📗' };
                const icon = iconMap[ext] || '📁';
                const typeClass = ['pdf', 'docx', 'doc'].includes(ext) ? ext : ['pptx', 'ppt'].includes(ext) ? 'pptx' : 'other';
                const rawDate = file.created_at ? new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                return `
                <div class="resource-card" onclick="window.open('${file.file_url}', '_blank')">
                    <div class="resource-card-preview ${typeClass}">${icon}</div>
                    <div class="resource-card-body">
                        <h4>${file.title}</h4>
                        <span class="resource-type-badge ${typeClass}">${ext.toUpperCase()}</span>
                    </div>
                    <div class="resource-card-footer">
                        <span class="resource-date">${rawDate}</span>
                        <button class="resource-open-btn">Open <span class="material-symbols-outlined">arrow_forward</span></button>
                    </div>
                </div>`;
            }).join('');
        } else {
            grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">No resources uploaded yet.</p>`;
        }
    }

    async function loadTodaysSchedule(userId) {
        const container = document.getElementById('todaysScheduleList');
        if (!container) return;
        const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
        const { data: schedule } = await supabaseClient.from('student_schedule').select('*').eq('student_id', userId).eq('day_of_week', today).order('start_time', { ascending: true });
        if (schedule && schedule.length > 0) {
            container.innerHTML = schedule.map(item => {
                const endTime = item.end_time ? item.end_time.substring(0, 5) : '';
                return `<div class="schedule-item-card ${item.is_urgent ? 'is-urgent' : ''}">
                    <div class="schedule-time-badge">
                        <span class="time-start">${item.start_time.substring(0, 5)}</span>
                        ${endTime ? `<span class="time-sep">to</span><span class="time-end">${endTime}</span>` : ''}
                    </div>
                    <div class="schedule-item-info">
                        <h4>${item.course_name}</h4>
                        <p>${item.instructor || 'TBA'}</p>
                        <span class="room-badge"><span class="material-symbols-outlined" style="font-size:0.75rem;">location_on</span> ${item.room}</span>
                    </div>
                </div>`;
            }).join('');
        } else {
            container.innerHTML = `<p style="color:var(--text-muted); padding:10px;">No classes today! 🥳</p>`;
        }
    }

    async function loadWeeklySchedule(userId) {
        const grid = document.getElementById('weeklyScheduleGrid');
        if (!grid) return;
        const { data: schedule } = await supabaseClient.from('student_schedule').select('*').eq('student_id', userId).order('start_time', { ascending: true });
        if (schedule && grid) {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            grid.innerHTML = days.map(day => {
                const dayClasses = schedule.filter(item => item.day_of_week === day);
                if (dayClasses.length === 0) return '';
                return `
                <div class="schedule-day-block">
                    <span class="schedule-day-label">${day}</span>
                    <div class="schedule-items-grid">
                        ${dayClasses.map(item => {
                            const endTime = item.end_time ? item.end_time.substring(0, 5) : '';
                            return `<div class="schedule-item-card ${item.is_urgent ? 'is-urgent' : ''}">
                                <div class="schedule-time-badge">
                                    <span class="time-start">${item.start_time.substring(0, 5)}</span>
                                    ${endTime ? `<span class="time-sep">to</span><span class="time-end">${endTime}</span>` : ''}
                                </div>
                                <div class="schedule-item-info">
                                    <h4>${item.course_name}</h4>
                                    <p>${item.instructor || 'TBA'}</p>
                                    <span class="room-badge"><span class="material-symbols-outlined" style="font-size:0.75rem;">location_on</span> ${item.room}</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }).join('');
        }
    }

    // ==========================================
    // FIX #1: MESSAGES — Per-message read/unread
    // ==========================================
    async function loadMessages(userId) {
        const list = document.getElementById('messageInboxList');
        if (!list) return;

        // Fetch both personal messages AND announcements (recipient_id = null)
        const { data: personal } = await supabaseClient
            .from('portal_messages').select('*')
            .eq('recipient_id', userId)
            .order('created_at', { ascending: false });

        const { data: announcements } = await supabaseClient
            .from('portal_messages').select('*')
            .is('recipient_id', null)
            .order('created_at', { ascending: false });

        const messages = [...(announcements || []).map(m => ({ ...m, _type: 'announcement' })),
                          ...(personal || []).map(m => ({ ...m, _type: 'personal' }))];

        messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (messages.length > 0) {
            list.innerHTML = messages.map(msg => {
                const isUnread = !msg.is_read;
                const timeAgo = getTimeAgo(msg.created_at);
                const isAnnouncement = msg._type === 'announcement';
                return `
                <div class="message-item ${isUnread ? 'unread' : ''} ${isAnnouncement ? 'announcement' : ''}"
                     data-msg-id="${msg.id}"
                     data-recipient-id="${msg.recipient_id || ''}"
                     onclick="openMessageModal('${msg.id}', '${escapeAttr(msg.subject)}', '${escapeAttr(msg.content)}', '${escapeAttr(msg.sender_name)}', '${timeAgo}', ${isUnread})">
                    <div class="message-icon ${isUnread ? 'unread-icon' : ''}">
                        <span class="material-symbols-outlined">${isAnnouncement ? 'campaign' : 'mail'}</span>
                    </div>
                    <div class="message-body">
                        <div class="message-meta">
                            <h4>${msg.subject}</h4>
                            ${isUnread ? '<span class="unread-badge">NEW</span>' : ''}
                            ${isAnnouncement ? '<span class="announcement-badge">Announcement</span>' : ''}
                        </div>
                        <p>${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}</p>
                        <div class="message-footer-row">
                            <span class="message-sender">From: ${msg.sender_name}</span>
                            <span class="message-time">${timeAgo}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:40px;">Inbox empty.</p>`;
        }

        // Update unread count
        updateUnreadCount(userId);
    }

    function escapeAttr(str) {
        return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
    }

    function getTimeAgo(dateStr) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    async function updateUnreadCount(userId) {
        const { count } = await supabaseClient
            .from('portal_messages').select('*', { count: 'exact', head: true })
            .eq('recipient_id', userId).eq('is_read', false);

        const msgDot = document.getElementById('msg-count-dot');
        const smartMsgLabel = document.getElementById('smart-msg-label');
        const notifBadge = document.getElementById('notifBadge');

        if (count > 0) {
            if (msgDot) { msgDot.style.display = 'block'; msgDot.textContent = count > 9 ? '9+' : count; }
            if (smartMsgLabel) { smartMsgLabel.textContent = `${count} unread`; smartMsgLabel.style.color = 'var(--primary)'; }
        } else {
            if (msgDot) msgDot.style.display = 'none';
            if (smartMsgLabel) { smartMsgLabel.textContent = 'No unread'; smartMsgLabel.style.color = ''; }
        }
        if (notifBadge && count > 0) { notifBadge.style.display = 'flex'; notifBadge.textContent = count; }
        else if (notifBadge) notifBadge.style.display = 'none';
    }

    // Open message modal and mark as read
    window.openMessageModal = async function(msgId, subject, content, senderName, timeAgo, isUnread) {
        const overlay = document.getElementById('messageModalOverlay');
        if (!overlay) return;

        document.getElementById('msgModalSubject').textContent = subject;
        document.getElementById('msgModalContent').textContent = content;
        document.getElementById('msgModalSender').textContent = `From: ${senderName}`;
        document.getElementById('msgModalTime').textContent = timeAgo;
        overlay.classList.add('open');

        // FIX: Mark ONLY this message as read
        if (isUnread) {
            await supabaseClient.from('portal_messages').update({ is_read: true }).eq('id', msgId);

            // Update UI without full reload
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

    // Close message modal
    document.getElementById('msgModalClose')?.addEventListener('click', () => {
        document.getElementById('messageModalOverlay')?.classList.remove('open');
    });
    document.getElementById('messageModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('messageModalOverlay'))
            document.getElementById('messageModalOverlay').classList.remove('open');
    });

    // ==========================================
    // FIX #2: PAYMENTS — Enhanced UI
    // ==========================================
    async function loadPaymentData(userId) {
        const tableBody = document.getElementById('paymentsTableBody');
        if (!tableBody) return;

        const { data: payments } = await supabaseClient.from('student_payments').select('*').eq('student_id', userId);
        if (payments) {
            let totalAmount = 0, paidAmount = 0, pendingAmount = 0;

            payments.forEach(p => {
                const amt = parseFloat(p.amount);
                totalAmount += amt;
                if (p.status === 'Paid') paidAmount += amt;
                else pendingAmount += amt;
            });

            // Update summary cards
            const elTotal = document.getElementById('payTotalBalance');
            const elPaid = document.getElementById('payPaidAmount');
            const elRemaining = document.getElementById('payRemainingBalance');
            if (elTotal) elTotal.textContent = `₱${totalAmount.toLocaleString()}`;
            if (elPaid) elPaid.textContent = `₱${paidAmount.toLocaleString()}`;
            if (elRemaining) elRemaining.textContent = `₱${pendingAmount.toLocaleString()}`;

            const today = new Date();
            tableBody.innerHTML = payments.map(p => {
                const dueDate = new Date(p.due_date);
                const isOverdue = p.status !== 'Paid' && dueDate < today;
                const statusClass = p.status === 'Paid' ? 'status-paid' : isOverdue ? 'status-overdue' : 'status-pending';
                const statusLabel = p.status === 'Paid' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending';
                return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:15px; font-weight:600;">${p.description}</td>
                    <td style="font-weight:700; color:var(--primary);">₱${parseFloat(p.amount).toLocaleString()}</td>
                    <td>${new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td><span class="payment-status ${statusClass}">${statusLabel}</span></td>
                </tr>`;
            }).join('');

            // Update smart label
            const smartPayLabel = document.getElementById('smart-pay-label');
            if (smartPayLabel) smartPayLabel.textContent = pendingAmount > 0 ? `₱${pendingAmount.toLocaleString()} Due` : 'No balance due';
        }
    }

    // ==========================================
    // FIX #3: DEADLINES — From proper table
    // ==========================================
    async function loadDeadlines(userId) {
        const container = document.getElementById('deadlinesContainer');
        const nextDeadlineText = document.getElementById('nextDeadlineText');

        // Try from deadlines table first, fallback gracefully
        const { data: deadlines, error } = await supabaseClient
            .from('deadlines')
            .select('*')
            .eq('student_id', userId)
            .order('due_date', { ascending: true });

        if (error) {
            console.warn("Deadlines table not found or error:", error.message);
            if (nextDeadlineText) nextDeadlineText.textContent = 'No deadlines';
            if (container) container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No deadlines table found. Create one in Supabase.</p>`;
            return;
        }

        // Update upcoming deadline in dashboard hero
        const upcoming = deadlines?.filter(d => d.status !== 'submitted')[0];
        if (nextDeadlineText) {
            nextDeadlineText.textContent = upcoming ? upcoming.title : 'No deadlines';
        }

        if (!container) return;

        if (deadlines && deadlines.length > 0) {
            const today = new Date();
            container.innerHTML = deadlines.map(d => {
                const dueDate = new Date(d.due_date);
                const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                const isLate = d.status !== 'submitted' && dueDate < today;
                const urgencyClass = isLate ? 'deadline-late' : diffDays <= 2 ? 'deadline-urgent' : '';
                const typeIcon = d.type === 'quiz' ? '📝' : d.type === 'exam' ? '📋' : '📌';

                return `
                <div class="deadline-item ${urgencyClass}" onclick="openDeadlineModal(${JSON.stringify(d).replace(/"/g, '&quot;')})">
                    <div class="deadline-icon">${typeIcon}</div>
                    <div class="deadline-info">
                        <div class="deadline-top">
                            <h4>${d.title}</h4>
                            <span class="deadline-type-badge">${(d.type || 'task').toUpperCase()}</span>
                        </div>
                        <p>${d.subject || ''}</p>
                        <div class="deadline-bottom">
                            <span class="deadline-due ${isLate ? 'late' : diffDays <= 2 ? 'soon' : ''}">
                                <span class="material-symbols-outlined" style="font-size:0.75rem;">schedule</span>
                                ${isLate ? 'OVERDUE' : diffDays === 0 ? 'Due today' : diffDays === 1 ? 'Due tomorrow' : `Due in ${diffDays} days`}
                            </span>
                            <span class="deadline-status-badge status-${(d.status || 'pending').toLowerCase()}">${d.status || 'Pending'}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No deadlines found! 🎉</p>`;
        }
    }

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

    document.getElementById('dlModalClose')?.addEventListener('click', () => {
        document.getElementById('deadlineModalOverlay')?.classList.remove('open');
    });
    document.getElementById('deadlineModalOverlay')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('deadlineModalOverlay'))
            document.getElementById('deadlineModalOverlay').classList.remove('open');
    });

    // ==========================================
    // ATTENDANCE SYSTEM
    // ==========================================
    async function loadAttendance(userId) {
        const container = document.getElementById('attendanceContainer');
        if (!container) return;

        const { data: records, error } = await supabaseClient
            .from('attendance').select('*').eq('student_id', userId);

        if (error) { console.warn("Attendance table missing:", error.message); return; }

        const total = records?.length || 0;
        const present = records?.filter(r => r.status === 'present').length || 0;
        const absences = records?.filter(r => r.status === 'absent').length || 0;
        const late = records?.filter(r => r.status === 'late').length || 0;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

        const attPct = document.getElementById('attendancePct');
        const attAbsences = document.getElementById('attendanceAbsences');
        const attLate = document.getElementById('attendanceLate');
        const attBar = document.getElementById('attendanceBar');

        if (attPct) attPct.textContent = `${percentage}%`;
        if (attAbsences) attAbsences.textContent = absences;
        if (attLate) attLate.textContent = late;
        if (attBar) {
            attBar.style.width = `${percentage}%`;
            attBar.style.background = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
        }
    }

    // ==========================================
    // COURSES DATA (existing, preserved)
    // ==========================================
    async function loadCoursesData(userId) {
        const container = document.getElementById('db-courses-container');
        const countDisplay = document.getElementById('courseCount');
        const { data: courses } = await supabaseClient.from('student_courses').select('*').eq('student_id', userId);

        if (courses) {
            if (countDisplay) countDisplay.textContent = courses.length;
            if (container) {
                const courseIcons = ['📘', '🧪', '📐', '💻', '📊', '🎨', '🌐', '📝'];
                container.innerHTML = courses.map((course, idx) => {
                    const progressValue = course.progress || 0;
                    const color = course.color_theme || '#0062ff';
                    const icon = courseIcons[idx % courseIcons.length];
                    const instructorName = course.instructor || 'Instructor TBA';
                    return `
                    <div class="course-card">
                        <div class="course-card-top-bar" style="background: ${color};"></div>
                        <div class="course-card-body">
                            <div class="course-card-header">
                                <div class="course-card-icon">${icon}</div>
                                <span class="course-card-code">${course.course_code}</span>
                            </div>
                            <h3>${course.course_name}</h3>
                            <p class="instructor-name">
                                <span class="material-symbols-outlined" style="font-size:0.85rem; vertical-align:middle;">person</span>
                                ${instructorName}
                            </p>
                            <div class="course-progress-label">
                                <span>Progress</span><span>${progressValue}%</span>
                            </div>
                            <div class="course-progress-bar">
                                <div class="course-progress-fill" style="width:${progressValue}%; background:${color};"></div>
                            </div>
                        </div>
                        <div class="course-card-footer">
                            <span class="course-units-label">${course.units ? course.units + ' units' : ''}</span>
                            <button class="msg-instructor-btn" onclick="openComposeToInstructor('${instructorName}', '${course.course_name}')">
                                <span class="material-symbols-outlined">send</span> Message
                            </button>
                        </div>
                    </div>`;
                }).join('');
            }
        }
    }

    // ==========================================
    // GRADES DATA (existing, preserved)
    // ==========================================
    async function loadGradesData(userId) {
        const tableBody = document.getElementById('gradesTableBody');
        const gwaDisplay = document.getElementById('gwaValue');
        if (!tableBody) return;
        const { data: grades } = await supabaseClient.from('student_grades').select('*').eq('student_id', userId);

        if (grades && tableBody) {
            let totalNum = 0, count = 0;
            tableBody.innerHTML = grades.map(g => {
                const midtermText = g.midterm !== null ? g.midterm + '%' : '--';
                const finalsText = g.finals !== null ? g.finals + '%' : '--';
                let displayGrade = "TBA", statusText = "In Progress", statusColor = "#0062ff", statusBg = "#e0ebff";

                if (g.status !== 'In Progress') {
                    const avg = ((g.midterm || 0) + (g.finals || 0)) / 2;
                    const numGrade = getPHNumericalGrade(avg);
                    displayGrade = numGrade.toFixed(2);
                    totalNum += numGrade; count++;
                    statusText = numGrade <= 3.0 ? 'Passed' : 'Failed';
                    statusColor = numGrade <= 3.0 ? '#047857' : '#ef4444';
                    statusBg = numGrade <= 3.0 ? '#d1fae5' : '#fee2e2';
                }

                return `
                <tr>
                    <td style="padding:15px; font-weight:600;">${g.course_name}</td>
                    <td>${midtermText}</td>
                    <td>${finalsText}</td>
                    <td style="font-weight:800; color:var(--primary);">${displayGrade}</td>
                    <td><span style="background:${statusBg}; color:${statusColor}; padding:5px 12px; border-radius:20px; font-size:0.75rem; font-weight:800;">${statusText.toUpperCase()}</span></td>
                </tr>`;
            }).join('');

            if (count > 0 && gwaDisplay) {
                const computedGwa = (totalNum / count).toFixed(2);
                gwaDisplay.textContent = computedGwa;
                // Also update the target GWA comparison
                updateGwaComparison(parseFloat(computedGwa));
            }
        }
    }

    function updateGwaComparison(currentGwa) {
        const targetEl = document.getElementById('targetGwaDisplay');
        const targetVal = parseFloat(targetEl?.textContent);
        const comparisonEl = document.getElementById('gwaComparison');
        if (!comparisonEl || isNaN(targetVal)) return;

        if (currentGwa <= targetVal) {
            comparisonEl.textContent = `✓ On track! (${(targetVal - currentGwa).toFixed(2)} below target)`;
            comparisonEl.style.color = 'var(--accent-green)';
        } else {
            comparisonEl.textContent = `↑ Need ${(currentGwa - targetVal).toFixed(2)} more improvement`;
            comparisonEl.style.color = 'var(--accent-amber)';
        }
    }

    function getPHNumericalGrade(percentage) {
        if (percentage >= 97) return 1.00; if (percentage >= 94) return 1.25; if (percentage >= 91) return 1.50;
        if (percentage >= 88) return 1.75; if (percentage >= 85) return 2.00; if (percentage >= 82) return 2.25;
        if (percentage >= 79) return 2.50; if (percentage >= 76) return 2.75; if (percentage >= 75) return 3.00;
        return 5.00;
    }

    // ==========================================
    // DARK MODE & THEME TOGGLE
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

    async function loadNotices() {
        const container = document.getElementById('db-notices-container');
        if (!container) return;
        const { data: notices, error } = await supabaseClient.from('portal_notices').select('*');
        if (error) { container.innerHTML = `<p style="color:red;font-size:0.8rem;">Failed to load notices.</p>`; return; }
        if (notices && notices.length > 0) {
            container.innerHTML = notices.map(n => `
                <div class="notice-item">
                    <h4>${n.title}</h4>
                    <p>${n.message}</p>
                </div>`).join('');
        } else {
            container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px;">No new announcements today. ✨</p>`;
        }
    }

    // ==========================================
    // FIX #3: SMART DASHBOARD — Deadlines from proper source
    // ==========================================
    async function loadSmartDashboardData(userId) {
        try {
            const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
            const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

            const { data: classes } = await supabaseClient
                .from('student_schedule').select('*')
                .eq('student_id', userId).eq('day_of_week', today)
                .gt('start_time', nowTime).order('start_time', { ascending: true }).limit(1);

            const nextClassText = document.getElementById('nextClassText');
            const nextClassRoom = document.getElementById('nextClassRoom');
            const smartScheduleLabel = document.getElementById('smart-schedule-label');

            if (classes && classes.length > 0) {
                if (nextClassText) nextClassText.textContent = classes[0].course_name;
                if (nextClassRoom) nextClassRoom.textContent = `${classes[0].start_time.substring(0, 5)} • Room ${classes[0].room}`;
                if (smartScheduleLabel) smartScheduleLabel.textContent = `Next at ${classes[0].start_time.substring(0, 5)}`;
            } else {
                if (nextClassText) nextClassText.textContent = 'No more classes';
                if (nextClassRoom) nextClassRoom.textContent = 'Enjoy your day!';
                if (smartScheduleLabel) smartScheduleLabel.textContent = 'No upcoming classes';
            }

            // Unread count (uses updateUnreadCount now)
            await updateUnreadCount(userId);

            const { data: payments } = await supabaseClient.from('student_payments').select('amount').eq('student_id', userId).neq('status', 'Paid');
            const smartPayLabel = document.getElementById('smart-pay-label');
            if (payments && smartPayLabel) {
                const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                smartPayLabel.textContent = total > 0 ? `₱${total.toLocaleString()} Due` : "No balance due";
            }

            // FIX: Deadlines now from proper deadlines table, not student_schedule
            const { data: deadlines } = await supabaseClient
                .from('deadlines').select('title, due_date, status')
                .eq('student_id', userId)
                .neq('status', 'submitted')
                .order('due_date', { ascending: true }).limit(1);

            const nextDeadlineText = document.getElementById('nextDeadlineText');
            if (deadlines && deadlines.length > 0) {
                if (nextDeadlineText) nextDeadlineText.textContent = deadlines[0].title;
            } else {
                if (nextDeadlineText) nextDeadlineText.textContent = 'No deadlines';
            }

        } catch (err) {
            console.error("Smart Dashboard Error:", err.message);
        }
    }

    // ==========================================
    // PERFORMANCE CHART (preserved + improved)
    // ==========================================
    let myChart = null;

    async function loadPerformanceChart(userId, filterType = 'grades') {
        const ctx = document.getElementById('performanceChart');
        if (!ctx) return;
        if (myChart) { myChart.destroy(); myChart = null; }

        const isDark = document.body.classList.contains('dark-mode');
        const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        const tickColor = isDark ? '#94a3b8' : '#94a3b8';
        const pointBg = isDark ? '#ffffff' : '#ffffff';
        const pointBorder = '#0062ff';

        if (filterType === 'grades') {
            const { data: grades } = await supabaseClient.from('student_grades').select('course_name, midterm, finals').eq('student_id', userId);
            if (!grades || grades.length === 0) return;
            const labels = grades.map(g => g.course_name.substring(0, 10) + '...');
            const dataPoints = grades.map(g => getPHNumericalGrade(((g.midterm || 0) + (g.finals || 0)) / 2));

            myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Grade', data: dataPoints,
                        borderColor: '#0062ff',
                        backgroundColor: isDark ? 'rgba(0,98,255,0.08)' : 'rgba(0,98,255,0.1)',
                        fill: true, tension: 0.4,
                        pointBackgroundColor: pointBg,
                        pointBorderColor: pointBorder,
                        pointBorderWidth: 3, pointRadius: 7, pointHoverRadius: 9,
                        pointHoverBackgroundColor: '#0062ff', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 3,
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { reverse: true, min: 1.0, max: 5.0, grid: { color: gridColor }, ticks: { color: tickColor } },
                        x: { grid: { display: false }, ticks: { color: tickColor } }
                    }
                }
            });
        } else if (filterType === 'progress') {
            const { data: courses } = await supabaseClient.from('student_courses').select('course_name, progress').eq('student_id', userId);
            if (!courses || courses.length === 0) return;
            const labels = courses.map(c => c.course_name.substring(0, 10) + '...');
            const dataPoints = courses.map(c => c.progress || 0);

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Progress %', data: dataPoints,
                        backgroundColor: isDark ? 'rgba(0,98,255,0.85)' : 'rgba(0,98,255,0.8)',
                        borderRadius: 8, borderSkipped: false
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor } },
                        x: { grid: { display: false }, ticks: { color: tickColor } }
                    }
                }
            });
        }
    }

    const chartFilter = document.getElementById('chartFilter');
    if (chartFilter) {
        chartFilter.addEventListener('change', (e) => {
            loadPerformanceChart(user.id, e.target.value);
        });
    }

    // ==========================================
    // COMPOSE MODAL (preserved + fixed)
    // ==========================================
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
        await initProfile();
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

    // MAKE ALL [data-target] ELEMENTS CLICKABLE
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
}); // End of DOMContentLoaded