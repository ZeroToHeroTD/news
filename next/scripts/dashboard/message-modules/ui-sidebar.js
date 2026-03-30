
import { state } from './store.js';
import { getTimeAgo } from '../utils.js';
import { escapeAttr, truncate } from './helpers.js';
import { openAnnouncementsMobile } from './messenger-mobile.js';

export function renderSidebar() {
    if (state.currentTab === 'personal') renderConversationList();
    else renderAnnouncementList();
}

export function renderConversationList(filterTerm = '') {
    const list = document.getElementById('conversationList');
    if (!list) return;

    const convMap = {};
    state.allMessages
        .filter(m => m._type === 'personal')
        .forEach(m => {
            const partnerId = m.sender_id === state.currentUserId ? m.receiver_id : m.sender_id;
            if (!partnerId) return;
            const partnerProfile = state.profilesMap[partnerId] || {};
            const partnerName = partnerProfile.full_name || 'Unknown User';
            if (!convMap[partnerId]) {
                convMap[partnerId] = { id: partnerId, name: partnerName, profile: partnerProfile, lastMsg: m, unread: 0 };
            }
            if (!m.is_read && m.sender_id !== state.currentUserId) convMap[partnerId].unread++;
        });

    let convs = Object.values(convMap).sort(
        (a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)
    );

    if (filterTerm) {
        convs = convs.filter(c => c.name.toLowerCase().includes(filterTerm.toLowerCase()));
    }

    if (convs.length === 0) {
        list.innerHTML = `
          <div style="padding:24px 12px;text-align:center;color:rgba(232,236,255,0.28);">
            <span class="material-symbols-outlined" style="font-size:36px;display:block;margin-bottom:8px;">
              ${filterTerm ? 'search_off' : 'forum'}
            </span>
            <div style="font-size:0.8rem;font-weight:600;">
              ${filterTerm ? `No results for "${filterTerm}"` : 'No conversations yet'}
            </div>
          </div>`;
        return;
    }

    list.innerHTML = convs.map(c => {
        const isActive  = state.selectedConversationId === c.id;
        const isTyping  = state.typingTimers[c.id] !== undefined;
        const avatarUrl = c.profile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=6366f1&color=fff&bold=true&rounded=false`;
        const previewText = isTyping ? 'typing...' : truncate(c.lastMsg.content, 28);
        const timeLabel   = getTimeAgo(c.lastMsg.created_at);

        return `
          <div class="conv-item ${isActive ? 'active' : ''}" onclick="window.openConversation('${c.id}')">
            <div class="conv-avatar-wrap">
              <img src="${avatarUrl}" class="conv-avatar" alt="${escapeAttr(c.name)}" onerror="this.style.display='none'">
              <div class="conv-status-dot ${isTyping ? 'typing' : 'offline'}"></div>
            </div>
            <div class="conv-details">
              <div class="conv-row">
                <span class="conv-name">${c.name}</span>
                <span class="conv-time">${timeLabel}</span>
              </div>
              <div class="conv-row">
                <span class="conv-preview ${isTyping ? 'is-typing' : ''}">${isTyping ? '● typing...' : previewText}</span>
                ${c.unread > 0 ? `<span class="conv-unread-badge">${c.unread}</span>` : ''}
              </div>
            </div>
          </div>`;
    }).join('');
}

export function renderAnnouncementList() {
    const panel = document.getElementById('announcementsPanel');
    if (!panel) return;

    const anns = state.allMessages.filter(m => m._type === 'announcement');

    if (anns.length === 0) {
        panel.innerHTML = `
          <div style="padding:40px 20px;text-align:center;color:rgba(232,236,255,0.26);">
            <span class="material-symbols-outlined" style="font-size:36px;display:block;margin-bottom:10px;opacity:0.5;">campaign</span>
            <div style="font-size:0.8rem;font-weight:600;">No announcements yet</div>
          </div>`;
        return;
    }

    panel.innerHTML = anns.map(a => `
      <div class="ann-card ${!a.is_read ? 'unread' : ''}" onclick="window.viewAnnouncement('${a.id}')">
        <div class="ann-card-inner">
          <div class="ann-top">
            <div class="ann-icon-wrap">
              <span class="material-symbols-outlined">campaign</span>
            </div>
            <span class="ann-title">${a.subject || 'Announcement'}</span>
            <span class="ann-badge">${!a.is_read ? 'NEW' : 'READ'}</span>
          </div>
          <div class="ann-body">${a.content}</div>
          <div class="ann-footer">
            <span class="ann-from">
              <span class="material-symbols-outlined">admin_panel_settings</span>
              Administration
            </span>
            <span class="ann-date">${getTimeAgo(a.created_at)}</span>
          </div>
        </div>
      </div>`).join('');
}

export function updateUnreadCount() {
    const personalUnread = state.allMessages.filter(m => m._type === 'personal'      && !m.is_read && m.sender_id !== state.currentUserId).length;
    const announceUnread = state.allMessages.filter(m => m._type === 'announcement'  && !m.is_read).length;
    const total = personalUnread + announceUnread;

    const pBadge = document.getElementById('personalBadge');
    const aBadge = document.getElementById('announceBadge');
    if (pBadge) { pBadge.textContent = personalUnread || ''; pBadge.style.display = personalUnread > 0 ? 'inline-flex' : 'none'; }
    if (aBadge) { aBadge.textContent = announceUnread || ''; aBadge.style.display = announceUnread > 0 ? 'inline-flex' : 'none'; }

    const dot = document.getElementById('msg-count-dot');
    if (dot) {
        dot.style.display = total > 0 ? 'flex' : 'none';
        if (total > 0) dot.textContent = total > 9 ? '9+' : total;
    }
}

export function switchMsgTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.sidebar-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));

    const chatPanel = document.getElementById('msgChatPanel');
    const annPanel  = document.getElementById('msgAnnPanel');

    if (tab === 'personal') {
        chatPanel?.classList.remove('hidden');
        annPanel?.classList.add('hidden');
        renderConversationList();
    } else {
        chatPanel?.classList.add('hidden');
        annPanel?.classList.remove('hidden');
        renderAnnouncementList();
        // Slide to announcements panel on mobile
        openAnnouncementsMobile();
    }
}

export async function viewAnnouncement(id) {
    const msg = state.allMessages.find(m => String(m.id) === String(id));
    if (!msg) return;

    if (!msg.is_read) {
        msg.is_read = true;
        updateUnreadCount();
        renderSidebar();
        
        // 👉 THE FIX: Save the read state locally in the browser!
        const readAnns = JSON.parse(localStorage.getItem('readAnnouncements') || '[]');
        if (!readAnns.includes(id)) {
            readAnns.push(id);
            localStorage.setItem('readAnnouncements', JSON.stringify(readAnns));
        }
    }

    const overlay = document.getElementById('annViewOverlay');
    if (!overlay) return;

    const fields = {
        annViewTag:   'Announcement',
        annViewTitle: msg.subject || 'Notice',
        annViewFrom:  'Administration',
        annViewDate:  new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        annViewBody:  msg.content
    };

    Object.keys(fields).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = fields[key];
    });

    overlay.classList.add('active');
}