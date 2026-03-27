// ============================================================
// ui.js — All DOM rendering, modal control, and display logic
// ============================================================

// ─────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────

export function showToast(message, type = 'info') {
    const existing = document.getElementById('toast-notif');
    if (existing) existing.remove();

    const colors = { success: '#10b981', error: '#ef4444', info: '#0062ff', warning: '#f59e0b' };
    const toast = document.createElement('div');
    toast.id = 'toast-notif';
    toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:${colors[type]};color:white;padding:14px 22px;border-radius:14px;font-weight:700;font-size:0.88rem;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.2);animation:slideInRight 0.3s ease;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ─────────────────────────────────────────
// AVATAR
// ─────────────────────────────────────────

export function updateAllAvatars(url) {
    const finalUrl = url.includes('supabase')
        ? url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
        : url;
    const fallback = 'https://ui-avatars.com/api/?name=Student&background=0062ff&color=fff';
    const navAv = document.getElementById('navAvatar');
    const setAv = document.getElementById('settingsAvatar');
    if (navAv) { navAv.src = finalUrl; navAv.onerror = () => { navAv.src = fallback; }; }
    if (setAv) { setAv.src = finalUrl; setAv.onerror = () => { setAv.src = fallback; }; }
}

// ─────────────────────────────────────────
// PROFILE FIELDS
// ─────────────────────────────────────────

export function renderProfile({ fullName, email, bio, avatarUrl, targetGwa }) {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const setVal  = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

    setText('topbarName', fullName);
    setText('welcomeMessage', `Welcome back, ${fullName.split(' ')[0]}!`);
    setVal('settingName', fullName);
    setVal('settingEmail', email);
    setVal('settingBio', bio);

    if (targetGwa) {
        setVal('targetGwaInput', targetGwa);
        setText('targetGwaDisplay', parseFloat(targetGwa).toFixed(2));
    }

    updateAllAvatars(avatarUrl);
}

export function updateProfileNameInUI(name) {
    const topbarName = document.getElementById('topbarName');
    const welcomeMsg = document.getElementById('welcomeMessage');
    if (topbarName) topbarName.textContent = name;
    if (welcomeMsg) welcomeMsg.textContent = `Welcome back, ${name.split(' ')[0]}!`;
}

// ─────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────

export function applyPermissions(role) {
    const cleanRole = (role || '').trim().toLowerCase();
    const isAdmin = cleanRole === 'admin' || cleanRole === 'teacher';
    const addBtn = document.getElementById('addResourceBtn');
    const composeMsgBtn = document.getElementById('composeMsgBtn');
    if (addBtn) addBtn.style.display = isAdmin ? 'block' : 'none';
    if (composeMsgBtn) composeMsgBtn.style.display = isAdmin ? 'block' : 'none';
}

// ─────────────────────────────────────────
// VIEW SWITCHER
// ─────────────────────────────────────────

export function switchView(targetId) {
    if (!targetId) return;
    document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');
    const sidebarItem = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
    if (sidebarItem) sidebarItem.classList.add('active');
}

// ─────────────────────────────────────────
// SCHEDULE
// ─────────────────────────────────────────

export function renderTodaysSchedule(schedule) {
    const container = document.getElementById('todaysScheduleList');
    if (!container) return;
    if (schedule.length > 0) {
        container.innerHTML = schedule.map(item => buildScheduleCard(item)).join('');
    } else {
        container.innerHTML = `<p style="color:var(--text-muted); padding:10px;">No classes today! 🥳</p>`;
    }
}

export function renderWeeklySchedule(schedule) {
    const grid = document.getElementById('weeklyScheduleGrid');
    if (!grid) return;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    grid.innerHTML = days.map(day => {
        const dayClasses = schedule.filter(item => item.day_of_week === day);
        if (dayClasses.length === 0) return '';
        return `
        <div class="schedule-day-block">
            <span class="schedule-day-label">${day}</span>
            <div class="schedule-items-grid">
                ${dayClasses.map(item => buildScheduleCard(item)).join('')}
            </div>
        </div>`;
    }).join('');
}

function buildScheduleCard(item) {
    const endTime = item.end_time ? item.end_time.substring(0, 5) : '';
    return `
    <div class="schedule-item-card ${item.is_urgent ? 'is-urgent' : ''}">
        <div class="schedule-time-badge">
            <span class="time-start">${item.start_time.substring(0, 5)}</span>
            ${endTime ? `<span class="time-sep">to</span><span class="time-end">${endTime}</span>` : ''}
        </div>
        <div class="schedule-item-info">
            <h4>${item.course_name}</h4>
            <p>${item.instructor || 'TBA'}</p>
            <span class="room-badge">
                <span class="material-symbols-outlined" style="font-size:0.75rem;">location_on</span>
                ${item.room}
            </span>
        </div>
    </div>`;
}

