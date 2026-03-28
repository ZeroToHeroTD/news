// =============================================================================
// messages.js — MESSENGER HUB ENGINE v2.0
// Features: Multi-user chat, typing indicators, seen receipts, real-time sync
// =============================================================================

import { supabaseClient } from './config.js';
import { getTimeAgo } from './utils.js';

// ---------------------------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------------------------
let allProfiles = [];
let profilesMap = {};               // Lookup map for fast name/avatar resolution
let currentUserId = null;
let currentUserName = 'Me';
let allMessages = [];
let selectedConversationId = null;  // sender_id of active chat
let selectedConversationName = '';
let currentTab = 'personal';        // 'personal' | 'announcements'
let typingTimers = {};              // { userId: timeoutId } for typing simulation
let realtimeChannel = null;         // Supabase real-time subscription

// ---------------------------------------------------------------------------
// 1. BOOT — Initialise Hub
// ---------------------------------------------------------------------------

export async function loadMessages(userId) {
    currentUserId = userId;

    // Fetch ALL profiles to build a reliable dictionary for names & avatars
    const { data: profiles } = await supabaseClient.from('profiles').select('*');
    if (profiles) {
        allProfiles = profiles;
        profiles.forEach(p => {
            profilesMap[p.id] = p;
        });
        if (profilesMap[userId]) currentUserName = profilesMap[userId].full_name;
    }

    await fetchAllMessages();
    renderSidebar();
    subscribeToRealtime();
    setupMessageActions(); // Initialize buttons
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
// 2. REAL-TIME SUBSCRIPTION (Supabase Realtime)
// ---------------------------------------------------------------------------

function subscribeToRealtime() {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

    realtimeChannel = supabaseClient
        .channel('portal_messages_hub')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'portal_messages'
        }, handleIncomingMessage)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'portal_messages'
        }, handleMessageUpdate)
        .subscribe();
}

async function handleIncomingMessage(payload) {
    const msg = payload.new;

    const isPersonal = msg.recipient_id === currentUserId || msg.sender_id === currentUserId;
    const isAnnouncement = !msg.recipient_id;
    if (!isPersonal && !isAnnouncement) return;

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

function renderConversationList() {
    const list = document.getElementById('conversationList');
    if (!list) return;

    const convMap = {};
    allMessages
        .filter(m => m._type === 'personal')
        .forEach(m => {
            const partnerId = m.sender_id === currentUserId ? m.recipient_id : m.sender_id;
            if (!partnerId) return;
            
            // USE PROFILES MAP FOR RELIABLE DATA
            const partnerProfile = profilesMap[partnerId] || {};
            const partnerName = partnerProfile.full_name || 'Unknown User';
            
            if (!convMap[partnerId]) {
                convMap[partnerId] = { id: partnerId, name: partnerName, profile: partnerProfile, lastMsg: m, unread: 0 };
            }
            if (!m.is_read && m.sender_id !== currentUserId) convMap[partnerId].unread++;
        });

    const convs = Object.values(convMap).sort(
        (a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at)
    );

    if (convs.length === 0) {
        list.innerHTML = `
          <div style="padding: 24px 12px; text-align:center; color: rgba(241,245,249,0.3);">
            <span class="material-symbols-outlined" style="font-size:36px; display:block; margin-bottom:8px;">forum</span>
            <div style="font-size:0.8rem;">No conversations yet</div>
          </div>`;
        return;
    }

    list.innerHTML = convs.map(c => {
        const isActive = selectedConversationId === c.id;
        const isTyping = typingTimers[c.id] !== undefined;
        // Fix Avatar fallback
        const avatarUrl = c.profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=6366f1&color=fff&bold=true&rounded=false`;
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
        const avatarUrl = partnerProfile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedConversationName)}&background=6366f1&color=fff&bold=true`;
        
        const avatarEl = document.getElementById('chatHeaderAvatar');
        const nameEl = document.getElementById('chatHeaderName');
        
        if (avatarEl) avatarEl.src = avatarUrl;
        if (nameEl) nameEl.textContent = selectedConversationName;
        
        // Changed from 'Active now' to role/offline since presence isn't built yet
        setHeaderStatus('offline', partnerProfile.role || 'Student');
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (threadArea) threadArea.classList.remove('hidden');
    if (inputArea) inputArea.classList.remove('hidden');

    renderThread(partnerId);
    markThreadAsRead(partnerId);
    renderSidebar(); // Update active highlight
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
        const msgDate = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
            
            // Use profile map for sender label
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
            ${msg.content}
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
      <div class="chat-bubble ${isSent ? 'sent' : 'received'}" data-id="${msg.id}">${msg.content}</div>
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

    typingTimers[senderId] = typingTimers[senderId] || true;
    renderSidebar();

    if (selectedConversationId === senderId) {
        showTypingBubble();
    }

    clearTimeout(typingTimers[senderId]);
    typingTimers[senderId] = setTimeout(() => {
        clearTypingIndicator(senderId);
    }, 3000);
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
    // Only show the dot if online or typing
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
    // 1. Find the message in our local state safely
    const msg = allMessages.find(m => String(m.id) === String(id));
    
    if (!msg) {
        console.error("Announcement not found in local state:", id);
        return;
    }

    // 2. Optimistic Update: Mark as read locally immediately
    if (!msg.is_read) {
        // Update the actual object in the allMessages array
        msg.is_read = true; 
        
        // IMPORTANT: Refresh the counts and the sidebar UI right now
        updateUnreadCount(); 
        renderSidebar();
        
        // 3. Update Supabase in the background
        supabaseClient.from('portal_messages')
            .update({ is_read: true })
            .eq('id', id)
            .then(({ error }) => {
                if (error) {
                    console.error('Database Sync Error:', error.message);
                }
            });
    }

    // 4. Handle the Modal UI
    const overlay = document.getElementById('annViewOverlay');
    if (!overlay) {
        showToast('Announcement modal (annViewOverlay) is missing from your HTML!', 'error');
        return;
    }

    // Safely populate the modal fields
    const fields = {
        'annViewTag': 'Announcement',
        'annViewTitle': msg.subject || 'Notice',
        'annViewFrom': 'Administration',
        'annViewDate': new Date(msg.created_at).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        'annViewBody': msg.content
    };

    Object.keys(fields).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = fields[key];
    });

    // 5. Show the modal
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
    
    const recipientInput = document.getElementById('composeRecipientId');
    const subjectInput = document.getElementById('composeSubject');
    const contentInput = document.getElementById('composeContent');

    if (recipientInput) recipientInput.value = '';
    if (subjectInput) subjectInput.value = '';
    if (contentInput) contentInput.value = '';
    
    window.secretReceiverId = null;
};

window.sendNewMessage = async () => {
    const recipientInput = document.getElementById('composeRecipientId');
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
        closeComposeModal();
        await fetchAllMessages();
        renderSidebar();

    } catch (err) {
        console.error('Compose failed:', err.message);
        showToast('Failed to send message', 'error');
    }
};

