// =============================================================================
// payments.js — Premium Finance & Tuition Ledger
// =============================================================================

import { supabase as supabaseClient } from './config.js';

// --- Safe Toast Wrapper (Fixes the double pop-up issue!) ---
const notify = (msg, type = 'info') => {
    // 1. Force kill ALL old toasts (both legacy and new ones) so they don't stack
    document.querySelectorAll('.toast, .msg-toast').forEach(t => t.remove());
    
    // 2. Call the main showToast
    if (typeof window.showToast === 'function') {
        window.showToast(msg, type);
        
        // 3. Bruteforce cleanup: If a legacy event listener spawns a duplicate a millisecond later, kill it.
        setTimeout(() => {
            const activeToasts = document.querySelectorAll('.toast, .msg-toast');
            if (activeToasts.length > 1) {
                for (let i = 1; i < activeToasts.length; i++) activeToasts[i].remove();
            }
        }, 10);
    } else {
        alert(msg);
    }
};

// ---------------------------------------------------------------------------
// 1. UI HELPERS & FORMATTING
// ---------------------------------------------------------------------------

const formatCurrency = (num) => {
    const amount = Number(num || 0);
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const paymentSubmissionContext = {
    paymentId: null,
};

window.currentSelectedMethod = null;

function resolveSelectedPaymentMethod() {
    if (window.currentSelectedMethod && ['GCash', 'Maya'].includes(window.currentSelectedMethod)) {
        return window.currentSelectedMethod;
    }

    const methodLabel = document.getElementById('methodNameDisplay')?.textContent || '';
    if (methodLabel.toLowerCase().includes('gcash')) return 'GCash';
    if (methodLabel.toLowerCase().includes('maya')) return 'Maya';

    return null;
}

const getStatusConfig = (status, dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateObj = new Date(dueDate);

    if (status === 'Paid') {
        return { label: 'PAID', badge: 'status-submitted', icon: 'verified', color: 'var(--accent-green)', rowClass: 'status-is-paid' };
    }

    if (status === 'Declined') {
        return { label: 'REJECTED', badge: 'status-failed', icon: 'cancel', color: 'var(--accent-red)', rowClass: 'status-is-rejected' };
    }

    if (dateObj < today) {
        return { label: 'OVERDUE', badge: 'status-late', icon: 'error', color: 'var(--accent-red)', rowClass: 'status-is-overdue' };
    }

    return { label: 'PENDING', badge: 'status-pending', icon: 'schedule', color: 'var(--accent-amber)', rowClass: 'status-is-pending' };
};

function normalizeProofDecision(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'approved') return 'Approved';
    if (normalized === 'declined' || normalized === 'rejected') return 'Declined';
    if (normalized === 'pending') return 'Pending';
    return '';
}

function getLatestSubmissionMap(submissions) {
    const byPaymentId = new Map();
    const byReference = new Map();

    submissions.forEach((submission) => {
        const paymentId = String(submission.payment_id || submission.student_payment_id || '').trim();
        const referenceNumber = String(submission.reference_number || '').trim();

        if (paymentId && !byPaymentId.has(paymentId)) byPaymentId.set(paymentId, submission);
        if (referenceNumber && !byReference.has(referenceNumber)) byReference.set(referenceNumber, submission);
    });

    return { byPaymentId, byReference };
}

