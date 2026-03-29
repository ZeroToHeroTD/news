// =============================================================================
// messages.js — MESSENGER HUB ENGINE v2.1 (Fixed & Improved)
// Fixes: sidebar search, emoji picker positioning, attachment button, more menu
// =============================================================================

import { supabaseClient } from './config.js';
import { getTimeAgo } from './utils.js';

// ---------------------------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------------------------
let allProfiles = [];
let profilesMap = {};
let currentUserId = null;
let currentUserName = 'Me';
let allMessages = [];
let selectedConversationId = null;
let selectedConversationName = '';
let currentTab = 'personal';
let typingTimers = {};
let realtimeChannel = null;

// ---------------------------------------------------------------------------
// 1. BOOT
// ---------------------------------------------------------------------------
export async function loadMessages(userId) {
    currentUserId = userId;

    const { data: profiles } = await supabaseClient.from('profiles').select('*');
    if (profiles) {
        allProfiles = profiles;
        profiles.forEach(p => { profilesMap[p.id] = p; });
        if (profilesMap[userId]) currentUserName = profilesMap[userId].full_name;
    }

    await fetchAllMessages();
    renderSidebar();
    subscribeToRealtime();
    initializeAutocomplete();
    setupMessageActions();
    injectDynamicStyles();
}

async function fetchAllMessages() {
    const [personalRes, announceRes] = await Promise.all([
        supabaseClient
            .from('portal_messages')
            .select('*')
            .or(`recipient_id.eq.${currentUserId},sender_id.eq.${currentUserId}`),
        supabaseClient
            .from('portal_messages')
            .select('*')
            .is('recipient_id', null)
            .order('created_at', { ascending: false })
    ]);

    const personal = (personalRes.data || []).map(m => ({ ...m, _type: 'personal' }));
    const announce = (announceRes.data || []).map(m => ({ ...m, _type: 'announcement' }));

    allMessages = [...personal, ...announce].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    updateUnreadCount();
}

// ---------------------------------------------------------------------------
// 2. REAL-TIME SUBSCRIPTION
// ---------------------------------------------------------------------------
function subscribeToRealtime() {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

    realtimeChannel = supabaseClient
        .channel('portal_messages_hub')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages' }, handleIncomingMessage)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'portal_messages' }, handleMessageUpdate)
        .subscribe();
}

async function handleIncomingMessage(payload) {
    const msg = payload.new;
    const isPersonal = msg.recipient_id === currentUserId || msg.sender_id === currentUserId;
    const isAnnouncement = !msg.recipient_id;
    if (!isPersonal && !isAnnouncement) return;

    const exists = allMessages.find(m => String(m.id) === String(msg.id));
    if (exists) return;

    const recentOpt = allMessages.find(m =>
        m.id.toString().startsWith('opt_') &&
        m.sender_id === msg.sender_id &&
        m.content === msg.content
    );
    if (recentOpt) {
        const idx = allMessages.indexOf(recentOpt);
        allMessages[idx] = { ...msg, _type: 'personal' };
        const bubble = document.querySelector(`[data-id="${recentOpt.id}"]`);
        if (bubble) bubble.setAttribute('data-id', msg.id);
        return;
    }

    msg._type = isAnnouncement ? 'announcement' : 'personal';
    allMessages.unshift(msg);
    clearTypingIndicator(msg.sender_id);

    if (currentTab === 'personal' && selectedConversationId === msg.sender_id) {
        appendBubble(msg, false);
        markThreadAsRead(msg.sender_id);
    } else if (msg.sender_id !== currentUserId) {
        const senderProfile = profilesMap[msg.sender_id];
        const senderName = senderProfile ? senderProfile.full_name : 'Someone';
        showIncomingPing(senderName, msg.content);
    }

    renderSidebar();
    updateUnreadCount();
}

async function handleMessageUpdate(payload) {
    const idx = allMessages.findIndex(m => String(m.id) === String(payload.new.id));
    if (idx !== -1) allMessages[idx] = { ...allMessages[idx], ...payload.new };

    if (currentTab === 'personal' && selectedConversationId) {
        updateSeenReceipts();
    }
}

// ---------------------------------------------------------------------------
// 3. SIDEBAR RENDERING
// ---------------------------------------------------------------------------
function renderSidebar() {
    if (currentTab === 'personal') renderConversationList();
    else renderAnnouncementList();
}

