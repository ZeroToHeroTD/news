// =============================================================================
// social.js — Social Directory & Realtime Presence Engine (Premium SaaS)
// =============================================================================

import { supabase as supabaseClient } from './config.js';
import { escapeAttr } from './utils.js';

// Global state to track online users across renders
let onlineUsers = new Set();

// ==========================================
// 1. COMPONENT RENDERERS
// ==========================================

/**
 * Renders an individual member card with identity and presence indicators.
 */
const renderMemberCard = (profile, currentUserId, delay) => {
    const isMe = profile.id === currentUserId;
    const isStaff = ['teacher', 'admin', 'instructor'].includes(profile.role?.toLowerCase());
    
    // 👉 Check the real-time Set to see if they are online
    const isOnline = onlineUsers.has(profile.id) || isMe;
    
    const avatar = profile.avatar_url || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'U')}&background=0062ff&color=fff&bold=true`;
    
    const roleClass = isStaff ? 'role-instructor' : 'role-student';
    const roleLabel = isStaff ? 'Instructor' : 'Student';

    return `
        <div class="social-card-minimal" data-uid="${profile.id}" style="animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards ${delay}s; opacity: 0;">
            <div style="display: flex; gap: 16px; align-items: center;">
                <div class="social-avatar-wrapper" style="position: relative;">
                    <img src="${avatar}" alt="${escapeAttr(profile.full_name)}" />
                    <div id="status-dot-${profile.id}" class="status-dot ${isOnline ? 'online' : 'offline'}" style="position: absolute; bottom: -2px; right: -2px; border: 2px solid var(--card-bg);"></div>
                </div>

                <div class="member-info-column">
                    <span class="social-role-badge ${roleClass}">
                        ${roleLabel} ${isMe ? '<span style="opacity:0.7;">(YOU)</span>' : ''}
                    </span>
                    <span class="member-name">${profile.full_name || 'Anonymous'}</span>
                    
                    <div class="status-container">
                        <span id="status-text-${profile.id}" class="online-status-text ${isOnline ? 'active' : 'offline'}">
                            ${isOnline ? 'Active Now' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 12px; margin-top: auto;">
                <button class="msg-btn-minimal" style="flex: 1;" onclick="window.copyUserId('${profile.id}', this)">
                    <span class="material-symbols-outlined" style="font-size: 1.1rem;">content_copy</span> ID
                </button>
                ${!isMe ? `
                    <button class="msg-btn-minimal msg-btn-primary" style="flex: 1;"
                            onclick="window.openDirectMessage('${profile.id}', '${escapeAttr(profile.full_name || 'Unknown User')}')">
                        <span class="material-symbols-outlined" style="font-size: 1.1rem;">chat_bubble</span> Message
                    </button>
                ` : ''}
            </div>
        </div>`;
};

// ==========================================
// 2. DIRECTORY ENGINE
// ==========================================

export async function loadSocialDirectory(currentUserId) {
    const container = document.getElementById('socialDirectoryContainer');
    if (!container) return;

    try {
        const { data: profiles, error } = await supabaseClient.from('profiles').select('*');
        if (error) throw error;

        const sections = {};
        profiles.forEach(p => {
            const sec = (p.section || 'General').toUpperCase().trim();
            if (!sections[sec]) sections[sec] = { staff: [], students: [], count: 0 };
            
            const isStaff = ['teacher', 'admin', 'instructor'].includes(p.role?.toLowerCase());
            isStaff ? sections[sec].staff.push(p) : sections[sec].students.push(p);
            sections[sec].count++;
        });

        let html = '';
        let globalDelay = 0;

        Object.entries(sections).sort().forEach(([secName, group]) => {
            html += `
                <div class="social-section-block directory-section">
                    <h3 data-count="${group.count}">
                        <span class="material-symbols-outlined" style="color: var(--primary);">groups</span>
                        ${secName}
                    </h3>`;
            
            if (group.staff.length > 0) {
                html += `<h4>Faculty</h4>
                         <div class="social-grid">${group.staff.map(p => {
                             globalDelay += 0.05;
                             return renderMemberCard(p, currentUserId, globalDelay);
                         }).join('')}</div>`;
            }

            if (group.students.length > 0) {
                html += `<h4>Classmates</h4>
                         <div class="social-grid">${group.students.map(p => {
                             globalDelay += 0.05;
                             return renderMemberCard(p, currentUserId, globalDelay);
                         }).join('')}</div>`;
            }

            html += `</div>`;
        });

        container.innerHTML = html || '<p>No members found.</p>';
        setupDirectorySearch();

    } catch (err) {
        console.error("Directory Error:", err.message);
    }
}

// ==========================================
// 3. SEARCH & PRESENCE LOGIC
// ==========================================

function setupDirectorySearch() {
    const searchInput = document.getElementById('socialSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', e => {
        const term = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.social-card-minimal').forEach(card => {
            const name = card.querySelector('.member-name')?.textContent.toLowerCase() || '';
            const uid = card.getAttribute('data-uid')?.toLowerCase() || '';
            const matches = name.includes(term) || uid.includes(term);
            card.style.display = matches ? 'flex' : 'none';
        });

        document.querySelectorAll('.directory-section').forEach(section => {
            const visible = section.querySelectorAll('.social-card-minimal:not([style*="display: none"])');
            section.style.display = visible.length > 0 ? 'block' : 'none';
        });
    });
}

/**
 * Initializes real-time presence and updates the UI markers.
 */
export function initializePresence(currentUserId) {
    const room = supabaseClient.channel('campus_presence');

    room.on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        
        // 👉 Update the global Set of IDs
        onlineUsers = new Set(Object.keys(state));

        // 👉 Loop through every visible card and flip the switch
        document.querySelectorAll('.social-card-minimal').forEach(card => {
            const uid = card.getAttribute('data-uid');
            const dot = document.getElementById(`status-dot-${uid}`);
            const text = document.getElementById(`status-text-${uid}`);
            const isOnline = onlineUsers.has(uid);

            if (dot) {
                dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
            }
            if (text) {
                text.textContent = isOnline ? 'Active Now' : 'Offline';
                text.className = `online-status-text ${isOnline ? 'active' : 'offline'}`;
            }

            // Sync your own topbar avatar dot if this card is "YOU"
            if (uid === currentUserId) {
                const topbarDot = document.getElementById('myCurrentStatusDot');
                if (topbarDot) {
                    topbarDot.classList.toggle('online', isOnline);
                }
            }
        });
    })
    .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
            await room.track({
                user_id: currentUserId,
                online_at: new Date().toISOString(),
            });
        }
    });
}

// ==========================================
// 4. WINDOW HELPERS
// ==========================================

window.copyUserId = async function (id, btn) {
    try {
        await navigator.clipboard.writeText(id);
        const original = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.1rem;">check_circle</span> Copied!`;
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = original;
        }, 2000);
    } catch (err) { console.error('Copy failed', err); }
};

window.openDirectMessage = function(partnerId, partnerName) {
    if (typeof window.openComposeModal === 'function') {
        window.openComposeModal();
        setTimeout(() => {
            const recipientInput = document.getElementById('composeRecipientId');
            if (recipientInput) {
                recipientInput.value = partnerName;
                window.secretReceiverId = partnerId;
            }
        }, 50);
    } else {
        if (window.showToast) window.showToast('Messaging module is offline.', 'error');
    }
};