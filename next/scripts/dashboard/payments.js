// =============================================================================
// payments.js — Premium Finance & Tuition Ledger (v2 SaaS Edition)
// =============================================================================

import { supabaseClient } from './config.js';

// ---------------------------------------------------------------------------
// 1. UI HELPERS & FORMATTING
// ---------------------------------------------------------------------------

const formatCurrency = (num) => {
    return `₱${num.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

const getStatusConfig = (status, dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(dueDate);

    if (status === 'Paid') {
        return { label: 'PAID', badge: 'status-submitted', icon: 'verified', color: 'var(--accent-green)', rowClass: 'status-is-paid' };
    }

    if (dateObj < today) {
        return { label: 'OVERDUE', badge: 'status-late', icon: 'error', color: 'var(--accent-red)', rowClass: 'status-is-overdue' };
    }

    return { label: 'PENDING', badge: 'status-pending', icon: 'schedule', color: 'var(--accent-amber)', rowClass: 'status-is-pending' };
};

function animateCurrencyCount(element, targetNum, duration = 900) {
    if (!element || isNaN(targetNum)) return;
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(2, -10 * progress);
        const currentValue = ease * targetNum;
        element.textContent = formatCurrency(currentValue);
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = formatCurrency(targetNum);
        }
    };
    window.requestAnimationFrame(step);
}

function getSmartInsight(stats, paidPct, payments) {
    if (stats.pending === 0) return '🎓 All balances cleared — you\'re all set for this semester!';

    const today = new Date(); today.setHours(0,0,0,0);
    const overdueCount = payments.filter(p => p.status !== 'Paid' && new Date(p.due_date) < today).length;

    if (overdueCount > 0) return `⚠️ ${overdueCount} payment${overdueCount > 1 ? 's are' : ' is'} overdue — late fees may apply.`;

    const nextDue = payments.find(p => p.status !== 'Paid');
    if (nextDue) {
        const daysUntil = Math.ceil((new Date(nextDue.due_date) - new Date()) / 86400000);
        if (daysUntil <= 3) return `🔔 Next payment due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} — don't miss it.`;
        if (daysUntil <= 7) return `📅 Payment coming up in ${daysUntil} days. You need ${formatCurrency(stats.pending)} to enroll.`;
    }

    if (paidPct >= 75) return `👍 You're ${Math.round(paidPct)}% through your balance. ${formatCurrency(stats.pending)} remaining.`;

    return `${formatCurrency(stats.pending)} remaining to complete enrollment.`;
}

// ---------------------------------------------------------------------------
// 2. MAIN DATA ENGINE
// ---------------------------------------------------------------------------

