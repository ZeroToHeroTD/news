// Global State Object for Messenger
export const state = {
    allProfiles: [],
    profilesMap: {},
    currentUserId: null,
    currentUserName: 'Me',
    allMessages: [],
    selectedConversationId: null,
    selectedConversationName: '',
    currentTab: 'personal',
    typingTimers: {},
    realtimeChannel: null,
    presenceChannel: null,        // 👉 ADDED: Tracks the live socket
    onlineUsers: new Set(),       // 👉 ADDED: A live list of online User IDs
    secretReceiverId: null // Replaces window.secretReceiverId
};