// ─────────────────────────────────────────
// SMART DASHBOARD LABELS
// ─────────────────────────────────────────

export function renderNextClass(cls) {
    const nextClassText = document.getElementById('nextClassText');
    const nextClassRoom = document.getElementById('nextClassRoom');
    const smartScheduleLabel = document.getElementById('smart-schedule-label');
    if (cls) {
        if (nextClassText) nextClassText.textContent = cls.course_name;
        if (nextClassRoom) nextClassRoom.textContent = `${cls.start_time.substring(0, 5)} • Room ${cls.room}`;
        if (smartScheduleLabel) smartScheduleLabel.textContent = `Next at ${cls.start_time.substring(0, 5)}`;
    } else {
        if (nextClassText) nextClassText.textContent = 'No more classes';
        if (nextClassRoom) nextClassRoom.textContent = 'Enjoy your day!';
        if (smartScheduleLabel) smartScheduleLabel.textContent = 'No upcoming classes';
    }
}

export function renderUnreadCount(count) {
    const msgDot = document.getElementById('msg-count-dot');
    const smartMsgLabel = document.getElementById('smart-msg-label');
    const notifBadge = document.getElementById('notifBadge');

    if (count > 0) {
        if (msgDot) { msgDot.style.display = 'block'; msgDot.textContent = count > 9 ? '9+' : count; }
        if (smartMsgLabel) { smartMsgLabel.textContent = `${count} unread`; smartMsgLabel.style.color = 'var(--primary)'; }
        if (notifBadge) { notifBadge.style.display = 'flex'; notifBadge.textContent = count; }
    } else {
        if (msgDot) msgDot.style.display = 'none';
        if (smartMsgLabel) { smartMsgLabel.textContent = 'No unread'; smartMsgLabel.style.color = ''; }
        if (notifBadge) notifBadge.style.display = 'none';
    }
}

export function renderPaymentLabel(unpaidRows) {
    const total = unpaidRows.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const smartPayLabel = document.getElementById('smart-pay-label');
    if (smartPayLabel) smartPayLabel.textContent = total > 0 ? `₱${total.toLocaleString()} Due` : 'No balance due';
}

export function renderNextDeadline(deadline) {
    const el = document.getElementById('nextDeadlineText');
    if (el) el.textContent = deadline ? deadline.title : 'No deadlines';
}

// ─────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────

