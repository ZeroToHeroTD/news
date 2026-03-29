// =============================================================================
// courses-resources.js — Courses Grid & Resources Grid Loaders (Premium)
// =============================================================================

import { supabaseClient } from './config.js';
import { escapeAttr } from './utils.js'; // FIX 1: Added missing import

// Premium cycling icon set for course cards
const COURSE_ICONS = ['📘', '🧪', '📐', '💻', '📊', '🎨', '🌐', '📝'];

/**
 * Loads the student's enrolled courses.
 */
export async function loadCoursesData(userId) {
    const container = document.getElementById('db-courses-container');
    const countDisplay = document.getElementById('courseCount');
    if (!container) return;

    try {
        // STRICT: Ensure column names match your Supabase table exactly
        // If your table uses 'instructor_name', change 'instructor' to 'instructor_name' below
        const { data: courses, error } = await supabaseClient
            .from('student_courses')
            .select('id, course_name, course_code, progress, color_theme, instructor_name, instructor_id, units')
            .eq('student_id', userId);

        if (error) throw error;
        if (countDisplay) countDisplay.textContent = courses?.length || 0;

        if (!courses || courses.length === 0) {
            container.innerHTML = `<div class="empty-state">No Enrolled Courses Found.</div>`;
            return;
        }

        container.innerHTML = courses.map((course, idx) => {
            const progressValue = course.progress || 0;
            const color = course.color_theme || 'var(--primary)';
            const icon = COURSE_ICONS[idx % COURSE_ICONS.length];
            const instructorName = course.instructor_name || 'Instructor TBA';
            const instructorId = course.instructor_id;
            
            // Strict check for messaging ability
            const canMessage = !!instructorId;

            return `
            <div class="course-card" style="animation: slideInRight 0.5s ease forwards ${idx * 0.08}s; opacity: 0;">
                <div class="course-card-top-bar" style="background: ${color};"></div>
                <div class="course-card-body">
                    <div class="course-card-header">
                        <div class="course-card-icon">${icon}</div>
                        <span class="course-card-code">${course.course_code || 'CODE'}</span>
                    </div>
                    <h3>${course.course_name}</h3>
                    <p class="instructor-name">
                        <span class="material-symbols-outlined" style="font-size:1.1rem; color:var(--primary);">person</span>
                        ${instructorName}
                    </p>
                    <div class="course-progress-label">
                        <span>Progress</span><span>${progressValue}%</span>
                    </div>
                    <div class="course-progress-bar">
                        <div class="course-progress-fill" data-target="${progressValue}" style="width: 0%; background: ${color};"></div>
                    </div>
                </div>
                <div class="course-card-footer">
                    <span class="course-units-label">${course.units || 0} Units</span>
                    
                    ${canMessage ? `
                        <button class="msg-btn-minimal" 
                                onclick="window.openComposeToInstructor('${escapeAttr(instructorName)}', '${instructorId}', 'Query: ${escapeAttr(course.course_name)}')">
                            <span class="material-symbols-outlined">send</span> Message
                        </button>
                    ` : `
                        <button class="msg-btn-minimal disabled" title="Instructor N/A" disabled>
                            <span class="material-symbols-outlined">block</span> N/A
                        </button>
                    `}
                </div>
            </div>`;
        }).join('');

        // Trigger Progress Bar Animations
        setTimeout(() => {
            container.querySelectorAll('.course-progress-fill').forEach(bar => {
                bar.style.width = bar.getAttribute('data-target') + '%';
            });
        }, 100);

    } catch (err) {
        console.error("Courses load error:", err.message);
        // FIX 2: Added error feedback to the UI so it doesn't just stay blank
        container.innerHTML = `<p style="color:var(--accent-red); padding:20px;">Error loading courses: ${err.message}</p>`;
    }
}

/**
 * Loads portal resources (files)
 */
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
            <div class="resource-card" style="animation: slideInRight 0.5s ease forwards ${idx * 0.05}s; opacity: 0;" onclick="window.open('${file.file_url}', '_blank')">
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