function renderConversationList(filterTerm = '') {
    const list = document.getElementById('conversationList');
    if (!list) return;

    const convMap = {};
    allMessages
        .filter(m => m._type === 'personal')
        .forEach(m => {
            const partnerId = m.sender_id === currentUserId ? m.recipient_id : m.sender_id;
            if (!partnerId) return;
            const partnerProfile = profilesMap[partnerId] || {};
            const partnerName = partnerProfile.full_name || 'Unknown User';
            if (!convMap[partnerId]) {
                convMap[partnerId] = { id: partnerId, name: partnerName, profile: partnerProfile, lastMsg: m, unread: 0 };
            }
            if (!m.is_read && m.sender_id !== currentUserId) convMap[partnerId].unread++;
        });

    let convs = Object.values(convMap).sort(
        (a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)
    );

    // FIX: Apply search filter after building convMap
    if (filterTerm) {
        convs = convs.filter(c => c.name.toLowerCase().includes(filterTerm.toLowerCase()));
    }

    if (convs.length === 0) {
        list.innerHTML = `
          <div style="padding: 24px 12px; text-align:center; color: rgba(241,245,249,0.3);">
            <span class="material-symbols-outlined" style="font-size:36px; display:block; margin-bottom:8px;">${filterTerm ? 'search_off' : 'forum'}</span>
            <div style="font-size:0.8rem;">${filterTerm ? `No results for "${filterTerm}"` : 'No conversations yet'}</div>
          </div>`;
        return;
    }

    list.innerHTML = convs.map(c => {
        const isActive = selectedConversationId === c.id;
        const isTyping = typingTimers[c.id] !== undefined;
        const avatarUrl = c.profile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=6366f1&color=fff&bold=true&rounded=false`;
        const previewText = isTyping ? 'typing...' : truncate(c.lastMsg.content, 28);
        const timeLabel = getTimeAgo(c.lastMsg.created_at);

        return `
          <div class="conv-item ${isActive ? 'active' : ''}"
               onclick="window.openConversation('${c.id}')">
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

function renderAnnouncementList() {
    const panel = document.getElementById('announcementsPanel');
    if (!panel) return;

    const anns = allMessages.filter(m => m._type === 'announcement');

    if (anns.length === 0) {
        panel.innerHTML = `
          <div style="padding:40px; text-align:center; color:rgba(241,245,249,0.3);">
            <span class="material-symbols-outlined" style="font-size:40px; display:block; margin-bottom:10px;">campaign</span>
            <div style="font-size:0.85rem;">No announcements yet</div>
          </div>`;
        return;
    }

    panel.innerHTML = anns.map(a => `
      <div class="ann-card ${!a.is_read ? 'unread' : ''}" onclick="window.viewAnnouncement('${a.id}')">
        <div class="ann-top">
          <div class="ann-icon-wrap">
            <span class="material-symbols-outlined">campaign</span>
          </div>
          <div class="ann-title">${a.subject || 'Announcement'}</div>
          <div class="ann-badge">${!a.is_read ? 'NEW' : 'READ'}</div>
        </div>
        <div class="ann-body">${a.content}</div>
        <div class="ann-footer">
          <span class="ann-from">
            <span class="material-symbols-outlined">admin_panel_settings</span>
            Administration
          </span>
          <span class="ann-date">${getTimeAgo(a.created_at)}</span>
        </div>
      </div>`).join('');
}

// ---------------------------------------------------------------------------
// 4. CHAT THREAD
// ---------------------------------------------------------------------------
window.openConversation = (partnerId) => {
    selectedConversationId = partnerId;

    const partnerProfile = profilesMap[partnerId] || {};
    selectedConversationName = partnerProfile.full_name || 'Unknown User';

    const header = document.getElementById('chatPanelHeader');
    const emptyState = document.getElementById('chatEmptyState');
    const threadArea = document.getElementById('chatThreadArea');
    const inputArea = document.getElementById('chatInputArea');

    if (header) {
        header.classList.remove('hidden');
        const avatarUrl = partnerProfile.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversationName)}&background=6366f1&color=fff&bold=true`;

        const avatarEl = document.getElementById('chatHeaderAvatar');
        const nameEl = document.getElementById('chatHeaderName');

        if (avatarEl) avatarEl.src = avatarUrl;
        if (nameEl) nameEl.textContent = selectedConversationName;

        setHeaderStatus('offline', partnerProfile.role || 'Student');
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (threadArea) threadArea.classList.remove('hidden');
    if (inputArea) inputArea.classList.remove('hidden');

    renderThread(partnerId);
    markThreadAsRead(partnerId);
    renderSidebar();

    // FIX: Re-initialize action buttons after conversation panel is visible
    rebindChatActionButtons();

    // Focus input
    setTimeout(() => {
        const input = document.getElementById('chatMainInput');
        if (input) input.focus();
    }, 100);
};

function renderThread(partnerId) {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;

    const thread = allMessages
        .filter(m => m._type === 'personal' &&
            (m.sender_id === partnerId || m.recipient_id === partnerId) &&
            (m.sender_id === currentUserId || m.recipient_id === currentUserId))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (thread.length === 0) {
        area.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; color:rgba(241,245,249,0.3);">
            <span class="material-symbols-outlined" style="font-size:32px;">waving_hand</span>
            <span style="font-size:0.85rem;">Start the conversation!</span>
          </div>`;
        return;
    }

    let html = '';
    let lastDate = '';
    let lastSender = '';
    let groupOpen = false;

    thread.forEach((msg, i) => {
        const msgDate = new Date(msg.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        const isSent = msg.sender_id === currentUserId;
        const senderKey = `${msg.sender_id}-${isSent}`;
        const isLast = i === thread.length - 1;

        if (msgDate !== lastDate) {
            if (groupOpen) { html += '</div>'; groupOpen = false; }
            html += `<div class="date-divider">${msgDate}</div>`;
            lastDate = msgDate;
            lastSender = '';
        }

        if (senderKey !== lastSender) {
            if (groupOpen) { html += '</div>'; }
            html += `<div class="bubble-group ${isSent ? 'sent' : 'received'}" data-sender="${msg.sender_id}">`;
            const sProfile = profilesMap[msg.sender_id] || {};
            const sName = sProfile.full_name || selectedConversationName;
            if (!isSent) html += `<div class="bubble-sender-label">${sName}</div>`;
            groupOpen = true;
            lastSender = senderKey;
        }

        const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLastSent = isSent && isLast;

        html += `
          <div class="chat-bubble ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">
            ${escapeHtml(msg.content)}
          </div>
          ${isLastSent ? `
            <div class="bubble-time-row">
              <span class="bubble-time">${timeStr}</span>
              <span class="bubble-seen">
                <span class="material-symbols-outlined" title="${msg.is_read ? 'Seen' : 'Delivered'}">${msg.is_read ? 'done_all' : 'check'}</span>
              </span>
            </div>` : `<div class="bubble-time-row"><span class="bubble-time">${timeStr}</span></div>`}`;
    });

    if (groupOpen) html += '</div>';
    area.innerHTML = html;
    area.scrollTop = area.scrollHeight;
}

function appendBubble(msg, scroll = true) {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;

    const isSent = msg.sender_id === currentUserId;
    const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const wrap = document.createElement('div');
    wrap.className = `bubble-group ${isSent ? 'sent' : 'received'}`;
    wrap.innerHTML = `
      <div class="chat-bubble ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">${escapeHtml(msg.content)}</div>
      <div class="bubble-time-row">
        <span class="bubble-time">${timeStr}</span>
        ${isSent ? `<span class="bubble-seen"><span class="material-symbols-outlined">check</span></span>` : ''}
      </div>`;

    area.appendChild(wrap);
    if (scroll) area.scrollTop = area.scrollHeight;
}

function updateSeenReceipts() {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;
    const sentBubbles = area.querySelectorAll('.bubble-group.sent');
    if (!sentBubbles.length) return;
    const lastGroup = sentBubbles[sentBubbles.length - 1];
    const seenIcon = lastGroup.querySelector('.bubble-seen .material-symbols-outlined');
    if (seenIcon) seenIcon.textContent = 'done_all';
}

async function markThreadAsRead(senderId) {
    await supabaseClient
        .from('portal_messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('recipient_id', currentUserId)
        .eq('is_read', false);

    allMessages.forEach(m => {
        if (m.sender_id === senderId && m.recipient_id === currentUserId) m.is_read = true;
    });

    updateUnreadCount();
}

// ---------------------------------------------------------------------------
// 5. TYPING INDICATOR
// ---------------------------------------------------------------------------
window.simulateTyping = (senderId, senderName) => {
    if (senderId === currentUserId) return;

    if (typingTimers[senderId]) clearTimeout(typingTimers[senderId]);

    if (selectedConversationId === senderId && !document.getElementById('typingBubble')) {
        showTypingBubble();
    }

    typingTimers[senderId] = setTimeout(() => {
        clearTypingIndicator(senderId);
    }, 3000);

    renderSidebar();
};

function clearTypingIndicator(senderId) {
    delete typingTimers[senderId];
    removeTypingBubble();
    renderSidebar();
}

function showTypingBubble() {
    removeTypingBubble();
    const area = document.getElementById('chatThreadArea');
    if (!area) return;

    const bubble = document.createElement('div');
    bubble.id = 'typingBubble';
    bubble.className = 'bubble-group received';
    bubble.innerHTML = `
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>`;

    area.appendChild(bubble);
    area.scrollTop = area.scrollHeight;
    setHeaderStatus('typing-status', `${selectedConversationName} is typing...`);
}

function removeTypingBubble() {
    document.getElementById('typingBubble')?.remove();
    if (selectedConversationId) {
        const p = profilesMap[selectedConversationId] || {};
        setHeaderStatus('offline', p.role || 'Student');
    }
}

function setHeaderStatus(cssClass, text) {
    const statusEl = document.getElementById('chatHeaderStatus');
    if (!statusEl) return;
    statusEl.className = `chat-header-status ${cssClass}`;
    const dotHtml = cssClass !== 'offline' ? `<div class="header-status-dot"></div>` : '';
    statusEl.innerHTML = `${dotHtml}${text}`;
}

// ---------------------------------------------------------------------------
// 6. SEND MESSAGE
// ---------------------------------------------------------------------------
window.sendChatMessage = async function () {
    const input = document.getElementById('chatMainInput');
    if (!input || !selectedConversationId) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoResizeInput(input);

    const optimisticMsg = {
        id: `opt_${Date.now()}`,
        sender_id: currentUserId,
        sender_name: currentUserName,
        recipient_id: selectedConversationId,
        content: text,
        is_read: false,
        created_at: new Date().toISOString(),
        _type: 'personal'
    };

    allMessages.unshift(optimisticMsg);
    appendBubble(optimisticMsg);
    renderSidebar();

    try {
        const { data, error } = await supabaseClient.from('portal_messages').insert([{
            sender_id: currentUserId,
            sender_name: currentUserName,
            recipient_id: selectedConversationId,
            subject: 'Direct Message',
            content: text,
            is_read: false
        }]).select().single();

        if (error) throw error;

        const idx = allMessages.findIndex(m => m.id === optimisticMsg.id);
        if (idx !== -1) allMessages[idx] = { ...data, _type: 'personal' };

        setTimeout(() => updateSeenReceipts(), 1500);

    } catch (err) {
        console.error('Send failed:', err.message);
        const failBubble = document.querySelector(`[data-id="${optimisticMsg.id}"]`);
        if (failBubble) {
            failBubble.style.opacity = '0.5';
            failBubble.title = 'Failed to send';
        }
        showToast('Failed to send message', 'error');
    }
};

function autoResizeInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ---------------------------------------------------------------------------
// 7. TAB SWITCHING
// ---------------------------------------------------------------------------
window.switchMsgTab = (tab) => {
    currentTab = tab;

    document.querySelectorAll('.sidebar-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    const chatPanel = document.getElementById('msgChatPanel');
    const annPanel = document.getElementById('msgAnnPanel');

    if (tab === 'personal') {
        chatPanel?.classList.remove('hidden');
        annPanel?.classList.add('hidden');
        renderConversationList();
    } else {
        chatPanel?.classList.add('hidden');
        annPanel?.classList.remove('hidden');
        renderAnnouncementList();
    }
};

// ---------------------------------------------------------------------------
// 8. ANNOUNCEMENT VIEW
// ---------------------------------------------------------------------------
window.viewAnnouncement = async (id) => {
    const msg = allMessages.find(m => String(m.id) === String(id));
    if (!msg) return;

    if (!msg.is_read) {
        msg.is_read = true;
        updateUnreadCount();
        renderSidebar();
        supabaseClient.from('portal_messages').update({ is_read: true }).eq('id', id)
            .then(({ error }) => { if (error) console.error('DB Sync Error:', error.message); });
    }

    const overlay = document.getElementById('annViewOverlay');
    if (!overlay) { showToast('Announcement modal missing from HTML!', 'error'); return; }

    const fields = {
        'annViewTag': 'Announcement',
        'annViewTitle': msg.subject || 'Notice',
        'annViewFrom': 'Administration',
        'annViewDate': new Date(msg.created_at).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        }),
        'annViewBody': msg.content
    };

    Object.keys(fields).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = fields[key];
    });

    overlay.classList.add('active');
};

