// =============================================================================
// deadlines.js — Deadlines Engine & Task Management (UPGRADED DYNAMIC EDITION)
// =============================================================================

import { supabaseClient } from './config.js';

// ==========================================
// 1. UI HELPER & FORMATTING (UPGRADED)
// ==========================================

const getUrgencyData = (dueDate, isSubmitted) => {
    const today = new Date();
    // Normalize dates to midnight for accurate day-counting
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isLate = !isSubmitted && diffDays < 0;
    const isSoon = !isSubmitted && diffDays >= 0 && diffDays <= 2;

    // --- DYNAMIC LABEL UPGRADE ---
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

// ==========================================
// 2. MAIN DATA LOADER
// ==========================================

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

        updateHero(containers.hero, pending);
        updateWidget(containers.widget, pending);
        updateFullPage(containers.main, deadlines);

    } catch (err) {
        console.error("Deadlines Engine Error:", err.message);
        Object.values(containers).forEach(c => { 
            if(c) c.innerHTML = `<p style="color: var(--accent-red); font-size: 0.85rem; padding: 10px;">Failed to sync task data.</p>`; 
        });
    }
}

// ==========================================
// 3. SUB-RENDERERS (UPGRADED FOR DYNAMIC FEEL)
// ==========================================

function updateHero(el, pending) {
    if (!el) return;
    el.textContent = pending.length > 0 ? pending[0].title : 'All caught up!';
}

function updateWidget(container, pending) {
    if (!container) return;
    if (pending.length === 0) {
        container.innerHTML = `
            <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); background: var(--input-bg); border-radius: 16px;">
                <span class="material-symbols-outlined" style="font-size: 2rem; opacity: 0.5; margin-bottom: 8px;">celebration</span>
                <p style="font-size: 0.85rem; font-weight: 600;">No pending tasks</p>
            </div>`;
        return;
    }

    container.innerHTML = pending.slice(0, 3).map(d => {
        const { isLate, label } = getUrgencyData(new Date(d.due_date), false);
        return `
            <div class="missing-output-item" style="display: flex; align-items: center; gap: 14px; cursor: pointer;" onclick='window.openDeadlineModal(${JSON.stringify(d).replace(/'/g, "&#39;")})'>
                <div class="missing-dot ${isLate ? '' : 'amber'}"></div>
                <div style="flex: 1; min-width: 0;">
                    <div class="missing-output-text" style="color: var(--text-main); font-weight: 700;">${d.title}</div>
                    <div class="missing-output-sub" style="color: ${isLate ? 'var(--accent-red)' : 'var(--text-muted)'}; font-weight: 600;">${label}</div>
                </div>
                <span class="material-symbols-outlined" style="color: var(--text-muted); font-size: 1.2rem;">chevron_right</span>
            </div>`;
    }).join('');
}