// ---------------------------------------------------------------------------
// 10. UNREAD COUNTER & UTILS
// ---------------------------------------------------------------------------

export function updateUnreadCount() {
    const personalUnread = allMessages.filter(m => m._type === 'personal' && !m.is_read && m.sender_id !== currentUserId).length;
    const announceUnread = allMessages.filter(m => m._type === 'announcement' && !m.is_read).length;
    const total = personalUnread + announceUnread;

    console.log(`Unread Check — Personal: ${personalUnread}, Notices: ${announceUnread}, Total: ${total}`);

    // 1. Sidebar Tab Badges (the ones inside the Hub)
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

    // 2. Global Navigation Red Dot (The one in the far left menu)
    const dot = document.getElementById('msg-count-dot');
    if (dot) {
        if (total > 0) {
            dot.style.display = 'flex'; 
            dot.textContent = total > 9 ? '9+' : total;
        } else {
            dot.style.display = 'none'; // This completely removes the red dot
        }
    }
}

export async function initializeAutocomplete() {
    const input = document.getElementById('composeRecipientId');
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!input || !dropdown) return;

    // Use profiles we already fetched
    allProfiles = allProfiles.filter(p => p.id !== currentUserId);

    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term.length < 1) return dropdown.classList.remove('show');

        const matches = allProfiles.filter(p => p.full_name?.toLowerCase().includes(term)).slice(0, 5);

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
// 12. SETUP EVENT LISTENERS & SEARCH
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

    // Modal Triggers
    document.getElementById('composeNewBtn')?.addEventListener('click', window.openComposeModal);
    document.getElementById('composeCloseBtn')?.addEventListener('click', window.closeComposeModal);
    document.getElementById('composeCancelBtn')?.addEventListener('click', window.closeComposeModal);
    document.getElementById('composeSendBtn')?.addEventListener('click', window.sendNewMessage);
    document.getElementById('annViewClose')?.addEventListener('click', () => {
        document.getElementById('annViewOverlay')?.classList.remove('active');
    });

    ['composeModalOverlay', 'annViewOverlay'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });

    // Sidebar Search Filter Setup
    const sidebarSearch = document.querySelector('.sidebar-search-input');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.conv-item').forEach(item => {
                const name = item.querySelector('.conv-name')?.textContent.toLowerCase() || '';
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        });
    }

    // Attach "Coming Soon" to inactive buttons (Emoji, Top Right Search, etc)
    const emojiBtn = document.querySelector('.input-emoji-btn');
    if (emojiBtn) emojiBtn.addEventListener('click', () => showToast('Emoji picker coming soon!'));

    document.querySelectorAll('.chat-action-btn').forEach(btn => {
        btn.addEventListener('click', () => showToast('Feature coming soon!'));
    });
}

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapeAttr(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function showToast(msg, type = 'info') {
    const existing = document.querySelector('.msg-toast');
    if (existing) existing.remove();

    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1' };

    const toast = document.createElement('div');
    toast.className = 'msg-toast';
    toast.innerHTML = `
      <span class="material-symbols-outlined" style="color:${colors[type]}; font-size:18px;">${icons[type]}</span>
      ${msg}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3500);
}

function showIncomingPing(name, content) {
    showToast(`New message from ${name}: ${truncate(content, 30)}`, 'info');
}