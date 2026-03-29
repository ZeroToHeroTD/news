// =============================================================================
// messenger-mobile.js — Mobile slide-panel behaviour
// =============================================================================

export function initMessengerMobile() {
    if (window.innerWidth >= 900) return;
    // Prepare back buttons for both panels
    injectBackButton('chatPanelHeader');
    injectBackButton('msgAnnPanelHeader'); // Ensure your Announcement header has this ID
}

function injectBackButton(headerId) {
    const header = document.getElementById(headerId);
    // If header exists and doesn't already have a back button
    if (!header || header.querySelector('.chat-back-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'chat-back-btn';
    btn.innerHTML = `<span class="material-symbols-outlined">arrow_back_ios_new</span>`;
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeConversationMobile();
    });

    header.insertBefore(btn, header.firstChild);
}

export function openConversationMobile() {
    if (window.innerWidth >= 900) return;
    document.querySelector('.msg-sidebar')?.classList.add('conv-open');
    document.getElementById('msgChatPanel')?.classList.add('conv-open');
    document.getElementById('msgAnnPanel')?.classList.remove('conv-open');
    injectBackButton('chatPanelHeader');
}

export function closeConversationMobile() {
    document.querySelector('.msg-sidebar')?.classList.remove('conv-open');
    document.getElementById('msgChatPanel')?.classList.remove('conv-open');
    document.getElementById('msgAnnPanel')?.classList.remove('conv-open');
}

export function openAnnouncementsMobile() {
    if (window.innerWidth >= 900) return;
    document.querySelector('.msg-sidebar')?.classList.add('conv-open');
    document.getElementById('msgAnnPanel')?.classList.add('conv-open');
    document.getElementById('msgChatPanel')?.classList.remove('conv-open');
    // Ensure the notice panel has a back button too
    injectBackButton('msgAnnPanel'); 
}

window.addEventListener('resize', () => {
    if (window.innerWidth >= 900) closeConversationMobile();
});