function decoratePaymentsWithReviewState(payments, submissions) {
    const { byPaymentId, byReference } = getLatestSubmissionMap(submissions);

    return payments.map((payment) => {
        const referenceNumber = String(payment.reference_number || '').trim();
        const proof = byPaymentId.get(String(payment.id)) || (referenceNumber ? byReference.get(referenceNumber) : null) || null;
        const proofDecision = normalizeProofDecision(proof?.review_status || proof?.status);
        const rawStatus = String(payment.status || '').trim();

        let displayStatus = rawStatus;
        if (rawStatus === 'Paid') displayStatus = 'Paid';
        else if (proofDecision === 'Declined') displayStatus = 'Declined';
        else displayStatus = 'Pending';

        return {
            ...payment,
            display_status: displayStatus,
            proof_decision: proofDecision,
            proof_reference_number: String(proof?.reference_number || referenceNumber || '').trim(),
            proof_submitted_at: proof?.submitted_at || proof?.created_at || proof?.updated_at || '',
            has_proof_submission: !!proof,
        };
    });
}

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
    if (stats.pending === 0) return "All balances cleared - you're all set for this semester.";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rejectedCount = payments.filter(p => p.display_status === 'Declined').length;
    if (rejectedCount > 0) {
        return `Payment proof rejected for ${rejectedCount} item${rejectedCount > 1 ? 's' : ''} - resubmit to continue review.`;
    }

    const overdueCount = payments.filter(p => p.display_status !== 'Paid' && p.display_status !== 'Declined' && new Date(p.due_date) < today).length;
    if (overdueCount > 0) return `${overdueCount} payment${overdueCount > 1 ? 's are' : ' is'} overdue - late fees may apply.`;

    const nextDue = payments.find(p => p.display_status !== 'Paid' && p.display_status !== 'Declined');
    if (nextDue) {
        const daysUntil = Math.ceil((new Date(nextDue.due_date) - new Date()) / 86400000);
        if (daysUntil <= 3) return `Next payment due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} - don't miss it.`;
        if (daysUntil <= 7) return `Payment coming up in ${daysUntil} days. You need ${formatCurrency(stats.pending)} to enroll.`;
    }

    if (paidPct >= 75) return `You're ${Math.round(paidPct)}% through your balance. ${formatCurrency(stats.pending)} remaining.`;

    return `${formatCurrency(stats.pending)} remaining to complete enrollment.`;
}

// ---------------------------------------------------------------------------
// 2. MAIN DATA ENGINE
// ---------------------------------------------------------------------------

