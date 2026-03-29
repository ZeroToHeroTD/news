import { supabaseClient } from '../config.js';
import { state } from './store.js';
import { escapeHtml, autoResizeInput, showToast } from './helpers.js';
import { renderSidebar, updateUnreadCount } from './ui-sidebar.js';
import { rebindChatActionButtons } from './ui-actions.js';
import { openConversationMobile } from './messenger-mobile.js';

// ── Open a conversation ───────────────────────────────────────────────────
// ── Open a conversation ───────────────────────────────────────────────────
// ── Open a conversation ───────────────────────────────────────────────────
export function openConversation(partnerId) {
    state.selectedConversationId = partnerId;
    const partnerProfile = state.profilesMap[partnerId] || {};
    state.selectedConversationName = partnerProfile.full_name || 'Unknown User';

    // Update header
    const header = document.getElementById('chatPanelHeader');
    if (header) {
        header.classList.remove('hidden');
        const avatarUrl = partnerProfile.avatar_url
            || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.selectedConversationName)}&background=6366f1&color=fff&bold=true`;

        const avatarEl = document.getElementById('chatHeaderAvatar');
        const nameEl   = document.getElementById('chatHeaderName');
        if (avatarEl) avatarEl.src = avatarUrl;
        if (nameEl)   nameEl.textContent = state.selectedConversationName;
        
        // 👉 THE MAGIC CHECK: Instantly verify if they are online!
        const isOnline = state.onlineUsers?.has(partnerId);
        const role = partnerProfile.role || 'Student';
        const avatarDot = document.querySelector('.chat-header-avatar-wrap .conv-status-dot');
        
        if (isOnline) {
            setHeaderStatus('online', 'Active now');
            if (avatarDot) avatarDot.className = 'conv-status-dot online';
        } else {
            setHeaderStatus('offline', role);
            if (avatarDot) avatarDot.className = 'conv-status-dot offline';
        }
    }

    // Show thread, hide empty state
    document.getElementById('chatEmptyState')?.classList.add('hidden');
    const threadArea = document.getElementById('chatThreadArea');
    const inputArea  = document.getElementById('chatInputArea');
    threadArea?.classList.remove('hidden');
    inputArea?.classList.remove('hidden');

    renderThread(partnerId);
    markThreadAsRead(partnerId);
    renderSidebar();
    rebindChatActionButtons();

    // Slide to chat panel on mobile
    openConversationMobile();

    setTimeout(() => document.getElementById('chatMainInput')?.focus(), 80);
}

// ── Render the full thread ────────────────────────────────────────────────
// ── Render the full thread ────────────────────────────────────────────────
function renderThread(partnerId) {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;

    // Check if this chat was cleared locally during this session
    if (!state.clearedConversations) state.clearedConversations = {};
    const clearTime = state.clearedConversations[partnerId] || 0;

    const thread = state.allMessages
        .filter(m =>
            m._type === 'personal' &&
            (m.sender_id === partnerId || m.receiver_id === partnerId) &&
            (m.sender_id === state.currentUserId || m.receiver_id === state.currentUserId) &&
            new Date(m.created_at).getTime() > clearTime // 👉 THE FIX: Ignores messages sent before you cleared it!
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (thread.length === 0) {
        area.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                      height:100%;gap:10px;color:rgba(232,236,255,0.28);">
            <span class="material-symbols-outlined" style="font-size:28px;">waving_hand</span>
            <span style="font-size:0.83rem;font-weight:600;">Start the conversation!</span>
          </div>`;
        return;
    }

    let html      = '';
    let lastDate  = '';
    let lastKey   = '';
    let groupOpen = false;

    thread.forEach((msg, i) => {
        const msgDate   = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const isSent    = msg.sender_id === state.currentUserId;
        const senderKey = `${msg.sender_id}-${isSent ? 'sent' : 'recv'}`;

        // Date divider
        if (msgDate !== lastDate) {
            if (groupOpen) { html += '</div>'; groupOpen = false; }
            html += `<div class="date-divider">${msgDate}</div>`;
            lastDate = msgDate;
            lastKey  = '';
        }

        // New bubble group
        if (senderKey !== lastKey) {
            if (groupOpen) { html += '</div>'; }
            html += `<div class="bubble-group ${isSent ? 'sent' : 'received'}" data-sender="${msg.sender_id}">`;
            if (!isSent) {
                const sName = (state.profilesMap[msg.sender_id] || {}).full_name || state.selectedConversationName;
                html += `<div class="bubble-sender-label">${escapeHtml(sName)}</div>`;
            }
            groupOpen = true;
            lastKey   = senderKey;
        }

        const timeStr   = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLastMsg = i === thread.length - 1;

        html += `
          <div class="chat-bubble ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">${escapeHtml(msg.content)}</div>
          <div class="bubble-time-row">
            <span class="bubble-time">${timeStr}</span>
            ${isSent && isLastMsg
                ? `<span class="bubble-seen"><span class="material-symbols-outlined">${msg.is_read ? 'done_all' : 'check'}</span></span>`
                : ''}
          </div>`;
    });

    if (groupOpen) html += '</div>';
    area.innerHTML = html;
    area.scrollTop = area.scrollHeight;
}

