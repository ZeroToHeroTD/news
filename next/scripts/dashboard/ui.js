export function updateAllAvatars(url) {
    const cacheBusted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
    const navAv = document.getElementById('navAvatar');
    const setAv = document.getElementById('settingsAvatar');
    // Only cache-bust storage URLs, not ui-avatars
    const finalUrl = url.includes('supabase') ? cacheBusted : url;
    if (navAv) { navAv.src = finalUrl; navAv.onerror = () => { navAv.src = `https://ui-avatars.com/api/?name=Student&background=0062ff&color=fff`; }; }
    if (setAv) { setAv.src = finalUrl; setAv.onerror = () => { setAv.src = `https://ui-avatars.com/api/?name=Student&background=0062ff&color=fff`; }; }
}

export function checkUserPermissions(role) {
    const cleanRole = (role || "").trim().toLowerCase();
    const addBtn = document.getElementById('addResourceBtn');
    const composeMsgBtn = document.getElementById('composeMsgBtn');
    const isAdmin = cleanRole === 'admin' || cleanRole === 'teacher';
    if (addBtn) addBtn.style.display = isAdmin ? "block" : "none";
    if (composeMsgBtn) composeMsgBtn.style.display = isAdmin ? "block" : "none";
}

export function switchView(targetId) {
    if (!targetId) return;
    const allViews = document.querySelectorAll('.page-view');
    const sidebarLinks = document.querySelectorAll('.nav-links li');
    allViews.forEach(v => v.classList.remove('active'));
    sidebarLinks.forEach(l => l.classList.remove('active'));

    const targetView = document.getElementById(targetId);
    if (targetView) targetView.classList.add('active');

    const sidebarItem = document.querySelector(`.nav-links li[data-target="${targetId}"]`);
    if (sidebarItem) sidebarItem.classList.add('active');
}