// =============================================================================
// payments.js — Finance & Tuition Ledger (Premium SaaS Edition)
// =============================================================================

import { supabaseClient } from './config.js';

// ==========================================
// 1. UI HELPERS & FORMATTING
// ==========================================

const formatCurrency = (num) => {
    // Premium localization with exact decimal alignment
    return `₱${num.toLocaleString('en-PH', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    })}`;
};

const getPaymentStatus = (status, dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(dueDate);

    // Mapped to the global status badge tokens defined in deadlines.css
    if (status === 'Paid') {
        return { label: 'Paid', badgeClass: 'status-submitted' }; // Maps to green
    }
    
    if (dateObj < today) {
        return { label: 'Overdue', badgeClass: 'status-late' }; // Maps to red
    }

    return { label: 'Pending', badgeClass: 'status-pending' }; // Maps to amber
};

// ==========================================
// 2. MAIN DATA ENGINE
// ==========================================

export async function loadPaymentData(userId) {
    const containers = {
        table: document.getElementById('paymentsTableBody'),
        total: document.getElementById('payTotalBalance'),
        paid: document.getElementById('payPaidAmount'),
        remaining: document.getElementById('payRemainingBalance'),
        dashboard: document.getElementById('smart-pay-label')
    };

    if (!containers.table) return;

    try {
        const { data: payments, error } = await supabaseClient
            .from('student_payments')
            .select('*')
            .eq('student_id', userId)
            .order('due_date', { ascending: true });

        if (error) throw error;

        if (!payments || payments.length === 0) {
            renderEmptyState(containers);
            return;
        }

        // --- Logic: Calculation ---
        const stats = payments.reduce((acc, p) => {
            const amt = parseFloat(p.amount) || 0;
            acc.total += amt;
            if (p.status === 'Paid') acc.paid += amt;
            else acc.pending += amt;
            return acc;
        }, { total: 0, paid: 0, pending: 0 });

        // --- UI: Update Components ---
        updateSummaryCards(containers, stats);
        updatePaymentsTable(containers.table, payments);
        updateDashboardLabel(containers.dashboard, stats.pending);

    } catch (err) {
        console.error("Payment Engine Error:", err.message);
        containers.table.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 40px; color: var(--accent-red); font-weight: 600;">
                    Failed to load financial ledger. Please try again.
                </td>
            </tr>`;
    }
}

// ==========================================
// 3. SUB-RENDERERS (THE "HTML" REFACTOR)
// ==========================================

function updateSummaryCards(els, stats) {
    if (els.total) els.total.textContent = formatCurrency(stats.total);
    if (els.paid) els.paid.textContent = formatCurrency(stats.paid);
    if (els.remaining) els.remaining.textContent = formatCurrency(stats.pending);
}

function updatePaymentsTable(container, payments) {
    container.innerHTML = payments.map((p, idx) => {
        const { label, badgeClass } = getPaymentStatus(p.status, p.due_date);
        const dueDate = new Date(p.due_date).toLocaleDateString('en-US', { 
            month: 'short', day: 'numeric', year: 'numeric' 
        });

        // Applied premium staggered slide-in animation to table rows
        return `
            <tr class="payment-row" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.05}s; opacity: 0;">
                <td class="col-desc">
                    <div style="font-weight: 600; color: var(--text-main);">
                        ${p.description || 'Unknown Fee'}
                    </div>
                </td>
                <td class="col-amount" style="font-weight: 700; color: var(--text-main);">
                    ${formatCurrency(parseFloat(p.amount) || 0)}
                </td>
                <td class="col-date" style="color: var(--text-muted); font-size: 0.9rem;">
                    ${dueDate}
                </td>
                <td class="col-status">
                    <span class="deadline-status-badge ${badgeClass}">${label}</span>
                </td>
            </tr>`;
    }).join('');
}

function updateDashboardLabel(el, pendingAmount) {
    if (!el) return;
    if (pendingAmount > 0) {
        el.textContent = `${formatCurrency(pendingAmount)} Due`;
        // Replace utility class with explicit token injection for absolute theme safety
        el.style.color = 'var(--accent-red)';
        el.style.fontWeight = '700';
    } else {
        el.textContent = 'Account Paid';
        el.style.color = 'var(--text-muted)';
        el.style.fontWeight = '500';
    }
}

function renderEmptyState(els) {
    // Premium empty state for the table
    els.table.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 60px 20px;">
                <div style="width: 60px; height: 60px; background: var(--input-bg); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                    <span class="material-symbols-outlined" style="font-size: 2rem; color: var(--text-muted);">receipt_long</span>
                </div>
                <h4 style="color: var(--text-main); font-weight: 700; margin-bottom: 8px;">No Payment Records</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem;">There are currently no fees or payments associated with your account.</p>
            </td>
        </tr>`;
        
    const zero = formatCurrency(0);
    if (els.total) els.total.textContent = zero;
    if (els.paid) els.paid.textContent = zero;
    if (els.remaining) els.remaining.textContent = zero;
    
    if (els.dashboard) {
        els.dashboard.textContent = 'No balance due';
        els.dashboard.style.color = 'var(--text-muted)';
        els.dashboard.style.fontWeight = '500';
    }
}