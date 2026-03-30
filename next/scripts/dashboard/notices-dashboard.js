// =============================================================================
// notices-dashboard.js — Dashboard Summary & Notices Engine (Premium)
// =============================================================================

import { supabase as supabaseClient } from './config.js';
import { updateUnreadCount } from './messages.js';

// ==========================================
// 1. NOTICES WIDGET RENDERER
// ==========================================

export async function loadNotices() {
    const container = document.getElementById('db-notices-container');
    if (!container) return;

    try {
        const { data: notices, error } = await supabaseClient
            .from('portal_notices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Premium Empty State
        if (!notices || notices.length === 0) {
            container.innerHTML = `
                <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); background: var(--input-bg); border-radius: 16px; border: 1px dashed var(--border-color);">
                    <span class="material-symbols-outlined" style="font-size: 2rem; opacity: 0.5; margin-bottom: 8px;">notifications_paused</span>
                    <p style="font-size: 0.85rem; font-weight: 600;">No new announcements today.</p>
                </div>`;
            return;
        }

        // Render notices using the .notice-item class from layout.css with a staggered slide-in
        container.innerHTML = notices.map((n, idx) => `
            <div class="notice-item" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.06}s; opacity: 0;">
                <h4>${n.title}</h4>
                <p>${n.message}</p>
            </div>
        `).join('');

    } catch (err) {
        console.error("Notices Error:", err.message);
        container.innerHTML = `<p style="color: var(--accent-red); font-size: 0.85rem; padding: 10px; text-align: center;">Failed to load notices.</p>`;
    }
}

// ==========================================
// 2. SMART HERO CARDS ENGINE
// ==========================================

export async function loadSmartDashboardData(userId) {
    // We run these in parallel so one slow query doesn't block the others
    try {
        await Promise.all([
            updateNextClassCard(userId),
            updateUnreadCount(userId),
            updatePaymentCard(userId),
            updateDeadlineCard(userId)
        ]);
    } catch (err) {
        console.error("Smart Dashboard Sync Error:", err.message);
    }
}

// --- Sub-Updater: Next Class ---
async function updateNextClassCard(userId) {
    const els = {
        title: document.getElementById('nextClassText'),
        sub: document.getElementById('nextClassRoom'),
        label: document.getElementById('smart-schedule-label')
    };

    const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

    try {
        const { data } = await supabaseClient
            .from('student_schedule')
            .select('*')
            .eq('student_id', userId)
            .eq('day_of_week', today)
            .gt('start_time', nowTime)
            .order('start_time', { ascending: true })
            .limit(1);

        if (data && data.length > 0) {
            const c = data[0];
            const formattedTime = c.start_time ? c.start_time.substring(0, 5) : '--:--';
            
            if (els.title) els.title.textContent = c.course_name || 'Class';
            if (els.sub)   els.sub.textContent   = `${formattedTime} • Room ${c.room || 'TBA'}`;
            if (els.label) els.label.textContent = `Next class at ${formattedTime}`;
            
            // Add premium color mapping to the smart action label
            if (els.label) els.label.style.color = 'var(--primary)';
        } else {
            if (els.title) els.title.textContent = 'No more classes';
            if (els.sub)   els.sub.textContent   = 'Enjoy your day!';
            if (els.label) {
                els.label.textContent = 'Schedule clear';
                els.label.style.color = 'var(--text-muted)';
            }
        }
    } catch (err) {
        console.error("Next Class Error:", err);
    }
}

// --- Sub-Updater: Payments ---
async function updatePaymentCard(userId) {
    const label = document.getElementById('smart-pay-label');
    if (!label) return;

    try {
        const { data } = await supabaseClient
            .from('student_payments')
            .select('amount')
            .eq('student_id', userId)
            .neq('status', 'Paid');

        const total = data?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;
        
        if (total > 0) {
            label.textContent = `₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Due`;
            // Use precise token mapping instead of generic classes
            label.style.color = 'var(--accent-red)';
            label.style.fontWeight = '700';
        } else {
            label.textContent = 'Account Paid';
            label.style.color = 'var(--text-muted)';
            label.style.fontWeight = '500';
        }
    } catch (err) {
        console.error("Payment Sync Error:", err);
    }
}

// --- Sub-Updater: Deadlines ---
async function updateDeadlineCard(userId) {
    const titleEl = document.getElementById('nextDeadlineText');
    if (!titleEl) return;

    try {
        const { data } = await supabaseClient
            .from('deadlines')
            .select('title, status')
            .eq('student_id', userId)
            .order('due_date', { ascending: true });

        // Filter logic: ignore completed work
        const pending = data?.filter(d => !['submitted', 'done', 'graded'].includes(d.status?.toLowerCase())) || [];

        titleEl.textContent = pending.length > 0 ? pending[0].title : 'No pending deadlines';
        
        // Visual touch: dim the text if there are no deadlines
        titleEl.style.opacity = pending.length > 0 ? '1' : '0.7';
    } catch (err) {
        console.error("Deadline Sync Error:", err);
    }
}