export function renderMessages(messages) {
    const list = document.getElementById('messageInboxList');
    if (!list) return;
    if (messages.length === 0) {
        list.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:40px;">Inbox empty.</p>`;
        return;
    }
    list.innerHTML = messages.map(msg => {
        const isUnread = !msg.is_read;
        const timeAgo = getTimeAgo(msg.created_at);
        const isAnnouncement = msg._type === 'announcement';
        return `
        <div class="message-item ${isUnread ? 'unread' : ''} ${isAnnouncement ? 'announcement' : ''}"
             data-msg-id="${msg.id}"
             onclick="window.__openMessageModal('${msg.id}', '${escapeAttr(msg.subject)}', '${escapeAttr(msg.content)}', '${escapeAttr(msg.sender_name)}', '${timeAgo}', ${isUnread})">
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
}

export function markMessageReadInDOM(msgId) {
    const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!msgEl) return;
    msgEl.classList.remove('unread');
    msgEl.querySelector('.unread-badge')?.remove();
    msgEl.querySelector('.message-icon')?.classList.remove('unread-icon');
}

export function openMessageModal({ subject, content, senderName, timeAgo }) {
    const overlay = document.getElementById('messageModalOverlay');
    if (!overlay) return;
    document.getElementById('msgModalSubject').textContent = subject;
    document.getElementById('msgModalContent').textContent = content;
    document.getElementById('msgModalSender').textContent = `From: ${senderName}`;
    document.getElementById('msgModalTime').textContent = timeAgo;
    overlay.classList.add('open');
}

export function closeMessageModal() {
    document.getElementById('messageModalOverlay')?.classList.remove('open');
}

// ─────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────

export function renderPayments(payments) {
    const tableBody = document.getElementById('paymentsTableBody');
    if (!tableBody) return;

    let totalAmount = 0, paidAmount = 0, pendingAmount = 0;
    payments.forEach(p => {
        const amt = parseFloat(p.amount);
        totalAmount += amt;
        if (p.status === 'Paid') paidAmount += amt;
        else pendingAmount += amt;
    });

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('payTotalBalance', `₱${totalAmount.toLocaleString()}`);
    set('payPaidAmount', `₱${paidAmount.toLocaleString()}`);
    set('payRemainingBalance', `₱${pendingAmount.toLocaleString()}`);

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
}

// ─────────────────────────────────────────
// DEADLINES
// ─────────────────────────────────────────

export function renderDeadlines(deadlines) {
    const container = document.getElementById('deadlinesContainer');
    if (!container) return;

    if (deadlines.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No deadlines found! 🎉</p>`;
        return;
    }

    const today = new Date();
    container.innerHTML = deadlines.map(d => {
        const dueDate = new Date(d.due_date);
        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        const isLate = d.status !== 'submitted' && dueDate < today;
        const urgencyClass = isLate ? 'deadline-late' : diffDays <= 2 ? 'deadline-urgent' : '';
        const typeIcon = d.type === 'quiz' ? '📝' : d.type === 'exam' ? '📋' : '📌';
        return `
        <div class="deadline-item ${urgencyClass}" onclick="window.__openDeadlineModal(${JSON.stringify(d).replace(/"/g, '&quot;')})">
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
}

export function openDeadlineModal(d) {
    const overlay = document.getElementById('deadlineModalOverlay');
    if (!overlay) return;
    const dueDate = new Date(d.due_date);
    const isLate = d.status !== 'submitted' && dueDate < new Date();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dlModalTitle', d.title || '—');
    set('dlModalSubject', d.subject || '—');
    set('dlModalType', (d.type || 'Task').toUpperCase());
    set('dlModalDue', dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    set('dlModalScore', d.score !== null && d.score !== undefined ? d.score : 'Not yet graded');
    set('dlModalNotes', d.notes || 'No additional notes.');

    const statusEl = document.getElementById('dlModalStatus');
    if (statusEl) {
        const finalStatus = isLate && d.status !== 'submitted' ? 'Late' : d.status || 'Pending';
        statusEl.textContent = finalStatus;
        statusEl.className = `dl-status-value status-${finalStatus.toLowerCase()}`;
    }
    overlay.classList.add('open');
}

export function closeDeadlineModal() {
    document.getElementById('deadlineModalOverlay')?.classList.remove('open');
}

// ─────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────

export function renderCourses(courses) {
    const container = document.getElementById('db-courses-container');
    const countDisplay = document.getElementById('courseCount');
    if (countDisplay) countDisplay.textContent = courses.length;
    if (!container) return;

    if (courses.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">No courses found.</p>`;
        return;
    }

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
                <button class="msg-instructor-btn" onclick="window.__openComposeToInstructor('${instructorName}', '${course.course_name}')">
                    <span class="material-symbols-outlined">send</span> Message
                </button>
            </div>
        </div>`;
    }).join('');
}

// ─────────────────────────────────────────
// GRADES
// ─────────────────────────────────────────

export function renderGrades(grades) {
    const tableBody = document.getElementById('gradesTableBody');
    const gwaDisplay = document.getElementById('gwaValue');
    if (!tableBody) return null;

    let totalNum = 0, count = 0;
    tableBody.innerHTML = grades.map(g => {
        const midtermText = g.midterm !== null ? g.midterm + '%' : '--';
        const finalsText = g.finals !== null ? g.finals + '%' : '--';
        let displayGrade = 'TBA', statusText = 'In Progress', statusColor = '#0062ff', statusBg = '#e0ebff';

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

    const computedGwa = count > 0 ? totalNum / count : null;
    if (computedGwa !== null && gwaDisplay) {
        gwaDisplay.textContent = computedGwa.toFixed(2);
    }
    return computedGwa;
}

export function renderGwaComparison(currentGwa) {
    const targetEl = document.getElementById('targetGwaDisplay');
    const comparisonEl = document.getElementById('gwaComparison');
    if (!comparisonEl || !targetEl) return;
    const targetVal = parseFloat(targetEl.textContent);
    if (isNaN(targetVal) || isNaN(currentGwa)) return;

    if (currentGwa <= targetVal) {
        comparisonEl.textContent = `✓ On track! (${(targetVal - currentGwa).toFixed(2)} below target)`;
        comparisonEl.style.color = 'var(--accent-green)';
    } else {
        comparisonEl.textContent = `↑ Need ${(currentGwa - targetVal).toFixed(2)} more improvement`;
        comparisonEl.style.color = 'var(--accent-amber)';
    }
}

// ─────────────────────────────────────────
// RESOURCES
// ─────────────────────────────────────────

export function renderResources(files) {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;
    if (files.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); grid-column: 1/-1; text-align:center; padding: 40px;">No resources uploaded yet.</p>`;
        return;
    }
    const iconMap = { pdf: '📕', docx: '📘', doc: '📘', pptx: '📙', ppt: '📙', xlsx: '📗', xls: '📗' };
    grid.innerHTML = files.map(file => {
        const ext = (file.file_type || 'other').toLowerCase();
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
}

// ─────────────────────────────────────────
// NOTICES
// ─────────────────────────────────────────

export function renderNotices(notices) {
    const container = document.getElementById('db-notices-container');
    if (!container) return;
    if (notices.length > 0) {
        container.innerHTML = notices.map(n => `
            <div class="notice-item">
                <h4>${n.title}</h4>
                <p>${n.message}</p>
            </div>`).join('');
    } else {
        container.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:20px;">No new announcements today. ✨</p>`;
    }
}

// ─────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────

export function renderAttendance(records) {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absences = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('attendancePct', `${percentage}%`);
    set('attendanceAbsences', absences);
    set('attendanceLate', late);

    const bar = document.getElementById('attendanceBar');
    if (bar) {
        bar.style.width = `${percentage}%`;
        bar.style.background = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#f59e0b' : '#ef4444';
    }
}

// ─────────────────────────────────────────
// COMPOSE MODAL
// ─────────────────────────────────────────

export function openCompose({ toDisplay = 'New Message', recipientId = '', subject = '' } = {}) {
    const overlay = document.getElementById('composeModalOverlay');
    if (overlay) overlay.classList.add('open');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('composeToDisplay', toDisplay);
    set('composeRecipientId', recipientId);
    set('composeSubject', subject);
    set('composeContent', '');
    setTimeout(() => document.getElementById('composeContent')?.focus(), 100);
}

export function closeCompose() {
    document.getElementById('composeModalOverlay')?.classList.remove('open');
}

export function getComposeValues() {
    return {
        recipientId: document.getElementById('composeRecipientId')?.value?.trim() || '',
        subject: document.getElementById('composeSubject')?.value?.trim() || '',
        content: document.getElementById('composeContent')?.value?.trim() || ''
    };
}

export function setComposeSending(isSending) {
    const btn = document.getElementById('composeSendBtn');
    if (!btn) return;
    btn.disabled = isSending;
    btn.innerHTML = isSending
        ? 'Sending...'
        : '<span class="material-symbols-outlined">send</span> Send';
}

// ─────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────

export function applyStoredTheme() {
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
}

export function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    return isDark;
}

// ─────────────────────────────────────────
// CHART
// ─────────────────────────────────────────

export function buildGradeChart(ctx, grades, isDark) {
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = '#94a3b8';
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: grades.map(g => g.course_name.substring(0, 10) + '...'),
            datasets: [{
                label: 'Grade',
                data: grades.map(g => getPHNumericalGrade(((g.midterm || 0) + (g.finals || 0)) / 2)),
                borderColor: '#0062ff',
                backgroundColor: isDark ? 'rgba(0,98,255,0.08)' : 'rgba(0,98,255,0.1)',
                fill: true, tension: 0.4,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#0062ff',
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
}

export function buildProgressChart(ctx, courses, isDark) {
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const tickColor = '#94a3b8';
    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: courses.map(c => c.course_name.substring(0, 10) + '...'),
            datasets: [{
                label: 'Progress %',
                data: courses.map(c => c.progress || 0),
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

// ─────────────────────────────────────────
// HELPERS (shared, used internally)
// ─────────────────────────────────────────

export function getPHNumericalGrade(percentage) {
    if (percentage >= 97) return 1.00; if (percentage >= 94) return 1.25; if (percentage >= 91) return 1.50;
    if (percentage >= 88) return 1.75; if (percentage >= 85) return 2.00; if (percentage >= 82) return 2.25;
    if (percentage >= 79) return 2.50; if (percentage >= 76) return 2.75; if (percentage >= 75) return 3.00;
    return 5.00;
}

export function getTimeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export function escapeAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
}