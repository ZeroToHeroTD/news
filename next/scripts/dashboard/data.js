import { supabaseClient } from '../new/config.js';
import { escapeAttr, getTimeAgo, getPHNumericalGrade, updateGwaComparison } from '../new/utils.js';
import { updateAllAvatars, checkUserPermissions } from '../new/ui.js';

export async function initProfile(user) {
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) console.error("Profile Fetch Error:", error.message);

    const fullName = profile?.full_name || user.user_metadata?.full_name || 'Student';
    const email = profile?.email || user.email;
    const bio = profile?.bio || user.user_metadata?.bio || 'Passionate learner!';

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
    if (document.getElementById('settingUserId')) document.getElementById('settingUserId').value = user.id;

    // Load GWA displays across both tabs
    const targetGwaInput = document.getElementById('targetGwaInput');
    const targetGwaDisplay = document.getElementById('targetGwaDisplay');
    const targetGwaSettingDisplay = document.getElementById('targetGwaSettingDisplay'); // Grab the new element

    if (profile?.target_gwa) {
        const formattedGwa = parseFloat(profile.target_gwa).toFixed(2);
        if (targetGwaInput) targetGwaInput.value = formattedGwa;
        if (targetGwaDisplay) targetGwaDisplay.textContent = formattedGwa;
        if (targetGwaSettingDisplay) targetGwaSettingDisplay.textContent = formattedGwa; // Update the settings text
    }
    updateAllAvatars(avatarUrl);
    checkUserPermissions(profile?.role);

    // Add these lines to initProfile
const settingCourse = document.getElementById('settingCourse');
const settingSection = document.getElementById('settingSection');

if (settingCourse) settingCourse.value = profile?.course_name || 'Unassigned';
if (settingSection) settingSection.value = profile?.section || 'Unassigned';
}

