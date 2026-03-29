import { supabaseClient } from '../config.js';
import { state } from './store.js';
import { showToast, autoResizeInput, closeAllPopovers, clearSearchHighlights, truncate, escapeAttr } from './helpers.js';
import { renderConversationList, renderSidebar } from './ui-sidebar.js';
import { sendChatMessage, markThreadAsRead } from './ui-thread.js';
import { fetchAllMessages } from './api.js';

export function setupMessageActions() {
    const chatInput = document.getElementById('chatMainInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                sendChatMessage(); 
            }
        });
        chatInput.addEventListener('input', () => autoResizeInput(chatInput));
    }

    document.addEventListener('click', closeAllPopovers);

    document.getElementById('composeNewBtn')?.addEventListener('click', openComposeModal);
    document.getElementById('composeCloseBtn')?.addEventListener('click', closeComposeModal);
    document.getElementById('composeCancelBtn')?.addEventListener('click', closeComposeModal);
    document.getElementById('composeSendBtn')?.addEventListener('click', sendNewMessage);
    document.getElementById('annViewClose')?.addEventListener('click', () => {
        document.getElementById('annViewOverlay')?.classList.remove('active');
    });

    ['composeModalOverlay', 'annViewOverlay', 'deleteConfirmOverlay', 'profileModalOverlay'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('active');
        });
    });

    const sidebarSearch = document.querySelector('.sidebar-search-input');
    if (sidebarSearch) {
        sidebarSearch.addEventListener('input', (e) => renderConversationList(e.target.value.trim()));
    }
}