// ---------------------------------------------------------------------------
// 9. COMPOSE NEW MESSAGE
// ---------------------------------------------------------------------------
window.openComposeModal = () => {
    document.getElementById('composeModalOverlay')?.classList.add('active');
};

window.closeComposeModal = () => {
    document.getElementById('composeModalOverlay')?.classList.remove('active');
    ['composeRecipientId', 'composeSubject', 'composeContent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    window.secretReceiverId = null;
};

window.sendNewMessage = async () => {
    const subjectInput = document.getElementById('composeSubject');
    const contentInput = document.getElementById('composeContent');

    if (!window.secretReceiverId || !contentInput?.value.trim()) {
        showToast('Please select a recipient and write a message.', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient.from('portal_messages').insert([{
            sender_id: currentUserId,
            sender_name: currentUserName,
            recipient_id: window.secretReceiverId,
            subject: subjectInput?.value.trim() || 'Direct Message',
            content: contentInput.value.trim(),
            is_read: false
        }]);

        if (error) throw error;

        showToast('Message sent!', 'success');
        window.closeComposeModal();
        await fetchAllMessages();
        renderSidebar();

    } catch (err) {
        console.error('Compose failed:', err.message);
        showToast('Failed to send message', 'error');
    }
};

// ---------------------------------------------------------------------------
// 10. UNREAD COUNTER
// ---------------------------------------------------------------------------
export function updateUnreadCount() {
    const personalUnread = allMessages.filter(m => m._type === 'personal' && !m.is_read && m.sender_id !== currentUserId).length;
    const announceUnread = allMessages.filter(m => m._type === 'announcement' && !m.is_read).length;
    const total = personalUnread + announceUnread;

    const pBadge = document.getElementById('personalBadge');
    const aBadge = document.getElementById('announceBadge');

    if (pBadge) {
        pBadge.textContent = personalUnread > 0 ? personalUnread : '';
        pBadge.style.display = personalUnread > 0 ? 'inline-flex' : 'none';
    }
    if (aBadge) {
        aBadge.textContent = announceUnread > 0 ? announceUnread : '';
        aBadge.style.display = announceUnread > 0 ? 'inline-flex' : 'none';
    }

    const dot = document.getElementById('msg-count-dot');
    if (dot) {
        if (total > 0) {
            dot.style.display = 'flex';
            dot.textContent = total > 9 ? '9+' : total;
        } else {
            dot.style.display = 'none';
        }
    }
}

// ---------------------------------------------------------------------------
// 11. AUTOCOMPLETE
// ---------------------------------------------------------------------------
export async function initializeAutocomplete() {
    const input = document.getElementById('composeRecipientId');
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!input || !dropdown) return;

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term.length < 1) return dropdown.classList.remove('show');

        const matches = allProfiles
            .filter(p => p.id !== currentUserId && p.full_name?.toLowerCase().includes(term))
            .slice(0, 5);

        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => {
                const av = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name)}&background=6366f1&color=fff`;
                return `
                  <div class="ac-item" onclick="window.selectRecipient('${m.id}', '${escapeAttr(m.full_name)}')">
                    <img src="${av}" class="ac-img" alt="${escapeAttr(m.full_name)}">
                    <div class="ac-text-col">
                      <span class="ac-name">${m.full_name}</span>
                      <span class="ac-role">${m.role || 'Student'}</span>
                    </div>
                  </div>`;
            }).join('');
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
}

window.selectRecipient = (id, name) => {
    const recipientInput = document.getElementById('composeRecipientId');
    if (recipientInput) recipientInput.value = name;
    window.secretReceiverId = id;
    document.getElementById('autocompleteDropdown')?.classList.remove('show');
};

// ---------------------------------------------------------------------------
// 12. INJECT CRITICAL STYLES
// ---------------------------------------------------------------------------
function injectDynamicStyles() {
    if (document.getElementById('msg-dynamic-styles')) return;

    const style = document.createElement('style');
    style.id = 'msg-dynamic-styles';
    style.innerHTML = `
        /* ── Emoji Picker ── */
        #emojiPickerPortal {
            position: fixed;
            background: var(--card-bg, #1e293b);
            border: 1px solid var(--border-color, #334155);
            border-radius: 16px;
            padding: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            width: 272px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.5);
            z-index: 99999;
            opacity: 0;
            visibility: hidden;
            transform: scale(0.92) translateY(8px);
            transform-origin: bottom left;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #emojiPickerPortal.show {
            opacity: 1;
            visibility: visible;
            transform: scale(1) translateY(0);
        }
        .emoji-item {
            font-size: 1.4rem;
            cursor: pointer;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            transition: transform 0.12s ease, background 0.12s ease;
            user-select: none;
        }
        .emoji-item:hover {
            background: rgba(99,102,241,0.15);
            transform: scale(1.25);
        }

        /* ── More Options Menu ── */
        #chatOptionsMenuPortal {
            position: fixed;
            background: var(--card-bg, #1e293b);
            border: 1px solid var(--border-color, #334155);
            border-radius: 14px;
            padding: 6px;
            min-width: 210px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.5);
            z-index: 99999;
            opacity: 0;
            visibility: hidden;
            transform: scale(0.92) translateY(-8px);
            transform-origin: top right;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        #chatOptionsMenuPortal.show {
            opacity: 1;
            visibility: visible;
            transform: scale(1) translateY(0);
        }
        .chat-menu-item {
            padding: 10px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-main, #f1f5f9);
            cursor: pointer;
            border-radius: 10px;
            transition: background 0.15s ease;
            font-family: 'DM Sans', sans-serif;
        }
        .chat-menu-item:hover { background: var(--input-bg, #0f172a); }
        .chat-menu-item.danger { color: #ef4444; }
        .chat-menu-item.danger:hover { background: rgba(239,68,68,0.1); }
        .chat-menu-item .material-symbols-outlined { font-size: 18px; }

        /* ── In-Chat Search Bar ── */
        #chatLocalSearchBar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: var(--card-bg, #1e293b);
            border-bottom: 1px solid var(--border-color, #334155);
            flex-shrink: 0;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.25s ease, opacity 0.2s ease, padding 0.2s ease;
        }
        #chatLocalSearchBar.active {
            max-height: 60px;
            opacity: 1;
        }
        #chatLocalSearchInput {
            flex: 1;
            background: var(--input-bg, #0f172a);
            border: 1px solid var(--border-color, #334155);
            border-radius: 8px;
            padding: 8px 12px;
            color: var(--text-main, #fff);
            font-family: 'DM Sans', sans-serif;
            font-size: 0.85rem;
            outline: none;
            transition: border-color 0.2s;
        }
        #chatLocalSearchInput:focus { border-color: var(--primary, #6366f1); }
        #closeLocalSearch {
            background: none;
            border: none;
            color: var(--text-muted, #94a3b8);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            border-radius: 8px;
            transition: all 0.2s;
        }
        #closeLocalSearch:hover { background: rgba(255,255,255,0.05); color: #ef4444; }

        /* ── Highlight matched bubbles ── */
        .chat-bubble.search-match {
            outline: 2px solid var(--primary, #6366f1);
            box-shadow: 0 0 16px rgba(99,102,241,0.4);
        }

        /* ── File attachment preview in bubble ── */
        .attachment-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 6px 10px;
            font-size: 0.78rem;
            font-weight: 600;
            margin-top: 4px;
        }
        .attachment-chip .material-symbols-outlined { font-size: 16px; }
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// 13. SETUP CORE EVENT LISTENERS (static elements only)
// ---------------------------------------------------------------------------
export function setupMessageActions() {
    const chatInput = document.getElementById('chatMainInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendChatMessage();
            }
        });
        chatInput.addEventListener('input', () => autoResizeInput(chatInput));
    }

    // Close all popovers on outside click
    document.addEventListener('click', closeAllPopovers);

    // Modal buttons
    document.getElementById('composeNewBtn')?.addEventListener('click', window.openComposeModal);
    document.getElementById('composeCloseBtn')?.addEventListener('click', window.closeComposeModal);
    document.getElementById('composeCancelBtn')?.addEventListener('click', window.closeComposeModal);
    document.getElementById('composeSendBtn')?.addEventListener('click', window.sendNewMessage);
    document.getElementById('annViewClose')?.addEventListener('click', () => {
        document.getElementById('annViewOverlay')?.classList.remove('active');
    });

    ['composeModalOverlay', 'annViewOverlay'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('active');
        });
    });

    // FIX: Sidebar search — directly calls renderConversationList with filter
    const sidebarSearch = document.querySelector('.sidebar-search-input');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', (e) => {
            renderConversationList(e.target.value.trim());
        });
    }
}

