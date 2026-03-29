// =============================================================================
// deadlines.js — Deadlines Engine & Task Management (UPGRADED DYNAMIC EDITION)
// =============================================================================

import { supabaseClient } from './config.js';

// ---------------------------------------------------------------------------
// 1. UI HELPER & FORMATTING
// ---------------------------------------------------------------------------

const getUrgencyData = (dueDate, isSubmitted) => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isLate = !isSubmitted && diffDays < 0;
    const isSoon = !isSubmitted && diffDays >= 0 && diffDays <= 2;

    let label = `Due in ${diffDays} days`;
    if (isLate) {
        const absDays = Math.abs(diffDays);
        label = absDays === 1 ? 'OVERDUE BY 1 DAY' : `OVERDUE BY ${absDays} DAYS`;
    } 
    else if (isSubmitted) label = 'COMPLETED';
    else if (diffDays === 0) label = 'DUE TODAY';
    else if (diffDays === 1) label = 'DUE TOMORROW';

    return { isLate, isSoon, label, diffDays };
};

const getIcon = (type) => {
    const icons = { quiz: '📝', exam: '📋', project: '💻', assignment: '📌' };
    return icons[type?.toLowerCase()] || '📌';
};

// ---------------------------------------------------------------------------
// 2. MAIN DATA LOADER
// ---------------------------------------------------------------------------

export async function loadDeadlines(userId) {
    const containers = {
        main: document.getElementById('deadlinesContainer'),
        hero: document.getElementById('nextDeadlineText'),
        widget: document.getElementById('missingOutputsContainer')
    };

    try {
        const { data: deadlines, error } = await supabaseClient
            .from('deadlines')
            .select('*')
            .eq('student_id', userId)
            .order('due_date', { ascending: true });

        if (error) throw error;

        const pending = deadlines?.filter(d => !['submitted', 'done', 'graded'].includes(d.status?.toLowerCase())) || [];

        // --- FIX: CALL THE UPDATE HERO FUNCTION HERE ---
        updateHero(containers.hero, pending);

        updateWidget(containers.widget, pending);
        updateFullPage(containers.main, deadlines);

    } catch (err) {
        console.error("Deadlines Error:", err.message);
    }
}

// ---------------------------------------------------------------------------
// 3. SUB-RENDERERS
// ---------------------------------------------------------------------------

function updateHero(el, pending) {
    if (!el) return;
    
    const labelEl = el.parentElement?.querySelector('small');
    const statusTextEl = el.parentElement?.querySelector('p');

    if (pending.length === 0) {
        el.textContent = 'All caught up!';
        if (labelEl) labelEl.textContent = 'Deadlines';
        if (statusTextEl) statusTextEl.textContent = 'Enjoy your day!';
        return;
    }

    const firstTask = pending[0];
    el.textContent = firstTask.title;

    const { isLate } = getUrgencyData(new Date(firstTask.due_date), false);

    if (isLate) {
        if (labelEl) {
            labelEl.textContent = 'Overdue Deadline';
            labelEl.style.color = '#ef4444'; 
        }
        if (statusTextEl) statusTextEl.textContent = 'Immediate Action Required';
        el.closest('.focus-card')?.classList.add('urgent-pulse');
    } else {
        if (labelEl) {
            labelEl.textContent = 'Upcoming Deadline';
            labelEl.style.color = ''; 
        }
        if (statusTextEl) statusTextEl.textContent = 'Action Required';
        el.closest('.focus-card')?.classList.remove('urgent-pulse');
    }
}

function updateWidget(container, pending) {
    if (!container) return;
    if (pending.length === 0) {
        container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">No pending tasks</div>`;
        return;
    }

    container.innerHTML = pending.slice(0, 3).map(d => {
        const { isLate, label } = getUrgencyData(new Date(d.due_date), false);
        return `
            <div class="missing-output-item" style="display: flex; align-items: center; gap: 14px; cursor: pointer;" onclick='window.openDeadlineModal(${JSON.stringify(d).replace(/'/g, "&#39;")})'>
                <div class="missing-dot ${isLate ? '' : 'amber'}"></div>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: var(--text-main); font-weight: 700; font-size: 0.9rem;">${d.title}</div>
                    <div style="color: ${isLate ? 'var(--accent-red)' : 'var(--text-muted)'}; font-weight: 600; font-size: 0.75rem;">${label}</div>
                </div>
            </div>`;
    }).join('');
}

