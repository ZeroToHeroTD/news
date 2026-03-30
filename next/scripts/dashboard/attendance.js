// =============================================================================
// attendance.js — Attendance Widget Loader (Premium SaaS Edition)
// =============================================================================

import { supabase as supabaseClient } from './config.js';
/**
 * Animates a number counting up from 0 to the target value.
 * @param {HTMLElement} element - The DOM element to update.
 * @param {number} endValue - The target number.
 * @param {number} duration - Animation duration in ms.
 * @param {string} suffix - Optional suffix (e.g., '%').
 */
function animateCounter(element, endValue, duration = 1000, suffix = "") {
    if (!element) return;
    let startTimestamp = null;
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing function (easeOutExpo) for a premium slow-down effect at the end
        const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const currentValue = Math.floor(easeProgress * endValue);
        
        element.textContent = currentValue + suffix;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = endValue + suffix; // Ensure exact final value
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Fetches attendance records and updates the dashboard attendance widget:
 * percentage display, absence/late counters, and the animated progress bar.
 *
 * @param {string} userId
 */
export async function loadAttendance(userId) {
    const attPct       = document.getElementById('attendancePct');
    const attAbsences  = document.getElementById('attendanceAbsences');
    const attLate      = document.getElementById('attendanceLate');
    const attBar       = document.getElementById('attendanceBar');

    // If the widget isn't on the current page, exit early
    if (!attPct) return;

    try {
        const { data: records, error } = await supabaseClient
            .from('attendance')
            .select('status')
            .eq('student_id', userId);

        if (error) throw error;

        // --- Logic: Calculate Stats ---
        const total    = records?.length || 0;
        const absences = records?.filter(r => r.status === 'absent').length || 0;
        const lates    = records?.filter(r => r.status === 'late').length   || 0;
        
        // Calculation: (Total Classes - Absences) / Total Classes
        // We default to 100% if no records exist yet (fresh start)
        let percentage = total > 0 
            ? Math.round(((total - absences) / total) * 100) 
            : 100;
            
        // Safety clamp to ensure it never exceeds 100 or drops below 0
        percentage = Math.max(0, Math.min(100, percentage));

        // --- UI Update: Animated Text Counters ---
        animateCounter(attPct, percentage, 1200, '%');
        animateCounter(attAbsences, absences, 1000);
        animateCounter(attLate, lates, 1000);

        // --- UI Update: Animated Progress Bar ---
        if (attBar) {
            // 1. Instant Reset for re-triggering animation smoothly
            attBar.style.transition = 'none';
            attBar.style.width = '0%';
            
            // 2. Apply explicit CSS Custom Properties (Tokens) for exact theme matching
            if (percentage >= 85) {
                attBar.style.backgroundColor = 'var(--accent-green)';
            } else if (percentage >= 75) {
                attBar.style.backgroundColor = 'var(--accent-amber)';
            } else {
                attBar.style.backgroundColor = 'var(--accent-red)';
            }

            // 3. Trigger "Fill" animation
            // Using double requestAnimationFrame ensures the browser paints the 0% width first
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    attBar.style.transition = 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
                    attBar.style.width = `${percentage}%`;
                });
            });
        }

    } catch (err) {
        console.error("Attendance Error:", err.message);
        
        // Failsafe: Set to neutral state if database fails
        if (attPct) attPct.textContent = "--%";
        if (attAbsences) attAbsences.textContent = "-";
        if (attLate) attLate.textContent = "-";
        if (attBar) {
            attBar.style.width = "0%";
            attBar.style.backgroundColor = 'var(--text-muted)';
        }
    }
}