export function rebindChatActionButtons() {
    // 1. Emoji Button
    const emojiBtn = document.querySelector('.input-emoji-btn[title="Emoji"]');
    if (emojiBtn && !emojiBtn._emojiBound) {
        emojiBtn._emojiBound = true;
        let picker = document.getElementById('emojiPickerPortal');
        if (!picker) {
            picker = document.createElement('div'); 
            picker.id = 'emojiPickerPortal';
            picker.className = 'emoji-picker-popover';
            const EMOJIS = ['😀','😂','🥰','😎','😭','🥺','🤔','😅','🤩','🥳','👍','👎','🙏','💪','🤝','👀','💀','🔥','❤️','💔','🎉','✨','💯','🚀','⭐','🎊','🎁','🏆','💡','📎'];
            picker.innerHTML = EMOJIS.map(em => `<span class="emoji-item" data-emoji="${em}">${em}</span>`).join('');
            document.body.appendChild(picker);
            picker.addEventListener('click', (e) => {
                const item = e.target.closest('.emoji-item');
                if (!item) return;
                const chatInput = document.getElementById('chatMainInput');
                if (chatInput) {
                    const pos = chatInput.selectionStart;
                    chatInput.value = chatInput.value.slice(0, pos) + item.dataset.emoji + chatInput.value.slice(pos);
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
            closeAllPopovers(null, picker);
            const rect = emojiBtn.getBoundingClientRect();
            picker.style.left = `${rect.left}px`; 
            picker.style.bottom = `${window.innerHeight - rect.top + 8}px`; 
            picker.style.top = 'auto';
            picker.classList.toggle('show');
        });
    }

    // 2. Attachment Button
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
                    chatInput.value = (chatInput.value ? chatInput.value + ' ' : '') + `[📎 ${file.name}]`;
                    chatInput.focus(); autoResizeInput(chatInput);
                }
                showToast(`"${truncate(file.name, 30)}" attached — press Send`, 'info');
            };
            fileInput.click();
        });
    }

    // 3. Search Button
    const searchBtn = document.querySelector('.chat-action-btn[title="Search in conversation"]');
    if (searchBtn && !searchBtn._searchBound) {
        searchBtn._searchBound = true;
        let searchBar = document.getElementById('chatLocalSearchBar');
        if (!searchBar) {
            searchBar = document.createElement('div'); 
            searchBar.id = 'chatLocalSearchBar';
            searchBar.className = 'chat-local-search';
            searchBar.innerHTML = `<span class="material-symbols-outlined" style="color:var(--text-muted,#94a3b8);font-size:18px;">search</span><input type="text" id="chatLocalSearchInput" placeholder="Find in this conversation..."><button id="closeLocalSearch" title="Close"><span class="material-symbols-outlined">close</span></button>`;
            const header = document.getElementById('chatPanelHeader');
            if (header && header.parentNode) header.parentNode.insertBefore(searchBar, header.nextSibling);
            document.getElementById('closeLocalSearch').onclick = () => {
                searchBar.classList.remove('active'); document.getElementById('chatLocalSearchInput').value = ''; clearSearchHighlights();
            };
            document.getElementById('chatLocalSearchInput').addEventListener('input', (ev) => {
                const term = ev.target.value.toLowerCase().trim();
                document.querySelectorAll('#chatThreadArea .chat-bubble').forEach(b => {
                    if (term && b.textContent.toLowerCase().includes(term)) { 
                        b.classList.add('search-match'); 
                        b.style.border = '2px solid var(--primary)';
                        b.style.boxShadow = '0 0 15px rgba(99,102,241,0.4)';
                        b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); 
                    } else { 
                        b.classList.remove('search-match'); b.style.border = ''; b.style.boxShadow = '';
                    }
                });
            });
        }
        searchBtn.addEventListener('click', (e) => {
            e.stopPropagation(); searchBar.classList.toggle('active');
            if (searchBar.classList.contains('active')) document.getElementById('chatLocalSearchInput')?.focus(); else clearSearchHighlights();
        });
    }

    // 4. More Options Button (Using receiver_id strictly)
    const moreBtn = document.querySelector('.chat-action-btn[title="More options"]');
    if (moreBtn && !moreBtn._moreBound) {
        moreBtn._moreBound = true;
        if (!state.mutedConversations) state.mutedConversations = new Set();

        let menu = document.getElementById('chatOptionsMenuPortal');
        if (!menu) {
            menu = document.createElement('div'); 
            menu.id = 'chatOptionsMenuPortal';
            menu.className = 'chat-dropdown-menu';
            document.body.appendChild(menu);

            menu.addEventListener('click', async (e) => {
                const action = e.target.closest('.chat-menu-item');
                if (!action) return;
                e.stopPropagation();
                const actionId = action.id;
                const partnerId = state.selectedConversationId;
                
                if (actionId === 'optViewProfile') {
                    const partnerProfile = state.profilesMap[partnerId];
                    if (partnerProfile) showProfileModal(partnerProfile);
                } 
                else if (actionId === 'optMute') {
                    if (state.mutedConversations.has(partnerId)) {
                        state.mutedConversations.delete(partnerId);
                        showToast('Notifications unmuted.', 'success');
                    } else {
                        state.mutedConversations.add(partnerId);
                        showToast('Notifications muted.', 'warning');
                    }
                } 
                else if (actionId === 'optClearChat') {
                    menu.classList.remove('show');
                    const deleteModal = document.getElementById('deleteConfirmOverlay');
                    const finalBtn = document.getElementById('finalDeleteBtn');
                    
                    if (deleteModal && finalBtn) {
                        deleteModal.classList.add('active');
                        finalBtn.onclick = async () => {
                            deleteModal.classList.remove('active');
                            try {
                                showToast('Deleting chat...', 'info');
                                const myId = state.currentUserId;
                                const themId = partnerId;

                                // 👉 THE FIX: Using receiver_id everywhere
                                const { data, error } = await supabaseClient
                                    .from('portal_messages')
                                    .delete()
                                    .in('sender_id', [myId, themId])
                                    .in('receiver_id', [myId, themId]) 
                                    .select(); 
                                
                                if (error) throw error;

                                state.allMessages = state.allMessages.filter(m => 
                                    !( (m.sender_id === myId && m.receiver_id === themId) || 
                                       (m.sender_id === themId && m.receiver_id === myId) )
                                );

                                document.getElementById('chatPanelHeader')?.classList.add('hidden');
                                document.getElementById('chatThreadArea')?.classList.add('hidden');
                                document.getElementById('chatInputArea')?.classList.add('hidden');
                                document.getElementById('chatEmptyState')?.classList.remove('hidden');
                                
                                state.selectedConversationId = null;
                                showToast('Chat permanently deleted.', 'success'); 
                                renderSidebar(); 
                                if (typeof window.closeConversationMobile === 'function') window.closeConversationMobile();
                            } catch (err) {
                                console.error("Full Delete Error:", err);
                                showToast('Database error.', 'error');
                            }
                        };
                    }
                }
                menu.classList.remove('show'); 
            });
        }
        
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation(); closeAllPopovers(null, menu);
            const partnerId = state.selectedConversationId;
            const isMuted = state.mutedConversations.has(partnerId);
            menu.innerHTML = `
                <div class="chat-menu-item" id="optViewProfile"><span class="material-symbols-outlined">person</span> View Profile</div>
                <div class="chat-menu-item" id="optMute"><span class="material-symbols-outlined">${isMuted ? 'notifications_active' : 'notifications_off'}</span> ${isMuted ? 'Unmute' : 'Mute'} Notifications</div>
                <div class="chat-menu-item danger" id="optClearChat"><span class="material-symbols-outlined">delete_forever</span> Delete Chat</div>
            `;
            const rect = moreBtn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + 8}px`; 
            menu.style.right = `${window.innerWidth - rect.right}px`; 
            menu.classList.toggle('show');
        });
    }
}

// ── Upgraded Profile Modal ──
export function showProfileModal(profile) {
    let modal = document.getElementById('profileModalOverlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'profileModalOverlay';
        modal.className = 'compose-modal-overlay';
        document.body.appendChild(modal);
    }
    
    const avatar = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name)}&background=6366f1&color=fff`;
    const role = (profile.role || 'Student').toUpperCase();
    const bio = profile.bio || 'This user has not set a bio yet.';
    const course = profile.course || profile.enrolled_course || 'Not specified';
    const section = profile.section || profile.block_section || 'Not specified';
    const uid = profile.id;

    modal.innerHTML = `
        <div class="compose-modal-box" style="width: 100%; max-width: 360px; padding: 24px; position: relative;">
            <button class="modal-close-btn" style="position: absolute; top: 16px; right: 16px;" onclick="document.getElementById('profileModalOverlay').classList.remove('active')">
                <span class="material-symbols-outlined">close</span>
            </button>
            <div style="text-align: center; margin-bottom: 24px; padding-top: 10px;">
                <img src="${avatar}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin:0 auto 12px; border: 4px solid var(--card-bg); box-shadow: 0 8px 24px rgba(0,0,0,0.15);">
                <h2 style="margin-bottom:4px; font-size:1.3rem; color:var(--text-main);">${profile.full_name}</h2>
                <p style="color:var(--primary); font-weight:700; font-size:0.75rem; letter-spacing: 1px;">${role}</p>
            </div>
            <div style="background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px; margin-bottom: 24px;">
                <div style="margin-bottom: 14px;">
                    <span style="display:block; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Enrolled Course & Section</span>
                    <div style="font-size:0.9rem; color:var(--text-main); font-weight:600;">${course} • ${section}</div>
                </div>
                <div style="margin-bottom: 14px;">
                    <span style="display:block; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Bio</span>
                    <div style="font-size:0.9rem; color:var(--text-main); line-height:1.5;">${bio}</div>
                </div>
                <div>
                    <span style="display:block; font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Unique ID (UID)</span>
                    <div style="font-size:0.8rem; color:var(--text-main); font-family:monospace; word-break:break-all; background: rgba(0,0,0,0.1); padding: 6px 10px; border-radius: 6px;">${uid}</div>
                </div>
            </div>
            <button class="btn-send" style="width:100%; justify-content:center; padding: 12px;" onclick="document.getElementById('profileModalOverlay').classList.remove('active')">Close Profile</button>
        </div>
    `;
    setTimeout(() => modal.classList.add('active'), 10);
}

