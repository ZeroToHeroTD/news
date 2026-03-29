import { supabaseClient } from '../config.js';
import { escapeAttr } from '../utils.js';

const COURSE_ICONS = ['📘', '🧪', '📐', '💻', '📊', '🎨', '🌐', '📝'];

export async function loadCoursesData(userId) {
    const container = document.getElementById('db-courses-container');
    const countDisplay = document.getElementById('courseCount');
    if (!container) return;

    try {
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
                        <button class="msg-instructor-btn" 
                                onclick="window.openComposeToInstructor('${escapeAttr(instructorName)}', '${instructorId}', 'Query: ${escapeAttr(course.course_name)}')">
                            <span class="material-symbols-outlined">send</span> Message
                        </button>
                    ` : `
                        <button class="msg-instructor-btn" style="opacity: 0.5; cursor: not-allowed;" disabled>
                            <span class="material-symbols-outlined">block</span> N/A
                        </button>
                    `}
                </div>
            </div>`;
        }).join('');

        setTimeout(() => {
            container.querySelectorAll('.course-progress-fill').forEach(bar => {
                bar.style.width = bar.getAttribute('data-target') + '%';
            });
        }, 100);

    } catch (err) {
        console.error("Courses load error:", err.message);
        container.innerHTML = `<p style="color:var(--accent-red); padding:20px;">Error loading courses: ${err.message}</p>`;
    }
}