// ── Append a single new bubble ────────────────────────────────────────────
export function appendBubble(msg, scroll = true) {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;

    const isSent  = msg.sender_id === state.currentUserId;
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

// ── Update seen receipt on last sent bubble ───────────────────────────────
export function updateSeenReceipts() {
    const area = document.getElementById('chatThreadArea');
    if (!area) return;
    const sentGroups = area.querySelectorAll('.bubble-group.sent');
    if (!sentGroups.length) return;
    const seenIcon = sentGroups[sentGroups.length - 1].querySelector('.bubble-seen .material-symbols-outlined');
    if (seenIcon) seenIcon.textContent = 'done_all';
}

// ── Mark a thread as read in DB + state ──────────────────────────────────
export async function markThreadAsRead(senderId) {
    await supabaseClient
        .from('portal_messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', state.currentUserId)
        .eq('is_read', false);

    state.allMessages.forEach(m => {
        if (m.sender_id === senderId && m.receiver_id === state.currentUserId) {
            m.is_read = true;
        }
    });
    updateUnreadCount();
}

// ── Typing indicator ──────────────────────────────────────────────────────
export function simulateTyping(senderId) {
    if (senderId === state.currentUserId) return;
    if (state.typingTimers[senderId]) clearTimeout(state.typingTimers[senderId]);

    if (state.selectedConversationId === senderId && !document.getElementById('typingBubble')) {
        showTypingBubble();
    }
    state.typingTimers[senderId] = setTimeout(() => clearTypingIndicator(senderId), 3000);
    renderSidebar();
}

export function clearTypingIndicator(senderId) {
    delete state.typingTimers[senderId];
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
    setHeaderStatus('typing-status', `${state.selectedConversationName} is typing…`);
}

function removeTypingBubble() {
    document.getElementById('typingBubble')?.remove();
    if (state.selectedConversationId) {
        const role = (state.profilesMap[state.selectedConversationId] || {}).role || 'Student';
        setHeaderStatus('offline', role);
    }
}

// ── Header status helper ──────────────────────────────────────────────────
// ── Header status helper ──────────────────────────────────────────────────
function setHeaderStatus(cssClass, text) {
    const statusEl = document.getElementById('chatHeaderStatus');
    if (!statusEl) return;
    statusEl.className = `chat-header-status ${cssClass}`;
    
    // 👉 FIX: We removed the auto-injected `<div class="header-status-dot"></div>`
    statusEl.innerHTML = text; 
}

// ── Send message ──────────────────────────────────────────────────────────
export async function sendChatMessage() {
    const input = document.getElementById('chatMainInput');
    if (!input || !state.selectedConversationId) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoResizeInput(input);

    // Optimistic message
    const optimisticMsg = {
        id:           `opt_${Date.now()}`,
        sender_id:    state.currentUserId,
        sender_name:  state.currentUserName,
        receiver_id: state.selectedConversationId,
        content:      text,
        is_read:      false,
        created_at:   new Date().toISOString(),
        _type:        'personal'
    };

    state.allMessages.unshift(optimisticMsg);
    appendBubble(optimisticMsg);
    renderSidebar();

    try {
        const { data, error } = await supabaseClient
            .from('portal_messages')
            .insert([{
                sender_id:    state.currentUserId,
                sender_name:  state.currentUserName,
                receiver_id: state.selectedConversationId,
                subject:      'Direct Message',
                content:      text,
                is_read:      false
            }])
            .select()
            .single();

        if (error) throw error;

        const idx = state.allMessages.findIndex(m => m.id === optimisticMsg.id);
        if (idx !== -1) state.allMessages[idx] = { ...data, _type: 'personal' };

        const optBubble = document.querySelector(`[data-id="${optimisticMsg.id}"]`);
        if (optBubble) optBubble.setAttribute('data-id', data.id);

        setTimeout(() => updateSeenReceipts(), 1500);
    } catch (err) {
        console.error('Send failed:', err.message);
        const failBubble = document.querySelector(`[data-id="${optimisticMsg.id}"]`);
        if (failBubble) {
            failBubble.style.opacity = '0.5';
            failBubble.title = 'Failed to send — click to retry';
        }
        showToast('Failed to send message', 'error');
    }
}