// ── Compose Modal Logic ──
export function openComposeModal() { document.getElementById('composeModalOverlay')?.classList.add('active'); }

export function closeComposeModal() {
    document.getElementById('composeModalOverlay')?.classList.remove('active');
    ['composeRecipientId', 'composeSubject', 'composeContent'].forEach(id => { 
        const el = document.getElementById(id); if (el) el.value = ''; 
    });
    state.secretReceiverId = null;
}

export async function sendNewMessage() {
    const subjectInput = document.getElementById('composeSubject');
    const contentInput = document.getElementById('composeContent');
    if (!state.secretReceiverId || !contentInput?.value.trim()) return showToast('Please select a recipient.', 'error');
    try {
        const { error } = await supabaseClient.from('portal_messages').insert([{
            sender_id: state.currentUserId, 
            sender_name: state.currentUserName, 
            receiver_id: state.secretReceiverId, // 👉 THE FIX: Changed to receiver_id
            subject: subjectInput?.value.trim() || 'Direct Message', 
            content: contentInput.value.trim(), 
            is_read: false
        }]);
        if (error) throw error;
        showToast('Message sent!', 'success'); closeComposeModal(); await fetchAllMessages(); renderSidebar();
    } catch (err) {
        console.error('Compose failed:', err.message); showToast('Failed to send', 'error');
    }
}

// ── Autocomplete Logic ──
export function initializeAutocomplete() {
    const input = document.getElementById('composeRecipientId');
    const dropdown = document.getElementById('autocompleteDropdown');
    if (!input || !dropdown) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        if (term.length < 1) return dropdown.classList.remove('show');
        const matches = state.allProfiles.filter(p => p.id !== state.currentUserId && p.full_name?.toLowerCase().includes(term)).slice(0, 5);
        if (matches.length > 0) {
            dropdown.innerHTML = matches.map(m => {
                const av = m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.full_name)}&background=6366f1&color=fff`;
                return `<div class="ac-item" onclick="window.selectRecipient('${m.id}', '${escapeAttr(m.full_name)}')"><img src="${av}" class="ac-img" alt="${escapeAttr(m.full_name)}"><div class="ac-text-col"><span class="ac-name">${m.full_name}</span><span class="ac-role">${m.role || 'Student'}</span></div></div>`;
            }).join('');
            dropdown.classList.add('show');
        } else dropdown.classList.remove('show');
    });
    document.addEventListener('click', (e) => { if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('show'); });
}

export function selectRecipient(id, name) {
    const recipientInput = document.getElementById('composeRecipientId');
    if (recipientInput) recipientInput.value = name;
    state.secretReceiverId = id;
    document.getElementById('autocompleteDropdown')?.classList.remove('show');
}