function updateFullPage(container, allDeadlines) {
    if (!container) return;
    container.innerHTML = allDeadlines.map((d, idx) => {
        const isDone = ['submitted', 'done', 'graded'].includes(d.status?.toLowerCase());
        const { isLate, label } = getUrgencyData(new Date(d.due_date), isDone);
        
        let displayStatus = d.status || 'Pending';
        let statusClass = `status-${displayStatus.toLowerCase()}`;
        if (isLate && !isDone) { displayStatus = 'Missing'; statusClass = 'status-missing'; }
        
        const actionLabel = isLate ? 'FILE APPEAL' : 'VIEW DETAILS';

        return `
            <div class="deadline-item ${isLate ? 'deadline-late' : ''}" onclick='window.openDeadlineModal(${JSON.stringify(d).replace(/'/g, "&#39;")})'>
                <div class="deadline-icon">${getIcon(d.type)}</div>
                <div class="deadline-info">
                    <div class="deadline-top">
                        <h4>${d.title}</h4>
                        <span class="deadline-type-badge">${(d.type || 'Task').toUpperCase()}</span>
                    </div>
                    <p style="color: var(--text-muted); font-size: 0.85rem;">${d.subject || 'General'}</p>
                    <div class="deadline-bottom">
                        <div class="deadline-due ${isLate ? 'late' : ''}">
                            <span class="material-symbols-outlined" style="font-size: 1rem;">schedule</span> ${label}
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                             <span class="deadline-status-badge ${statusClass}">${displayStatus.toUpperCase()}</span>
                             <div class="dl-action-trigger" style="display: flex; align-items: center; justify-content: center; min-width: 100px;">${actionLabel}</div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// 4. MODAL LOGIC
// ---------------------------------------------------------------------------

window.openDeadlineModal = function(deadline) {
    const modal = document.getElementById('deadlineModalOverlay');
    if (!modal) return;
    
    const isDone = ['submitted', 'done', 'graded'].includes(deadline.status?.toLowerCase());
    const { isLate } = getUrgencyData(new Date(deadline.due_date), isDone);

    document.getElementById('dlModalTitle').textContent = deadline.title;
    document.getElementById('dlModalSubject').textContent = deadline.subject || '--';
    document.getElementById('dlModalDue').textContent = new Date(deadline.due_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let displayStatus = deadline.status || 'Pending';
    let statusClass = `dl-status-value status-${displayStatus.toLowerCase()}`;
    if (isLate && !isDone) { displayStatus = 'Missing'; statusClass = 'dl-status-value status-missing'; }

    const statusEl = document.getElementById('dlModalStatus');
    statusEl.textContent = displayStatus.toUpperCase();
    statusEl.className = statusClass;

    const notesArea = document.getElementById('dlModalNotes');
    notesArea.innerHTML = `<p style="color: var(--text-main); font-size: 0.95rem; line-height: 1.6;">${deadline.notes || 'No instructions provided.'}</p>`;

    let modalBox = modal.querySelector('.compose-modal-box');
    const oldFooter = document.getElementById('dynamicAppealFooter');
    if (oldFooter) oldFooter.remove();

    if (isLate && !isDone && modalBox) {
        const insName = deadline.instructor_name || 'Assigned Instructor';
        const insId   = deadline.instructor_id || 'UID-NOT-FOUND';

        const footerHTML = `
            <div id="dynamicAppealFooter" style="margin-top: 20px; padding: 25px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 16px; display: flex; flex-direction: column; align-items: center; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; color: #f87171; font-weight: 800; font-size: 0.9rem; margin-bottom: 8px;">
                    <span class="material-symbols-outlined" style="font-size: 1.4rem;">report</span>
                    SUBMISSION OVERDUE
                </div>
                <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px; line-height: 1.4;">
                    Formal submission is closed. You must file an appeal to request a late opening.
                </p>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 15px; margin-bottom: 16px; width: 100%;">
                    <div style="font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 2px;">Submitting To:</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: #ffffff;">${insName}</div>
                </div>
                <button style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: #ef4444; border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 0.95rem; cursor: pointer; white-space: nowrap; transition: transform 0.2s ease, box-shadow 0.2s ease;" 
                        onclick="window.triggerAppeal('${deadline.title.replace(/'/g, "\\'")}', '${insId}', '${insName.replace(/'/g, "\\'")}')">
                    <span class="material-symbols-outlined" style="font-size: 1.2rem; flex-shrink: 0;">mail</span> 
                    <span>Send Appeal Request</span>
                </button>
            </div>`;
            
        modalBox.insertAdjacentHTML('beforeend', footerHTML);
    }

    modal.classList.add('active');
};

window.triggerAppeal = (title, id, name) => {
    document.getElementById('deadlineModalOverlay').classList.remove('active');
    setTimeout(() => {
        if (typeof window.openDirectMessage === 'function') {
            window.openDirectMessage(id, name);
        }
    }, 300);
};

document.getElementById('dlModalClose')?.addEventListener('click', () => {
    document.getElementById('deadlineModalOverlay').classList.remove('active');
});