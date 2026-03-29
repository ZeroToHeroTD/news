// api.js
import { supabaseClient } from '../config.js'; // Corrected path (one level up)
import { state } from './store.js';
import { renderSidebar, updateUnreadCount } from './ui-sidebar.js';
import { showIncomingPing } from './helpers.js';
// These two usually live in ui-thread.js because they touch the chat bubbles
import { appendBubble, markThreadAsRead, clearTypingIndicator, updateSeenReceipts } from './ui-thread.js';

/**
 * Fetches all personal messages and announcements from Supabase.
 */
/**
 * Fetches all personal messages and announcements from Supabase.
 */
export async function fetchAllMessages() {
    try {
        const [personalRes, announceRes] = await Promise.all([
            supabaseClient
                .from('portal_messages')
                .select('*')
                .or(`receiver_id.eq.${state.currentUserId},sender_id.eq.${state.currentUserId}`),
            supabaseClient
                .from('portal_messages')
                .select('*')
                .is('receiver_id', null)
                .order('created_at', { ascending: false })
        ]);

        if (personalRes.error) throw personalRes.error;
        if (announceRes.error) throw announceRes.error;

        // 👉 THE FIX: Grab the list of read announcements from the browser's memory
        const readAnns = JSON.parse(localStorage.getItem('readAnnouncements') || '[]');

        const personal = (personalRes.data || []).map(m => ({ ...m, _type: 'personal' }));
        
        // 👉 THE FIX: Force the announcement to show as 'read' if it's in local storage
        const announce = (announceRes.data || []).map(m => ({ 
            ...m, 
            _type: 'announcement',
            is_read: readAnns.includes(m.id) 
        }));

        state.allMessages = [...personal, ...announce].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        updateUnreadCount();
    } catch (err) {
        console.error("Fetch Messages Error:", err.message);
    }
}

/**
 * Sets up the real-time listener for new messages and status updates.
 */
/**
 * Sets up the real-time listener for new messages AND online presence!
 */
export function subscribeToRealtime() {
if (state.realtimeChannel) supabaseClient.removeChannel(state.realtimeChannel);

    state.realtimeChannel = supabaseClient
        .channel('portal_messages_hub')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_messages' }, handleIncomingMessage)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'portal_messages' }, handleMessageUpdate)
        // 👉 ADD THIS LINE: Listen for deletions
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'portal_messages' }, (payload) => {
            state.allMessages = state.allMessages.filter(m => String(m.id) !== String(payload.old.id));
            renderSidebar();
            updateUnreadCount();
        })
        .subscribe();

    // 2. LIVE PRESENCE ENGINE (The fix for the green dots!)
    if (state.presenceChannel) supabaseClient.removeChannel(state.presenceChannel);
    
    state.presenceChannel = supabaseClient.channel('campus_presence', {
        config: { presence: { key: state.currentUserId } }
    });

    state.presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const presenceState = state.presenceChannel.presenceState();
            state.onlineUsers = new Set(Object.keys(presenceState)); // Save all online IDs
            
            // A. Update the Header if you are currently looking at a chat
            if (state.selectedConversationId) {
                const isOnline = state.onlineUsers.has(state.selectedConversationId);
                const role = (state.profilesMap[state.selectedConversationId] || {}).role || 'Student';
                
                const headerStatus = document.getElementById('chatHeaderStatus');
                const avatarDot = document.querySelector('.chat-header-avatar-wrap .conv-status-dot');
                
if (headerStatus && avatarDot) {
                    if (isOnline) {
                        headerStatus.className = 'chat-header-status online';
                        
                        // 👉 FIX: Just say "Active now" without the dot div
                        headerStatus.innerHTML = `Active now`; 
                        
                        avatarDot.className = 'conv-status-dot online';
                    } else {
                        headerStatus.className = 'chat-header-status offline';
                        headerStatus.innerHTML = role; 
                        avatarDot.className = 'conv-status-dot offline';
                    }
                }
            }

            // B. Update the Sidebar dots dynamically
            document.querySelectorAll('.conv-item').forEach(item => {
                const onclickAttr = item.getAttribute('onclick') || '';
                const match = onclickAttr.match(/'([^']+)'/);
                if (match) {
                    const partnerId = match[1];
                    const dot = item.querySelector('.conv-status-dot');
                    // Update dot unless they are currently typing
                    if (dot && !dot.classList.contains('typing')) {
                        dot.className = state.onlineUsers.has(partnerId) ? 'conv-status-dot online' : 'conv-status-dot offline';
                    }
                }
            });
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                // Broadcast to everyone else that YOU are online
                await state.presenceChannel.track({ online_at: new Date().toISOString() });
            }
        });
}

/**
 * Logic for handling a new message arriving via the real-time socket.
 */
async function handleIncomingMessage(payload) {
    const msg = payload.new;
    const isPersonal = msg.receiver_id === state.currentUserId || msg.sender_id === state.currentUserId;
    const isAnnouncement = !msg.receiver_id;
    
    if (!isPersonal && !isAnnouncement) return;

    // Prevent duplicates
    if (state.allMessages.find(m => String(m.id) === String(msg.id))) return;

    // Handle Optimistic UI cleanup (replaces the "temp" message with the real DB message)
    const recentOpt = state.allMessages.find(m =>
        m.id.toString().startsWith('opt_') &&
        m.sender_id === msg.sender_id &&
        m.content === msg.content
    );
    
    if (recentOpt) {
        const idx = state.allMessages.indexOf(recentOpt);
        state.allMessages[idx] = { ...msg, _type: 'personal' };
        const bubble = document.querySelector(`[data-id="${recentOpt.id}"]`);
        if (bubble) bubble.setAttribute('data-id', msg.id);
        return;
    }

    msg._type = isAnnouncement ? 'announcement' : 'personal';
    state.allMessages.unshift(msg);
    clearTypingIndicator(msg.sender_id);

    // If we are looking at the chat with the person who just messaged us
    if (state.currentTab === 'personal' && state.selectedConversationId === msg.sender_id) {
        appendBubble(msg, false);
        markThreadAsRead(msg.sender_id);
    } else if (msg.sender_id !== state.currentUserId) {
        // Otherwise, show a notification/toast
        const senderProfile = state.profilesMap[msg.sender_id];
        const senderName = senderProfile ? senderProfile.full_name : 'Someone';
        showIncomingPing(senderName, msg.content);
    }

    renderSidebar();
    updateUnreadCount();
}

/**
 * Logic for updating message status (like read receipts).
 */
async function handleMessageUpdate(payload) {
    const idx = state.allMessages.findIndex(m => String(m.id) === String(payload.new.id));
    if (idx !== -1) {
        state.allMessages[idx] = { ...state.allMessages[idx], ...payload.new };
    }

    if (state.currentTab === 'personal' && state.selectedConversationId) {
        updateSeenReceipts();
    }
}