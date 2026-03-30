// =============================================================================
// schedule.js — Class Schedule & Live Tracker Engine (Premium SaaS Edition)
// =============================================================================

import { supabase as supabaseClient } from './config.js';

// ==========================================
// 1. UI HELPERS & TIME LOGIC
// ==========================================

/**
 * Checks if the current time falls within the class schedule.
 */
const getLiveStatus = (startTimeStr, endTimeStr) => {
    if (!startTimeStr || !endTimeStr) return false;
    
    const now = new Date();
    const currentHHMM = now.getHours() * 100 + now.getMinutes();
    
    const start = parseInt(startTimeStr.replace(/:/g, '').substring(0, 4));
    const end = parseInt(endTimeStr.replace(/:/g, '').substring(0, 4));
    
    return currentHHMM >= start && currentHHMM <= end;
};

const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '--:--';

/**
 * Shared Card Renderer for Today & Weekly views
 * Mapped strictly to schedule-courses-resources.css
 */
const renderScheduleCard = (item, idx, isLive = false) => {
    const start = formatTime(item.start_time);
    const end = formatTime(item.end_time);
    
    // We map 'is-urgent' to trigger the red accent bar in the CSS
    const liveClass = isLive ? 'is-urgent' : ''; 
    const urgentClass = item.is_urgent ? 'is-urgent' : '';

    return `
        <div class="schedule-item-card ${liveClass} ${urgentClass}" 
             style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.05}s; opacity: 0;">
            
            <div class="schedule-time-badge">
                <span class="time-start">${start}</span>
                <span class="time-sep">to</span>
                <span class="time-end">${end}</span>
            </div>

            <div class="schedule-item-info">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <h4>${item.course_name}</h4>
                    ${isLive ? '<span style="font-size:0.6rem; font-weight:900; background:var(--accent-red); color:white; padding:2px 6px; border-radius:6px; letter-spacing:0.05em; animation: statusPulseEffect 2s infinite ease-out;">LIVE</span>' : ''}
                </div>
                
                <p>${item.instructor || 'TBA'}</p>
                
                <div class="room-badge">
                    <span class="material-symbols-outlined" style="font-size: 0.95rem;">location_on</span>
                    <span>Room ${item.room || 'TBA'}</span>
                </div>
            </div>
        </div>`;
};

// ==========================================
// 2. TODAY'S SCHEDULE (DASHBOARD WIDGET)
// ==========================================

export async function loadTodaysSchedule(userId) {
    const container = document.getElementById('todaysScheduleList');
    if (!container) return;

    try {
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const today = dayNames[new Date().getDay()];

        const { data: schedule, error } = await supabaseClient
            .from('student_schedule')
            .select('*')
            .eq('student_id', userId)
            .eq('day_of_week', today)
            .order('start_time', { ascending: true });

        if (error) throw error;

        // Premium Empty State
        if (!schedule || schedule.length === 0) {
            container.innerHTML = `
                <div style="padding: 30px 20px; text-align: center; background: var(--input-bg); border-radius: 20px; border: 1px dashed var(--border-color);">
                    <span class="material-symbols-outlined" style="font-size: 2.5rem; color: var(--accent-green); opacity: 0.8; margin-bottom: 10px;">celebration</span>
                    <h4 style="color: var(--text-main); font-weight: 700; margin-bottom: 4px;">No classes today!</h4>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">Enjoy your free time or catch up on readings.</p>
                </div>`;
            return;
        }

        container.innerHTML = schedule.map((item, idx) => {
            const isLive = getLiveStatus(item.start_time, item.end_time);
            return renderScheduleCard(item, idx, isLive);
        }).join('');

    } catch (err) {
        console.error("Today's Schedule Error:", err.message);
        container.innerHTML = `<p style="color: var(--accent-red); font-size: 0.85rem; padding: 10px;">Failed to load today's classes.</p>`;
    }
}

// ==========================================
// 3. WEEKLY SCHEDULE (FULL PAGE)
// ==========================================

export async function loadWeeklySchedule(userId) {
    const grid = document.getElementById('weeklyScheduleGrid');
    if (!grid) return;

    try {
        const { data: schedule, error } = await supabaseClient
            .from('student_schedule')
            .select('*')
            .eq('student_id', userId)
            .order('start_time', { ascending: true });

        if (error) throw error;
        
        if (!schedule || schedule.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px; background: var(--card-bg); border: 1px dashed var(--border-color); border-radius: 24px;">
                    <div style="width: 80px; height: 80px; background: var(--input-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <span class="material-symbols-outlined" style="font-size: 2.5rem; color: var(--text-muted);">event_busy</span>
                    </div>
                    <h3 style="color: var(--text-main); font-weight: 800; font-size: 1.2rem; margin-bottom: 8px;">No Schedule Found</h3>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">Your weekly schedule has not been uploaded yet.</p>
                </div>`;
            return;
        }

        const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

        grid.innerHTML = days.map((day, dIdx) => {
            const dayClasses = schedule.filter(item => item.day_of_week === day);
            if (dayClasses.length === 0) return '';

            // Mapped to .schedule-day-block layout from schedule-courses-resources.css
            return `
                <div class="schedule-day-block" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${dIdx * 0.08}s; opacity: 0;">
                    <div class="schedule-day-label">
                        ${day} &nbsp;•&nbsp; ${dayClasses.length} Class${dayClasses.length > 1 ? 'es' : ''}
                    </div>
                    <div class="schedule-items-grid">
                        ${dayClasses.map((item, idx) => renderScheduleCard(item, idx, false)).join('')}
                    </div>
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Weekly Schedule Error:", err.message);
        grid.innerHTML = `<p style="color:var(--accent-red); grid-column:1/-1; text-align:center; padding:40px; background:var(--card-bg); border-radius:16px;">Failed to sync weekly data. Please try again.</p>`;
    }
}