function updateFullPage(container, allDeadlines) {
    if (!container) return;
    if (!allDeadlines?.length) {
        container.innerHTML = `<div class="empty-state">No deadlines found.</div>`;
        return;
    }

    container.innerHTML = allDeadlines.map((d, idx) => {
        const isDone = ['submitted', 'done', 'graded'].includes(d.status?.toLowerCase());
        const { isLate, isSoon, label } = getUrgencyData(new Date(d.due_date), isDone);
        
        // --- CLASS UPGRADE ---
        // Maps strictly to your refactored CSS variants
        const cardClass = isLate ? 'deadline-late' : isSoon ? 'deadline-urgent' : '';
        const statusClass = `status-${(d.status || 'pending').toLowerCase()}`;
        
        // APPEAL UPGRADE: Change the action text if it's past submission
        const actionLabel = isLate ? 'FILE APPEAL' : 'VIEW DETAILS';

        return `
            <div class="deadline-item ${cardClass}" 
                 style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${idx * 0.05}s; opacity: 0;"
                 onclick='window.openDeadlineModal(${JSON.stringify(d).replace(/'/g, "&#39;")})'>
                
                <div class="deadline-icon">${getIcon(d.type)}</div>
                
                <div class="deadline-info">
                    <div class="deadline-top">
                        <h4>${d.title}</h4>
                        <span class="deadline-type-badge">${(d.type || 'Task').toUpperCase()}</span>
                    </div>
                    <p style="color: var(--text-muted); font-weight: 500;">${d.subject || 'General'}</p>
                    
                    <div class="deadline-bottom">
                        <div class="deadline-due ${isLate ? 'late' : isSoon ? 'soon' : ''}">
                            <span class="material-symbols-outlined">schedule</span>
                            <span style="letter-spacing: 0.02em;">${label}</span>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 12px;">
                             <span class="deadline-status-badge ${statusClass}">${d.status || 'Pending'}</span>
                             <div class="dl-action-trigger" style="font-size: 0.65rem; font-weight: 900; opacity: 0.8;">
                                ${actionLabel}
                             </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

// ==========================================
// 4. MODAL LOGIC
// ==========================================

window.openDeadlineModal = function(deadline) {
    const modal = document.getElementById('deadlineModalOverlay');
    if (!modal) return;
    
    const isDone = ['submitted', 'done', 'graded'].includes(deadline.status?.toLowerCase());
    const dueDate = new Date(deadline.due_date);
    const { isLate } = getUrgencyData(dueDate, isDone);

    document.getElementById('dlModalTitle').textContent   = deadline.title;
    document.getElementById('dlModalSubject').textContent = deadline.subject || '--';
    document.getElementById('dlModalType').textContent    = (deadline.type || 'Task').toUpperCase();
    document.getElementById('dlModalDue').textContent     = dueDate.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const statusEl = document.getElementById('dlModalStatus');
    statusEl.textContent = (deadline.status || 'Pending').toUpperCase();
    statusEl.className = `dl-status-value status-${(deadline.status || 'pending').toLowerCase()}`;

    // --- NOTES & DYNAMIC APPEAL UPGRADE ---
    let notesHTML = `<p style="margin: 0; color: var(--text-main); font-size: 0.95rem; line-height: 1.6;">${deadline.notes || 'No specific instructions provided.'}</p>`;
    
    // Inside window.openDeadlineModal in deadlines.js

if (isLate) {
    // 1. Get Instructor Data (Ensure these exist in your Supabase 'deadlines' table)
    const insName = deadline.instructor_name || 'Assigned Instructor';
    const insId   = deadline.instructor_id || 'UID-NOT-FOUND';

    notesHTML += `
        <div style="margin-top: 25px; padding: 24px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 16px; display: flex; flex-direction: column; align-items: center; text-align: center;">
            
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #f87171; font-weight: 800; font-size: 0.9rem; margin-bottom: 12px;">
                <span class="material-symbols-outlined" style="font-size: 1.6rem;">report</span>
                SUBMISSION OVERDUE
            </div>

            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 18px; line-height: 1.5; max-width: 280px;">
                Formal submission is closed. You must file an appeal to request a late opening.
            </p>

            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 15px; margin-bottom: 20px; width: 100%;">
                <div style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 4px;">Submitting To:</div>
                <div style="font-size: 0.9rem; font-weight: 800; color: #ffffff;">${insName}</div>
                <div style="font-size: 0.7rem; color: var(--primary); font-family: monospace; opacity: 0.8;">ID: ${insId}</div>
            </div>

            <button class="dl-action-trigger" 
                    style="width: 100%; justify-content: center; padding: 14px; background: #ef4444; border:none; color: white; box-shadow: none;" 
                    onclick="window.triggerAppeal('${deadline.title.replace(/'/g, "\\'")}', '${insId}', '${insName.replace(/'/g, "\\'")}')">
                <span class="material-symbols-outlined">mail</span> Send Appeal Request
            </button>
        </div>`;
}

    document.getElementById('dlModalNotes').innerHTML = notesHTML;
    modal.classList.add('active');
};

window.triggerAppeal = (title, id, name) => {
    // 1. Close the deadline details
    document.getElementById('deadlineModalOverlay').classList.remove('active');
    
    // 2. Open the Compose Modal after a short delay
    setTimeout(() => {
        if(window.openComposeToInstructor) {
            // Strictly passing: Instructor Name, Instructor ID, and Subject Hint
            window.openComposeToInstructor(name, id, `APPEAL: Late Submission - ${title}`);
        } else {
            console.error("Messaging Bridge (messages.js) not loaded.");
            if(window.showToast) window.showToast('Messaging system unavailable.', 'error');
        }
    }, 300);
};

// Close logic
document.getElementById('dlModalClose')?.addEventListener('click', () => {
    document.getElementById('deadlineModalOverlay').classList.remove('active');
});

document.getElementById('deadlineModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'deadlineModalOverlay') e.target.classList.remove('active');
});