export async function loadPaymentData(userId) {
    if (!userId) {
        const { data: authData } = await supabaseClient.auth.getUser();
        userId = authData?.user?.id || null;
    }

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
        const [{ data: rawPayments, error: paymentsError }, { data: rawSubmissions, error: submissionsError }] = await Promise.all([
            supabaseClient
                .from('student_payments')
                .select('id, student_id, description, amount, status, due_date, created_at, reference_number')
                .eq('student_id', userId)
                .order('due_date', { ascending: true }),
            supabaseClient
                .from('payment_submissions')
                .select('id, payment_id, student_id, reference_number, review_status, created_at')
                .eq('student_id', userId)
                .order('created_at', { ascending: false })
        ]);

        if (paymentsError) throw paymentsError;
        if (submissionsError) {
            console.warn('Payment submission review state could not be loaded:', submissionsError.message);
        }

        const payments = decoratePaymentsWithReviewState(rawPayments || [], rawSubmissions || []);

        if (!payments.length) {
            renderEmptyState(containers);
            return;
        }

        const stats = payments.reduce((acc, p) => {
            const amt = parseFloat(p.amount) || 0;
            acc.total += amt;
            if (p.display_status === 'Paid') acc.paid += amt;
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
                    <div style="font-size:1.5rem; margin-bottom:8px;">??</div>
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rejectedItems = payments.filter(p => p.display_status === 'Declined');
    const overdueItems = payments.filter(p => p.display_status !== 'Paid' && p.display_status !== 'Declined' && new Date(p.due_date) < today);

    let storyConfig;

    if (remaining === 0) {
        storyConfig = {
            icon: 'verified_user',
            title: 'Tuition Fully Paid',
            sub: "You're cleared for enrollment. Keep up the great work!",
            class: 'story-success',
            action: `<button class="pay-now-btn" style="background:var(--accent-green);" onclick="window.proceedToEnrollment()">
                        <span class="material-symbols-outlined" style="font-size:1rem">school</span>
                        Proceed to Enrollment
                    </button>`
        };
    } else if (rejectedItems.length > 0) {
        const rejectedItem = rejectedItems[0];
        storyConfig = {
            icon: 'rule',
            title: 'Payment Proof Needs Resubmission',
            sub: `${rejectedItem.description || 'A payment item'} was rejected by finance. Upload a clearer receipt or correct reference number to continue.`,
            class: 'story-danger',
            action: `<button class="pay-now-btn" style="background:var(--accent-red);" onclick="window.openPaymentGateway('${formatCurrency(parseFloat(rejectedItem.amount || 0))}', '${rejectedItem.id}')">
                        <span class="material-symbols-outlined" style="font-size:1rem">upload</span>
                        Resubmit Proof
                    </button>`
        };
    } else if (overdueItems.length > 0) {
        const oldest = overdueItems[0];
        const daysLate = Math.ceil((today - new Date(oldest.due_date)) / 86400000);
        storyConfig = {
            icon: 'warning',
            title: `${overdueItems.length} Payment${overdueItems.length > 1 ? 's' : ''} Overdue`,
            sub: `Your account is ${daysLate} day${daysLate !== 1 ? 's' : ''} past due. Late fees may apply - please settle immediately.`,
            class: 'story-danger',
            action: `<button class="pay-now-btn" style="background:var(--accent-red);" onclick="window.openPaymentGateway()">
                        <span class="material-symbols-outlined" style="font-size:1rem">payments</span>
                        Pay Overdue Balance
                    </button>`
        };
    } else {
        const nextDue = payments.find(p => p.display_status !== 'Paid' && p.display_status !== 'Declined');
        const daysUntil = nextDue ? Math.ceil((new Date(nextDue.due_date) - today) / 86400000) : null;
        const urgencyText = daysUntil !== null
            ? (daysUntil <= 3 ? `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}!` : `Due by ${new Date(nextDue.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
            : 'Check your schedule for upcoming dues.';

        storyConfig = {
            icon: 'account_balance_wallet',
            title: `${formatCurrency(remaining)} Remaining`,
            sub: `${urgencyText} - complete your payment to secure enrollment.`,
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
    window.cachedPaymentsData = payments;

    container.innerHTML = payments.map((p, idx) => {
        const effectiveStatus = p.display_status || p.status;
        const config = getStatusConfig(effectiveStatus, p.due_date);
        const dateStr = new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((new Date(p.due_date) - today) / 86400000);
        const isUrgent = effectiveStatus !== 'Paid' && effectiveStatus !== 'Declined' && daysUntil >= 0 && daysUntil <= 3;

        const realRef = p.proof_reference_number || (p.reference_number ? p.reference_number.toString().trim() : p.id.slice(0, 8).toUpperCase());
        const descSafe = (p.description || 'Unknown Fee').replace(/'/g, "\'");
        const amtRaw = parseFloat(p.amount) || 0;
        const proofMeta = effectiveStatus === 'Declined'
            ? `<div style="font-size:0.68rem; color:var(--accent-red); font-weight:800; letter-spacing:0.04em; margin-top:3px;">Proof rejected - resubmit receipt</div>`
            : (p.has_proof_submission && effectiveStatus === 'Pending'
                ? `<div style="font-size:0.68rem; color:var(--accent-amber); font-weight:800; letter-spacing:0.04em; margin-top:3px;">Proof under finance review</div>`
                : '');

        return `
            <tr class="payment-row ${config.rowClass}" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.06}s; opacity: 0;">
                <td class="col-desc">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="material-symbols-outlined" style="font-size:1.15rem; color:${config.color}; flex-shrink:0;">${config.icon}</span>
                        <div>
                            <div style="font-weight:700; color:var(--text-main); line-height:1.3;">${p.description || 'Unknown Fee'}</div>
                            <div style="font-size:0.68rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin-top:2px;">
                                Ref: #${realRef}
                            </div>
                            ${proofMeta}
                        </div>
                    </div>
                </td>
                <td class="col-amount" style="font-weight:800; color:var(--text-main); font-family:var(--font-mono, monospace); white-space:nowrap;">
                    ${formatCurrency(amtRaw)}
                </td>
                <td class="col-date" style="color:var(--text-muted); font-size:0.85rem; font-weight:600; white-space:nowrap;">
                    ${dateStr}
                    ${isUrgent ? `<div style="font-size:0.65rem; color:var(--accent-amber); font-weight:800; margin-top:2px; letter-spacing:0.04em;">DUE SOON</div>` : ''}
                </td>
                <td class="col-status">
                    <span class="deadline-status-badge ${config.badge}">${config.label}</span>
                </td>
                <td style="text-align:right; padding-right:16px;">
                    ${effectiveStatus === 'Paid'
                        ? `<button class="pay-action-btn" title="Download Official Receipt" onclick="window.downloadDocument('Official Receipt', '${realRef}', '${descSafe}', ${amtRaw}, '${dateStr}', '${effectiveStatus}')">
                                <span class="material-symbols-outlined" style="font-size:1rem;">download</span>
                            </button>`
                        : `<button class="pay-action-btn" title="${effectiveStatus === 'Declined' ? 'Resubmit payment proof' : 'Pay this item'}" onclick="window.openPaymentGateway('${formatCurrency(amtRaw)}', '${p.id}')">
                                <span class="material-symbols-outlined" style="font-size:1rem;">${effectiveStatus === 'Declined' ? 'upload' : 'payment'}</span>
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
// GLOBAL ACTION FUNCTIONS 
// =============================================================================

window.proceedToEnrollment = () => {
    const coursesTab = document.querySelector('a[data-target="view-courses"]');
    if (coursesTab) coursesTab.click();
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

function resolvePendingPaymentRecord() {
    const payments = Array.isArray(window.cachedPaymentsData) ? window.cachedPaymentsData : [];

    if (paymentSubmissionContext.paymentId) {
        const matched = payments.find(payment => String(payment.id) === String(paymentSubmissionContext.paymentId));
        if (matched) return matched;
    }

    const modalAmount = document.getElementById('payAmountDisplay')?.textContent || '';
    const parsedAmount = Number(String(modalAmount).replace(/[^\d.]/g, ''));
    const unpaidPayments = payments.filter(payment => String(payment.status || '').trim() !== 'Paid');
    const amountMatched = unpaidPayments.find(payment => Math.abs((parseFloat(payment.amount || 0)) - parsedAmount) < 0.01);

    return amountMatched || unpaidPayments[0] || null;
}

async function uploadPaymentProof(userId, paymentId, file) {
    const safeName = String(file?.name || 'proof.png').replace(/[^a-zA-Z0-9._-]/g, '-');
    const filePath = `${userId}/${paymentId || 'manual'}/${Date.now()}-${safeName}`;
    const bucket = 'payment-proofs';

    const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(filePath, file, {
        upsert: false,
        cacheControl: '3600',
    });
    if (uploadError) {
        throw new Error('Payment proof upload failed. Check that the payment-proofs storage bucket exists and accepts uploads.');
    }

    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);
    return {
        bucket,
        filePath,
        publicUrl: data?.publicUrl || '',
    };
}

async function createPaymentSubmissionRecord(submission) {
    const submittedAt = new Date().toISOString();
    const attempts = [
        {
            payment_id: submission.payment_id,
            student_id: submission.student_id,
            reference_number: submission.reference_number,
            proof_url: submission.proof_url,
            payment_method: submission.payment_method,
            method: submission.payment_method,
            amount: submission.amount,
            description: submission.description,
            status: 'Pending',
            submitted_at: submittedAt,
        },
        {
            payment_id: submission.payment_id,
            student_id: submission.student_id,
            reference_number: submission.reference_number,
            receipt_url: submission.proof_url,
            payment_method: submission.payment_method,
            method: submission.payment_method,
            amount: submission.amount,
            description: submission.description,
            status: 'Pending',
            submitted_at: submittedAt,
        },
        {
            payment_id: submission.payment_id,
            student_id: submission.student_id,
            reference_number: submission.reference_number,
            proof_url: submission.proof_url,
            payment_method: submission.payment_method,
            method: submission.payment_method,
            amount: submission.amount,
            description: submission.description,
            review_status: 'Pending',
            created_at: submittedAt,
        },
        {
            payment_id: submission.payment_id,
            student_id: submission.student_id,
            reference_number: submission.reference_number,
            receipt_url: submission.proof_url,
            payment_method: submission.payment_method,
            method: submission.payment_method,
            amount: submission.amount,
            description: submission.description,
            review_status: 'Pending',
            created_at: submittedAt,
        },
    ];

    let lastError = null;
    for (const payload of attempts) {
        const { error } = await supabaseClient.from('payment_submissions').insert([payload]);
        if (!error) return payload;
        lastError = error;
    }

    throw new Error(lastError?.message || 'Payment submission could not be saved for admin review.');
}

window.openPaymentGateway = (amountStr = null, paymentId = null) => {
    const modal = document.getElementById('paymentModalOverlay');
    const amtDisplay = document.getElementById('payAmountDisplay');
    
    if(modal && amtDisplay) {
        paymentSubmissionContext.paymentId = paymentId || null;
        window.currentSelectedMethod = null;
        if(!amountStr || typeof amountStr !== 'string') {
           const remainingEl = document.getElementById('payRemainingBalance');
           amountStr = remainingEl ? remainingEl.textContent : formatCurrency(0);
        }
        
        amtDisplay.textContent = amountStr;
        document.getElementById('paymentStep1').style.display = 'block';
        document.getElementById('paymentStep2').style.display = 'none';
        
        document.getElementById('payRefNumber').value = '';
        document.getElementById('payReceiptFile').value = '';

        document.getElementById('fileNameText').textContent = 'Click to browse or drag file';
        document.getElementById('fileUploadLabel').classList.remove('has-file');
        document.getElementById('fileUploadIcon').textContent = 'upload_file';

        modal.classList.add('active'); 
    }
};

window.closePaymentModal = () => {
    const modal = document.getElementById('paymentModalOverlay');
    paymentSubmissionContext.paymentId = null;
    window.currentSelectedMethod = null;
    if(modal) modal.classList.remove('active');
};

const paymentMethodsData = {
    gcash: { name: "GCash", qr: "../Gcash.jpg" },
    maya: { name: "Maya", qr: "../maya-logo.jpg" }
};

window.selectPaymentMethod = (methodKey) => {
    const method = paymentMethodsData[methodKey];
    const amount = document.getElementById('payAmountDisplay').textContent;
    
    document.getElementById('paymentStep1').style.display = 'none';
    document.getElementById('paymentStep2').style.display = 'block';
    
    document.getElementById('methodNameDisplay').textContent = method.name + " Payment";
    document.getElementById('methodQRCode').src = method.qr;
    document.getElementById('finalAmountText').textContent = amount;
    
    window.currentSelectedMethod = method.name;
};

window.backToStep1 = () => {
    document.getElementById('paymentStep1').style.display = 'block';
    document.getElementById('paymentStep2').style.display = 'none';
    window.currentSelectedMethod = null;
};

window.handlePaymentSubmission = async () => {
    const refNo = document.getElementById('payRefNumber').value.trim();
    const fileInput = document.getElementById('payReceiptFile');
    const file = fileInput.files ? fileInput.files[0] : null;
    const btn = document.getElementById('btnConfirmPayment');

    if (!refNo || !file) {
        notify("Please provide a Reference No. and upload a screenshot.", "error");
        return;
    }

    if (!String(file.type || '').startsWith('image/')) {
        notify("Please upload a valid image file.", "error");
        return;
    }

    const selectedMethod = resolveSelectedPaymentMethod();
    if (!selectedMethod) {
        notify("Please choose GCash or Maya before submitting proof.", "error");
        return;
    }

    btn.disabled = true; 
    btn.innerHTML = `<span class="material-symbols-outlined spinning">sync</span> Uploading...`;

    try {
        const { data: authData, error: authError } = await supabaseClient.auth.getUser();
        if (authError) throw authError;

        const currentUser = authData?.user;
        if (!currentUser?.id) throw new Error('Your session expired. Please sign in again.');

        const paymentRecord = resolvePendingPaymentRecord();
        if (!paymentRecord?.id) throw new Error('No pending payment record is linked to this submission yet.');

        const upload = await uploadPaymentProof(currentUser.id, paymentRecord.id, file);
        await createPaymentSubmissionRecord({
            payment_id: paymentRecord.id,
            student_id: currentUser.id,
            reference_number: refNo,
            proof_url: upload.publicUrl,
            payment_method: selectedMethod,
            amount: parseFloat(paymentRecord.amount || 0),
            description: paymentRecord.description || 'Payment proof submission',
        });

        const { error: updateError } = await supabaseClient
            .from('student_payments')
            .update({ reference_number: refNo })
            .eq('id', paymentRecord.id);
        if (updateError) throw updateError;

        notify("Proof submitted! Finance will verify within 24 hours.", "success");
        await loadPaymentData();
        window.closePaymentModal();
    } catch (err) {
        console.error(err);
        notify("Error: " + err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">verified</span> Submit Proof`;
    }
};

window.downloadDocument = async (docType, refId = null, desc = null, amount = null, dueDate = null, status = null) => {
    notify(`Preparing official ${docType.toLowerCase()}...`, 'info');

    if (!window.jspdf) {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    setTimeout(() => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const userName = document.getElementById('topbarName')?.textContent || 'Student';
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const reference = refId || 'STMT-' + Math.floor(Math.random() * 1000000);

        const primaryColor = [15, 23, 42]; 
        const textColor = [30, 41, 59];
        const grayColor = [100, 116, 139];
        const lightBorder = [226, 232, 240];

        // --- HEADER BANNER ---
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text(docType.toUpperCase(), 20, 25);

        // Header Meta
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Date: ${todayStr}`, 190, 18, { align: 'right' });
        doc.text(`Ref No: #${reference}`, 190, 24, { align: 'right' });
        doc.text(`Portal ID: AUTH-${Math.floor(Math.random() * 9999)}`, 190, 30, { align: 'right' });

        // --- BILLING INFO ---
        doc.setTextColor(...textColor);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("PREPARED FOR:", 20, 55);
        doc.setFontSize(14);
        doc.text(userName.toUpperCase(), 20, 63);

        // 👉 FIX: SCRAPE THE ACTUAL ITEMIZED DATA
        let items = [];
        let isStatement = false;

        if (desc && amount !== null) {
            // Single Receipt
            items.push({ desc: desc, date: dueDate || todayStr, status: (status || 'PAID').toUpperCase(), amount: amount });
        } else {
            // Statement of Account (Itemized Ledger)
            isStatement = true;
            if (window.cachedPaymentsData && window.cachedPaymentsData.length > 0) {
                window.cachedPaymentsData.forEach(p => {
                    items.push({
                        desc: p.description || 'Unknown Fee',
                        date: new Date(p.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                        status: (p.status || 'PENDING').toUpperCase(),
                        amount: parseFloat(p.amount) || 0
                    });
                });
            } else {
                items.push({ desc: 'No transactions found', date: '--', status: '--', amount: 0 });
            }
        }

        // --- TABLE HEADER ---
        const startY = 85;
        doc.setFillColor(248, 250, 252);
        doc.rect(20, startY, 170, 10, 'F');
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...grayColor);
        doc.text("DESCRIPTION", 25, startY + 7);
        doc.text("DUE DATE", 100, startY + 7);
        doc.text("STATUS", 135, startY + 7);
        doc.text("AMOUNT", 185, startY + 7, { align: 'right' });

        doc.setDrawColor(...lightBorder);
        doc.setLineWidth(0.5);
        doc.line(20, startY + 10, 190, startY + 10);

        // --- TABLE ROWS ---
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...textColor);
        let currentY = startY + 18;
        
        let totalBilled = 0;
        let totalPaid = 0;

        items.forEach((item) => {
            doc.setFontSize(10);
            const safeDesc = item.desc.length > 35 ? item.desc.substring(0, 32) + '...' : item.desc;
            doc.text(safeDesc, 25, currentY);
            doc.text(item.date, 100, currentY);
            
            doc.setFont("helvetica", "bold");
            if (item.status === 'PAID') {
                doc.setTextColor(22, 163, 74); 
                totalPaid += item.amount;
            } else {
                doc.setTextColor(220, 38, 38); 
            }
            doc.text(item.status, 135, currentY);
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...textColor);

            totalBilled += item.amount;
            doc.text(`PHP ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 185, currentY, { align: 'right' });

            currentY += 12;
            doc.line(20, currentY - 4, 190, currentY - 4); 
        });

        // --- SUB-TOTALS & FOOTER ---
        currentY += 6;
        doc.setFontSize(10);

        if (isStatement) {
            // Detailed Breakdown for Statement of Account
            doc.setFont("helvetica", "normal");
            doc.text("Total Fees Issued:", 150, currentY, { align: 'right' });
            doc.text(`PHP ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 185, currentY, { align: 'right' });
            
            currentY += 8;
            doc.text("Total Amount Paid:", 150, currentY, { align: 'right' });
            doc.setTextColor(22, 163, 74); // Green
            doc.text(`- PHP ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 185, currentY, { align: 'right' });
            
            currentY += 8;
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...textColor);
            doc.setFontSize(11);
            doc.text("REMAINING BALANCE:", 150, currentY, { align: 'right' });
            
            const remaining = totalBilled - totalPaid;
            if (remaining > 0) doc.setTextColor(220, 38, 38); // Red if they still owe
            doc.text(`PHP ${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 185, currentY, { align: 'right' });

        } else {
            // Simple Footer for a Single Receipt
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("TOTAL PAID:", 150, currentY, { align: 'right' });
            doc.text(`PHP ${totalBilled.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 185, currentY, { align: 'right' });
        }

        // Bottom Fine Print
        doc.setTextColor(...grayColor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("This is an electronically generated official document. No physical signature is required.", 105, 270, { align: 'center' });
        doc.text("For any discrepancies, please contact the Finance & Accounting Office immediately.", 105, 275, { align: 'center' });

        const cleanName = docType.replace(/\s+/g, '_');
        doc.save(`${userName.split(' ')[0]}_${cleanName}_${reference}.pdf`);

        notify(`${docType} successfully downloaded.`, 'success');
    }, 600); 
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
        notify('Messaging module is offline.', 'error');
    }
};

window.viewPaymentSchedule = () => {
    // Removed the manual toast here, because clicking the tab automatically creates one!
    const deadlinesNavBtn = document.querySelector('a[data-target="view-deadlines"]');
    if(deadlinesNavBtn) deadlinesNavBtn.click();
};

// Make the file upload UI interactive
document.getElementById('payReceiptFile')?.addEventListener('change', function(e) {
    const fileNameText = document.getElementById('fileNameText');
    const label = document.getElementById('fileUploadLabel');
    const icon = document.getElementById('fileUploadIcon');
    
    if (this.files && this.files.length > 0) {
        fileNameText.textContent = this.files[0].name;
        label.classList.add('has-file');
        icon.textContent = 'check_circle';
    } else {
        fileNameText.textContent = 'Click to browse or drag file';
        label.classList.remove('has-file');
        icon.textContent = 'upload_file';
    }
});
