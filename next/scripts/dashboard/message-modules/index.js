// =============================================================================
// index.js — Message Module Entry Point
// =============================================================================

import { supabaseClient } from '../config.js';
import { state } from './store.js';
import { fetchAllMessages, subscribeToRealtime } from './api.js';
import {
    renderSidebar,
    switchMsgTab,
    viewAnnouncement,
    updateUnreadCount
} from './ui-sidebar.js';
import {
    setupMessageActions,
    initializeAutocomplete,
    openComposeModal,
    selectRecipient
} from './ui-actions.js';
import { openConversation, simulateTyping, sendChatMessage } from './ui-thread.js';
import {
    initMessengerMobile,
    openConversationMobile,
    closeConversationMobile,
    openAnnouncementsMobile
} from './messenger-mobile.js';

export async function loadMessages(userId) {
    state.currentUserId = userId;

    // 1. Fetch profiles for name/avatar lookup
    const { data: profiles } = await supabaseClient.from('profiles').select('*');
    if (profiles) {
        state.allProfiles = profiles;
        profiles.forEach(p => { state.profilesMap[p.id] = p; });
        if (state.profilesMap[userId]) state.currentUserName = state.profilesMap[userId].full_name;
    }

    // 2. Initial Data Load
    await fetchAllMessages();
    renderSidebar();
    updateUnreadCount();

    // 3. Realtime & UI Wiring
    subscribeToRealtime();
    setupMessageActions();
    initializeAutocomplete();

    // 4. Global Bindings (for HTML onclick= attributes)
    window.openConversation       = openConversation;
    window.switchMsgTab           = switchMsgTab;
    window.viewAnnouncement       = viewAnnouncement;
    window.simulateTyping         = simulateTyping;
    window.sendChatMessage        = sendChatMessage;
    window.openComposeModal       = openComposeModal;
    window.selectRecipient        = selectRecipient;

    // 5. Mobile panel slide bindings
    window.openConversationMobile  = openConversationMobile;
    window.closeConversationMobile = closeConversationMobile;
    window.openAnnouncementsMobile = openAnnouncementsMobile;

    // 6. Init mobile behaviour (no-op on desktop)
    initMessengerMobile();
}