// ---------------------------------------------------------------------------
// 14. REBIND CHAT ACTION BUTTONS (called each time a convo is opened)
// ---------------------------------------------------------------------------
function rebindChatActionButtons() {
    // ── Emoji Button ──────────────────────────────────────────────────────────
    const emojiBtn = document.querySelector('.input-emoji-btn[title="Emoji"]');
    if (emojiBtn && !emojiBtn._emojiBound) {
        emojiBtn._emojiBound = true;

        // Build portal picker once
        let picker = document.getElementById('emojiPickerPortal');
        if (!picker) {
            picker = document.createElement('div');
            picker.id = 'emojiPickerPortal';

            const EMOJIS = [
                '😀','😂','🥰','😎','😭','🥺','🤔','😅','🤩','🥳',
                '👍','👎','🙏','💪','🤝','👀','💀','🔥','❤️','💔',
                '🎉','✨','💯','🚀','⭐','🎊','🎁','🏆','💡','📎'
            ];
            picker.innerHTML = EMOJIS.map(em => `<span class="emoji-item" data-emoji="${em}">${em}</span>`).join('');
            document.body.appendChild(picker);

            picker.addEventListener('click', (e) => {
                const item = e.target.closest('.emoji-item');
                if (!item) return;
                const chatInput = document.getElementById('chatMainInput');
                if (chatInput) {
                    const pos = chatInput.selectionStart;
                    const val = chatInput.value;
                    chatInput.value = val.slice(0, pos) + item.dataset.emoji + val.slice(pos);
                    chatInput.focus();
                    chatInput.setSelectionRange(pos + 2, pos + 2);
                    autoResizeInput(chatInput);
                }
                picker.classList.remove('show');
                e.stopPropagation();
            });
        }

        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllPopovers(null, picker); // close others, keep this one

            const rect = emojiBtn.getBoundingClientRect();
            picker.style.left = `${rect.left}px`;
            picker.style.bottom = `${window.innerHeight - rect.top + 8}px`;
            picker.style.top = 'auto';
            picker.classList.toggle('show');
        });
    }

    // ── Attachment Button ─────────────────────────────────────────────────────
    const attachBtn = document.querySelector('.input-emoji-btn[title="Attach file"]');
    if (attachBtn && !attachBtn._attachBound) {
        attachBtn._attachBound = true;

        attachBtn.addEventListener('click', () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const chatInput = document.getElementById('chatMainInput');
                if (chatInput) {
                    // Insert attachment chip text
                    chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') +
                        `[📎 ${file.name}]`;
                    chatInput.focus();
                    autoResizeInput(chatInput);
                }
                showToast(`"${truncate(file.name, 30)}" attached — press Send`, 'info');
            };
            fileInput.click();
        });
    }

    // ── Search Button ─────────────────────────────────────────────────────────
    const searchBtn = document.querySelector('.chat-action-btn[title="Search in conversation"]');
    if (searchBtn && !searchBtn._searchBound) {
        searchBtn._searchBound = true;

        // Create search bar inside the chat panel header (as a sibling below it)
        let searchBar = document.getElementById('chatLocalSearchBar');
        if (!searchBar) {
            searchBar = document.createElement('div');
            searchBar.id = 'chatLocalSearchBar';
            searchBar.innerHTML = `
                <span class="material-symbols-outlined" style="color:var(--text-muted,#94a3b8);font-size:18px;">search</span>
                <input type="text" id="chatLocalSearchInput" placeholder="Find in this conversation...">
                <button id="closeLocalSearch" title="Close">
                    <span class="material-symbols-outlined">close</span>
                </button>`;

            // Insert it right after chatPanelHeader
            const header = document.getElementById('chatPanelHeader');
            if (header && header.parentNode) {
                header.parentNode.insertBefore(searchBar, header.nextSibling);
            }

            document.getElementById('closeLocalSearch').onclick = () => {
                searchBar.classList.remove('active');
                document.getElementById('chatLocalSearchInput').value = '';
                clearSearchHighlights();
            };

            document.getElementById('chatLocalSearchInput').addEventListener('input', (ev) => {
                const term = ev.target.value.toLowerCase().trim();
                const bubbles = document.querySelectorAll('#chatThreadArea .chat-bubble');
                bubbles.forEach(b => {
                    if (term && b.textContent.toLowerCase().includes(term)) {
                        b.classList.add('search-match');
                        b.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } else {
                        b.classList.remove('search-match');
                    }
                });
            });
        }

        searchBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            searchBar.classList.toggle('active');
            if (searchBar.classList.contains('active')) {
                document.getElementById('chatLocalSearchInput')?.focus();
            } else {
                clearSearchHighlights();
            }
        });
    }

    // ── More Options Button ───────────────────────────────────────────────────
    const moreBtn = document.querySelector('.chat-action-btn[title="More options"]');
    if (moreBtn && !moreBtn._moreBound) {
        moreBtn._moreBound = true;

        let menu = document.getElementById('chatOptionsMenuPortal');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'chatOptionsMenuPortal';
            menu.innerHTML = `
                <div class="chat-menu-item" id="optViewProfile">
                    <span class="material-symbols-outlined">person</span> View Profile
                </div>
                <div class="chat-menu-item" id="optMute">
                    <span class="material-symbols-outlined">notifications_off</span> Mute Notifications
                </div>
                <div class="chat-menu-item" id="optMarkRead">
                    <span class="material-symbols-outlined">mark_email_read</span> Mark All Read
                </div>
                <div class="chat-menu-item danger" id="optClearChat">
                    <span class="material-symbols-outlined">delete_sweep</span> Clear Chat
                </div>`;
            document.body.appendChild(menu);

            document.getElementById('optViewProfile').onclick = () => {
                const p = profilesMap[selectedConversationId] || {};
                showToast(`Viewing profile of ${p.full_name || 'User'}`, 'info');
                menu.classList.remove('show');
            };
            document.getElementById('optMute').onclick = () => {
                showToast('Notifications muted for this conversation.', 'info');
                menu.classList.remove('show');
            };
            document.getElementById('optMarkRead').onclick = () => {
                if (selectedConversationId) {
                    markThreadAsRead(selectedConversationId);
                    showToast('Marked all messages as read.', 'success');
                }
                menu.classList.remove('show');
            };
            document.getElementById('optClearChat').onclick = () => {
                const area = document.getElementById('chatThreadArea');
                if (area) {
                    area.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:rgba(241,245,249,0.3);">
                            <span class="material-symbols-outlined" style="font-size:32px;">cleaning_services</span>
                            <span style="font-size:0.85rem;">Chat cleared locally.</span>
                        </div>`;
                }
                showToast('Chat cleared (local view only).', 'info');
                menu.classList.remove('show');
            };
        }

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeAllPopovers(null, menu);

            const rect = moreBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 8}px`;
            menu.style.right = `${window.innerWidth - rect.right}px`;
            menu.style.left = 'auto';
            menu.classList.toggle('show');
        });
    }
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
function closeAllPopovers(e, except = null) {
    const pickers = ['emojiPickerPortal', 'chatOptionsMenuPortal'];
    pickers.forEach(id => {
        const el = document.getElementById(id);
        if (el && el !== except) el.classList.remove('show');
    });
}

function clearSearchHighlights() {
    document.querySelectorAll('#chatThreadArea .chat-bubble.search-match').forEach(b => {
        b.classList.remove('search-match');
    });
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapeAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
    document.querySelector('.msg-toast')?.remove();

    const icons = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
    const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1', warning: '#f59e0b' };

    const toast = document.createElement('div');
    toast.className = 'msg-toast';
    toast.innerHTML = `
      <span class="material-symbols-outlined" style="color:${colors[type]};font-size:18px;">${icons[type] || 'info'}</span>
      ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showIncomingPing(name, content) {
    showToast(`💬 ${name}: ${truncate(content, 35)}`, 'info');
}