export async function loadResources() {
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

export async function loadTodaysSchedule(userId) {
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

export async function loadWeeklySchedule(userId) {
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

export async function loadMessages(userId) {
    const list = document.getElementById('messageInboxList');
    if (!list) return;

    const { data: personal } = await supabaseClient.from('portal_messages').select('*').eq('recipient_id', userId).order('created_at', { ascending: false });
    const { data: announcements } = await supabaseClient.from('portal_messages').select('*').is('recipient_id', null).order('created_at', { ascending: false });

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

    updateUnreadCount(userId);
}

export async function updateUnreadCount(userId) {
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

export async function loadPaymentData(userId) {
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

        const smartPayLabel = document.getElementById('smart-pay-label');
        if (smartPayLabel) smartPayLabel.textContent = pendingAmount > 0 ? `₱${pendingAmount.toLocaleString()} Due` : 'No balance due';
    }
}

export async function loadDeadlines(userId) {
    const container = document.getElementById('deadlinesContainer');
    const nextDeadlineText = document.getElementById('nextDeadlineText');
    const missingContainer = document.getElementById('missingOutputsContainer'); // Grab the dashboard box

    const { data: deadlines, error } = await supabaseClient
        .from('deadlines').select('*')
        .eq('student_id', userId).order('due_date', { ascending: true });

    if (error) {
        console.warn("Deadlines table not found or error:", error.message);
        if (nextDeadlineText) nextDeadlineText.textContent = 'No deadlines';
        if (container) container.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:20px;">No deadlines table found. Create one in Supabase.</p>`;
        if (missingContainer) missingContainer.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;">Database error.</p>`;
        return;
    }

    // 1. Update Hero Card
    const pendingDeadlines = deadlines?.filter(d => d.status !== 'submitted') || [];
    if (nextDeadlineText) {
        nextDeadlineText.textContent = pendingDeadlines.length > 0 ? pendingDeadlines[0].title : 'No deadlines';
    }

    // 2. Update the Dashboard "Missing / Pending Outputs" Widget
    if (missingContainer) {
        if (pendingDeadlines.length > 0) {
            // Show only the next 3 pending outputs
            missingContainer.innerHTML = pendingDeadlines.slice(0, 3).map(d => {
                const dueDate = new Date(d.due_date);
                const isLate = dueDate < new Date();
                const dotColor = isLate ? 'var(--accent-red)' : 'var(--accent-amber)';
                const dateString = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return `
                <div class="missing-output-item" style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 0.85rem; color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.title}</div>
                        <div style="font-size: 0.72rem; color: var(--text-muted);">${d.subject || 'Task'} • Due ${dateString}</div>
                    </div>
                </div>`;
            }).join('');
        } else {
            missingContainer.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:10px 0;">You're all caught up! 🎉</p>`;
        }
    }

    // 3. Update the Main Deadlines Page
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

export async function loadAttendance(userId) {
    // Target the specific elements we actually want to update
    const attPct = document.getElementById('attendancePct');
    const attAbsences = document.getElementById('attendanceAbsences');
    const attLate = document.getElementById('attendanceLate');
    const attBar = document.getElementById('attendanceBar');

    // If we aren't on the dashboard/can't find the percentage display, stop here
    if (!attPct) return; 

    // Fetch the data from Supabase
    const { data: records, error } = await supabaseClient
        .from('attendance')
        .select('*')
        .eq('student_id', userId);

    if (error) { 
        console.warn("Attendance fetch error:", error.message); 
        return; 
    }

    // Calculate the stats
    const total = records?.length || 0;
    const absences = records?.filter(r => r.status === 'absent').length || 0;
    const late = records?.filter(r => r.status === 'late').length || 0;
    
    // Attendance percentage (Total minus absences, divided by total)
    const percentage = total > 0 ? Math.round(((total - absences) / total) * 100) : 100;

    // Update the UI
    if (attPct) attPct.textContent = `${percentage}%`;
    if (attAbsences) attAbsences.textContent = absences;
    if (attLate) attLate.textContent = late;
    if (attBar) {
        attBar.style.width = `${percentage}%`;
        // Green if 80%+, Orange if 60%+, Red if below 60%
        attBar.style.background = percentage >= 80 ? 'var(--accent-green)' : percentage >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)';
    }
}

export async function loadCoursesData(userId) {
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

export async function loadGradesData(userId) {
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
            updateGwaComparison(parseFloat(computedGwa));
        }
    }
}

export async function loadNotices() {
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

export async function loadSmartDashboardData(userId) {
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

        await updateUnreadCount(userId);

        const { data: payments } = await supabaseClient.from('student_payments').select('amount').eq('student_id', userId).neq('status', 'Paid');
        const smartPayLabel = document.getElementById('smart-pay-label');
        if (payments && smartPayLabel) {
            const total = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            smartPayLabel.textContent = total > 0 ? `₱${total.toLocaleString()} Due` : "No balance due";
        }

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

export let myChart = null;
export async function loadPerformanceChart(userId, filterType = 'grades') {
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


// ==========================================
// 1. LOADS THE DIRECTORY HTML
// ==========================================
export async function loadSocialDirectory(currentUserId) {
    const container = document.getElementById('socialDirectoryContainer');
    if (!container) return;

    const { data: profiles, error } = await supabaseClient.from('profiles').select('*');
    if (error) { 
        container.innerHTML = `<p style="color:var(--accent-red);">Error: ${error.message}</p>`; 
        return; 
    }

    const sections = {};
    profiles.forEach(p => {
        const sec = (p.section || 'Unassigned').toUpperCase().trim();
        if (!sections[sec]) sections[sec] = { instructors: [], students: [], total: 0 };
        if (p.role === 'teacher' || p.role === 'admin') sections[sec].instructors.push(p);
        else sections[sec].students.push(p);
        sections[sec].total++;
    });

    let html = '';
    let animDelay = 0;

    for (const [secName, group] of Object.entries(sections).sort()) {
        html += `
        <div class="social-section-block">
            <h3 data-count="${group.total}">
                <span class="material-symbols-outlined">school</span> ${secName}
            </h3>`;
        
        if (group.instructors.length > 0) {
            html += `<h4>Instructors</h4>
                     <div class="social-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">`;
            html += group.instructors.map(p => { animDelay += 0.05; return createSocialCard(p, currentUserId, animDelay); }).join('');
            html += `</div>`;
        }

        if (group.students.length > 0) {
            html += `<h4>Classmates</h4>
                     <div class="social-grid-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">`;
            html += group.students.map(p => { animDelay += 0.05; return createSocialCard(p, currentUserId, animDelay); }).join('');
            html += `</div>`;
        }
        html += `</div>`;
    }

    container.innerHTML = html || '<p style="color:var(--text-muted);">No users found.</p>';

    // --- INTEGRATED SEARCH LOGIC ---
    const socialSearch = document.getElementById('socialSearchInput');
    if (socialSearch) {
        socialSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.social-card-minimal');
            
            cards.forEach(card => {
                const name = card.querySelector('.member-name')?.textContent.toLowerCase() || "";
                const id = card.getAttribute('data-uid')?.toLowerCase() || ""; // Assuming you add data-uid to the card
                
                // If match found, show card, otherwise hide
                if (name.includes(term) || id.includes(term)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });

            // Clean up: Hide Section Headers (like "Block A") if all their cards are hidden
            document.querySelectorAll('.social-section-block').forEach(block => {
                const visibleCards = block.querySelectorAll('.social-card-minimal:not([style*="display: none"])');
                block.style.display = visibleCards.length > 0 ? 'block' : 'none';
            });
        });
    }
}
function createSocialCard(profile, currentUserId, delay) {
    const isMe = profile.id === currentUserId;
    const isInstructor = profile.role === 'teacher' || profile.role === 'admin';
    const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'User')}&background=0062ff&color=fff`;
    
    const roleClass = isInstructor ? 'role-instructor' : 'role-student';
    const roleLabel = isInstructor ? 'Instructor' : 'Student';

// ... inside your createSocialCard function ...
    return `
    <div class="social-card-minimal" data-uid="${profile.id}" style="animation: slideInRight 0.5s ease forwards; animation-delay: ${delay}s;">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div class="social-avatar-wrapper">
                <img src="${avatar}" alt="${profile.full_name}" />
            </div>
            <div class="member-info-column">
                <span class="social-role-badge ${roleClass}">${roleLabel}</span>
                <div class="member-name">
                    ${profile.full_name || 'User'} 
                    ${isMe ? '<span style="color:var(--primary); font-size:10px; margin-left:4px; opacity:0.8;">(YOU)</span>' : ''}
                </div>
                <div class="status-container">
                    <div id="status-dot-${profile.id}" class="status-dot ${isMe ? 'online' : 'offline'}" data-uid="${profile.id}"></div>
                    <span id="status-text-${profile.id}" class="online-status-text ${isMe ? 'active' : 'offline'}" data-uid="${profile.id}">
                        ${isMe ? 'Active Now' : 'Offline'}
                    </span>
                </div>
            </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 16px;">
            <button class="msg-btn-minimal" onclick="copyUserId('${profile.id}', this)" style="flex: 1;">
                <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span> Copy ID
            </button>
            ${!isMe ? `
            <button class="msg-btn-minimal msg-btn-primary" style="flex: 1.2;" onclick="openComposeToInstructor('${escapeAttr(profile.full_name)}', '${profile.id}')">
                <span class="material-symbols-outlined" style="font-size:18px;">chat_bubble</span> Message
            </button>
            ` : `
            <div style="flex: 1.2; visibility: hidden;"></div>
            `}
        </div>
    </div>
    `;
}
// ==========================================
// 3. THE REAL-TIME WEBSOCKET (Adds Pulse effect)
// ==========================================
export function initializePresence(currentUserId) {
    const socialRoom = supabaseClient.channel('campus_directory_room');

   socialRoom
  .on('presence', { event: 'sync' }, () => {
      const newState = socialRoom.presenceState();
      const topbarDot = document.getElementById('myCurrentStatusDot');

      // 1. Reset all dots to Offline first
      document.querySelectorAll('.status-dot').forEach(dot => {
          dot.classList.remove('online');
          dot.classList.add('offline');
      });
      document.querySelectorAll('.online-status-text').forEach(text => {
          text.textContent = 'Offline';
          text.classList.remove('active');
      });

      // 2. Apply "Active Now"
      for (const key in newState) {
          newState[key].forEach(user => {
              const dot = document.getElementById(`status-dot-${user.user_id}`);
              const text = document.getElementById(`status-text-${user.user_id}`);
              
              if (dot) {
                  dot.classList.remove('offline');
                  dot.classList.add('online'); // This triggers the Pulse/Green color
              }
              if (text) {
                  text.textContent = 'Active Now';
                  text.classList.add('active');
              }
              
              // Handle your Topbar Dot
              if (user.user_id === currentUserId && topbarDot) {
                  topbarDot.classList.add('online');
              }
          });
      }
  })
      .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
              await socialRoom.track({
                  user_id: currentUserId,
                  status: 'online',
                  online_at: new Date().toISOString(),
              });
          }
      });
}

// --- Expose functions to the HTML window ---

window.copyUserId = async function(id, btnElement) {
    try {
        await navigator.clipboard.writeText(id);
        if (btnElement) {
            const originalContent = btnElement.innerHTML;
            btnElement.classList.add('copied'); // This triggers the green background
            btnElement.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">check_circle</span> Copied!`;
            setTimeout(() => {
                btnElement.classList.remove('copied');
                btnElement.innerHTML = originalContent;
            }, 2000);
        }
        if (window.showToast) window.showToast('ID Copied!', 'info');
    } catch (err) { console.error("Copy failed", err); }
};

window.openComposeToInstructor = function(name, idOrCourse) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCourse);
    const overlay = document.getElementById('composeModalOverlay');
    if (overlay) overlay.classList.add('open'); 
    
    if (isUUID) {
        secretReceiverId = idOrCourse;
        document.getElementById('composeSubject').value = ''; 
        document.getElementById('composeToDisplay').textContent = `Message to ${name}`;
    } else {
        secretReceiverId = null; 
        document.getElementById('composeSubject').value = `Question: ${idOrCourse}`;
        document.getElementById('composeToDisplay').textContent = `${name} — ${idOrCourse}`;
    }

    const recipientField = document.getElementById('composeRecipientId');
    if (recipientField) recipientField.value = name;
    
    const contentField = document.getElementById('composeContent');
    if (contentField) { 
        contentField.value = ''; 
        setTimeout(() => contentField.focus(), 200); 
    }
};