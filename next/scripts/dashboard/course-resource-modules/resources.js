import { supabaseClient } from '../config.js';

export async function loadResources() {
    const grid = document.getElementById('resourcesGrid');
    if (!grid) return;

    try {
        const { data: files, error } = await supabaseClient
            .from('portal_resources')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!files || files.length === 0) {
            grid.innerHTML = `<div class="empty-state">No Resources Found</div>`;
            return;
        }

        grid.innerHTML = files.map((file, idx) => {
            const ext = (file.file_type || 'other').toLowerCase().trim();
            const iconMap = { pdf: '📕', docx: '📘', pptx: '📙', xlsx: '📗' };
            const icon = iconMap[ext] || '📁';
            const rawDate = file.created_at
                ? new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Unknown Date';

            return `
            <div class="resource-card" style="animation: cardEntrance 0.5s ease forwards ${idx * 0.05}s; opacity: 0;" onclick="window.open('${file.file_url}', '_blank')">
                <div class="resource-card-preview">${icon}</div>
                <div class="resource-card-body">
                    <h4>${file.title}</h4>
                    <span class="resource-type-badge">${ext.toUpperCase()}</span>
                </div>
                <div class="resource-card-footer">
                    <span class="resource-date">${rawDate}</span>
                    <button class="resource-open-btn">
                        Open <span class="material-symbols-outlined">arrow_forward</span>
                    </button>
                </div>
            </div>`;
        }).join('');
        
    } catch (err) {
        console.error("Resources load error:", err.message);
        grid.innerHTML = `<p style="color:var(--accent-red);">Failed to load resources.</p>`;
    }
}