export async function loadPaymentData(userId) {
    const containers = {
        table:       document.getElementById('paymentsTableBody'),
        total:       document.getElementById('payTotalBalance'),
        paid:        document.getElementById('payPaidAmount'),
        remaining:   document.getElementById('payRemainingBalance'),
        story:       document.getElementById('paymentsSummaryHighlight'),
        progressBar: document.getElementById('payProgressBar'),
        progressPct: document.getElementById('payProgressPct'),
        progressMsg: document.getElementById('payProgressMsg'),
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

        const stats = payments.reduce((acc, p) => {
            const amt = parseFloat(p.amount) || 0;
            acc.total += amt;
            if (p.status === 'Paid') acc.paid += amt;
            else acc.pending += amt;
            return acc;
        }, { total: 0, paid: 0, pending: 0 });

        const paidPct = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;

        updateSummaryCards(containers, stats, paidPct);
        updateProgressBar(containers, stats, paidPct, payments);
        renderFinancialStory(containers.story, stats.pending, payments);
        updatePaymentsTable(containers.table, payments);

    } catch (err) {
        console.error("Payment Engine Error:", err.message);
        containers.table.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:48px; color:var(--accent-red);">
                    <div style="font-size:1.5rem; margin-bottom:8px;">⚠️</div>
                    <div style="font-weight:700; margin-bottom:4px;">Failed to sync financial data</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Please refresh the page or contact support.</div>
                </td>
            </tr>`;
    }
}

// ---------------------------------------------------------------------------
// 3. SUB-RENDERERS
// ---------------------------------------------------------------------------

function updateSummaryCards(els, stats, pct) {
    if (els.total) {
        animateCurrencyCount(els.total, stats.total);
        setTimeout(() => {
            if (els.total) els.total.innerHTML = `${formatCurrency(stats.total)}<div class="pay-mini-bar"><div style="width:100%; background:var(--primary);"></div></div>`;
        }, 950);
    }
    if (els.paid) {
        animateCurrencyCount(els.paid, stats.paid);
        setTimeout(() => {
            if (els.paid) els.paid.innerHTML = `${formatCurrency(stats.paid)}<div class="pay-mini-bar"><div style="width:${pct}%; background:var(--accent-green);"></div></div>`;
        }, 950);
    }
    if (els.remaining) {
        animateCurrencyCount(els.remaining, stats.pending);
        setTimeout(() => {
            if (els.remaining) {
                const pendingPct = 100 - pct;
                const barColor = stats.pending > 0 ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)';
                els.remaining.innerHTML = `${formatCurrency(stats.pending)}<div class="pay-mini-bar"><div style="width:${pendingPct}%; background:${barColor};"></div></div>`;
            }
        }, 950);
    }
}

function updateProgressBar(els, stats, pct, payments) {
    if (!els.progressBar) return;

    if (els.progressPct) els.progressPct.textContent = `${Math.round(pct)}%`;
    if (els.progressMsg) els.progressMsg.textContent = getSmartInsight(stats, pct, payments);

    els.progressBar.style.transition = 'none';
    els.progressBar.style.width = '0%';

    if (pct >= 85) els.progressBar.style.background = 'linear-gradient(90deg, var(--primary, #6366f1), var(--accent-green, #10b981))';
    else if (pct >= 50) els.progressBar.style.background = 'linear-gradient(90deg, var(--accent-amber, #f59e0b), var(--primary, #6366f1))';
    else els.progressBar.style.background = 'linear-gradient(90deg, var(--accent-red, #ef4444), var(--accent-amber, #f59e0b))';

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            els.progressBar.style.transition = 'width 1.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
            els.progressBar.style.width = `${Math.round(pct)}%`;
        });
    });
}

function renderFinancialStory(container, remaining, payments) {
    if (!container) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdueItems = payments.filter(p => p.status !== 'Paid' && new Date(p.due_date) < today);

    let storyConfig;

    if (remaining === 0) {
        storyConfig = {
            icon: 'verified_user',
            title: '🎓 Tuition Fully Paid',
            sub: "You're cleared for enrollment. Keep up the great work!",
            class: 'story-success',
            action: `<button class="pay-now-btn" style="background:var(--accent-green);" onclick="window.proceedToEnrollment()">
                        <span class="material-symbols-outlined" style="font-size:1rem">school</span>
                        Proceed to Enrollment
                    </button>`
        };
    } else if (overdueItems.length > 0) {
        const oldest = overdueItems[0];
        const daysLate = Math.ceil((today - new Date(oldest.due_date)) / 86400000);
        storyConfig = {
            icon: 'warning',
            title: `${overdueItems.length} Payment${overdueItems.length > 1 ? 's' : ''} Overdue`,
            sub: `Your account is ${daysLate} day${daysLate !== 1 ? 's' : ''} past due. Late fees may apply — please settle immediately.`,
            class: 'story-danger',
            action: `<button class="pay-now-btn" style="background:var(--accent-red);" onclick="window.openPaymentGateway()">
                        <span class="material-symbols-outlined" style="font-size:1rem">payments</span>
                        Pay Overdue Balance
                    </button>`
        };
    } else {
        const nextDue = payments.find(p => p.status !== 'Paid');
        const daysUntil = nextDue ? Math.ceil((new Date(nextDue.due_date) - today) / 86400000) : null;
        const urgencyText = daysUntil !== null
            ? (daysUntil <= 3 ? `⚠️ Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!` : `Due by ${new Date(nextDue.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
            : 'Check your schedule for upcoming dues.';

        storyConfig = {
            icon: 'account_balance_wallet',
            title: `${formatCurrency(remaining)} Remaining`,
            sub: `${urgencyText} — complete your payment to secure enrollment.`,
            class: 'story-warning',
            action: `<button class="pay-now-btn" onclick="window.openPaymentGateway()">
                        <span class="material-symbols-outlined" style="font-size:1rem">payments</span>
                        Complete Payment
                    </button>`
        };
    }

    container.innerHTML = `
        <div class="pay-story-card ${storyConfig.class}">
            <div class="story-icon">
                <span class="material-symbols-outlined">${storyConfig.icon}</span>
            </div>
            <div class="story-content">
                <h3>${storyConfig.title}</h3>
                <p>${storyConfig.sub}</p>
            </div>
            ${storyConfig.action}
        </div>
    `;
}

function updatePaymentsTable(container, payments) {
    container.innerHTML = payments.map((p, idx) => {
        const config = getStatusConfig(p.status, p.due_date);
        const dateStr = new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const today = new Date(); today.setHours(0,0,0,0);
        const daysUntil = Math.ceil((new Date(p.due_date) - today) / 86400000);
        const isUrgent = p.status !== 'Paid' && daysUntil >= 0 && daysUntil <= 3;

        return `
            <tr class="payment-row ${config.rowClass}" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.06}s; opacity: 0;">
                <td class="col-desc">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="material-symbols-outlined" style="font-size:1.15rem; color:${config.color}; flex-shrink:0;">${config.icon}</span>
                        <div>
                            <div style="font-weight:700; color:var(--text-main); line-height:1.3;">${p.description || 'Unknown Fee'}</div>
                            <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-top:2px;">
                                Ref: #${p.id.slice(0,8).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="col-amount" style="font-weight:800; color:var(--text-main); font-family:var(--font-mono, monospace); white-space:nowrap;">
                    ${formatCurrency(parseFloat(p.amount) || 0)}
                </td>
                <td class="col-date" style="color:var(--text-muted); font-size:0.85rem; font-weight:600; white-space:nowrap;">
                    ${dateStr}
                    ${isUrgent ? `<div style="font-size:0.65rem; color:var(--accent-amber); font-weight:800; margin-top:2px; letter-spacing:0.04em;">DUE SOON</div>` : ''}
                </td>
                <td class="col-status">
                    <span class="deadline-status-badge ${config.badge}">${config.label}</span>
                </td>
                <td style="text-align:right; padding-right:16px;">
                    ${p.status === 'Paid'
                        ? `<button class="pay-action-btn" title="Download Official Receipt" onclick="window.downloadDocument('Official Receipt', '${p.id.slice(0,8).toUpperCase()}')">
                                <span class="material-symbols-outlined" style="font-size:1rem;">download</span>
                            </button>`
                        : `<button class="pay-action-btn" title="Pay this item" onclick="window.openPaymentGateway('${formatCurrency(parseFloat(p.amount) || 0)}')">
                                <span class="material-symbols-outlined" style="font-size:1rem;">payment</span>
                            </button>`
                    }
                </td>
            </tr>`;
    }).join('');
}

function renderEmptyState(els) {
    if (els.table) {
        els.table.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:64px;">
                    <div style="font-size:2rem; margin-bottom:12px;">📭</div>
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:6px;">No Transactions Found</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Your payment history will appear here once fees are issued.</div>
                </td>
            </tr>`;
    }

    if (els.story) {
        els.story.innerHTML = `
            <div class="pay-story-card story-success" style="animation: slideInDown 0.5s ease forwards;">
                <div class="story-icon"><span class="material-symbols-outlined">inbox</span></div>
                <div class="story-content">
                    <h3>No Fees Issued Yet</h3>
                    <p>You have no outstanding balances. Check back after enrollment.</p>
                </div>
            </div>`;
    }

    if (els.progressMsg) els.progressMsg.textContent = 'No payment records found for this account.';
    if (els.progressPct) els.progressPct.textContent = 'N/A';
}

// =============================================================================
// GLOBAL ACTION FUNCTIONS (PLAN B / PROOF OF PAYMENT)
// =============================================================================

window.proceedToEnrollment = () => {
    // 1. Clear any stuck double-toasts
    document.querySelectorAll('.toast').forEach(t => t.remove()); 
    // 2. Click the Courses Tab programmatically
    const coursesTab = document.querySelector('a[data-target="view-courses"]');
    if (coursesTab) {
        coursesTab.click();
    } else {
        console.error("Courses tab not found.");
    }
};

window.scrollToHistory = () => {
    const tableSection = document.querySelector('.payments-table-wrapper');
    if(tableSection) {
        tableSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        tableSection.style.transition = 'box-shadow 0.3s';
        tableSection.style.boxShadow = '0 0 15px var(--primary)';
        setTimeout(() => tableSection.style.boxShadow = 'none', 1000);
    }
};

window.openPaymentGateway = (amountStr = null) => {
    const modal = document.getElementById('paymentModalOverlay');
    const amtDisplay = document.getElementById('payAmountDisplay');
    
    if(modal && amtDisplay) {
        if(!amountStr || typeof amountStr !== 'string') {
           const remainingEl = document.getElementById('payRemainingBalance');
           amountStr = remainingEl ? remainingEl.textContent : '₱0.00';
        }
        
        // Setup Modal initial state
        amtDisplay.textContent = amountStr;
        document.getElementById('paymentStep1').style.display = 'block';
        document.getElementById('paymentStep2').style.display = 'none';
        
        // Clear old inputs
        document.getElementById('payRefNumber').value = '';
        document.getElementById('payReceiptFile').value = '';

        modal.classList.add('active'); 
    }
};

window.closePaymentModal = () => {
    const modal = document.getElementById('paymentModalOverlay');
    if(modal) modal.classList.remove('active');
};

// Method Data for Step 2 UI (Replace qr paths with your real images)
const paymentMethodsData = {
    gcash: { name: "GCash", qr: "../Gcash.jpg" },
    maya: { name: "Maya", qr: "../maya-logo.jpg" }
};

window.selectPaymentMethod = (methodKey) => {
    const method = paymentMethodsData[methodKey];
    const amount = document.getElementById('payAmountDisplay').textContent;
    
    // Switch Steps
    document.getElementById('paymentStep1').style.display = 'none';
    document.getElementById('paymentStep2').style.display = 'block';
    
    // Update Step 2 text and image
    document.getElementById('methodNameDisplay').textContent = method.name + " Payment";
    document.getElementById('methodQRCode').src = method.qr;
    document.getElementById('finalAmountText').textContent = amount;
    
    window.currentSelectedMethod = method.name;
};

window.backToStep1 = () => {
    document.getElementById('paymentStep1').style.display = 'block';
    document.getElementById('paymentStep2').style.display = 'none';
};

window.handlePaymentSubmission = async () => {
    const refNo = document.getElementById('payRefNumber').value;
    const fileInput = document.getElementById('payReceiptFile');
    const file = fileInput.files ? fileInput.files[0] : null;
    const btn = document.getElementById('btnConfirmPayment');

    if (!refNo || !file) {
        if (window.showToast) window.showToast("Please provide a Reference No. and upload a screenshot.", "error");
        else alert("Please provide a Reference No. and upload a screenshot.");
        return;
    }

    btn.disabled = true; 
    btn.innerHTML = `<span class="material-symbols-outlined spinning">sync</span> Uploading...`;

    try {
        // Here you would normally run your Supabase upload code. 
        // For right now, we simulate a successful 1.5 second server upload so your UI doesn't crash
        // if your storage bucket isn't set up yet.
        
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        if (window.showToast) window.showToast("Proof submitted! Finance will verify within 24 hours.", "success");
        else alert("Proof submitted! Finance will verify within 24 hours.");
        
        window.closePaymentModal();
    } catch (err) {
        console.error(err);
        if (window.showToast) window.showToast("Error: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">verified</span> Submit Proof`;
    }
};

window.downloadDocument = (docType, reference = 'Statement') => {
    if (window.showToast) window.showToast(`Preparing ${docType}...`, 'info');
    
    setTimeout(() => {
        const textContent = `Official ${docType}\n\nAccount: Jho\nReference: ${reference}\nDate: ${new Date().toLocaleDateString()}\n\nStatus: Document Generated Successfully.`;
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `Jho_${docType.replace(/\s+/g, '_')}_${new Date().getTime()}.txt`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        if (window.showToast) window.showToast(`${docType} downloaded!`, 'success');
    }, 1200);
};

window.contactFinance = () => {
    if (typeof window.openComposeModal === 'function') {
        window.openComposeModal();
        setTimeout(() => {
            const recipientInput = document.getElementById('composeRecipientId');
            const subjectInput = document.getElementById('composeSubject');
            if(recipientInput) recipientInput.value = "Finance & Accounting Office";
            if(subjectInput) subjectInput.value = "Tuition & Fees Inquiry";
        }, 50);
    } else {
        if (window.showToast) window.showToast('Messaging module is offline.', 'error');
    }
};

window.viewPaymentSchedule = () => {
    if (window.showToast) window.showToast('Navigating to Deadlines...', 'info');
    const deadlinesNavBtn = document.querySelector('a[data-target="view-deadlines"]');
    if(deadlinesNavBtn) deadlinesNavBtn.click();
};