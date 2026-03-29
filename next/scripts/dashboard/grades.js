// =============================================================================
// grades.js — Academic Records & Performance Analytics (LIVE SYNC UPGRADE)
// =============================================================================

import { supabaseClient } from './config.js';
import { getPHNumericalGrade, updateGwaComparison } from './utils.js';

export let myChart = null;

// ==========================================
// 1. DATA PROCESSING HELPERS (STRICT)
// ==========================================

const processGradeStatus = (g) => {
    if (g.status === 'Incomplete' || g.status === 'INC') {
        return { display: 'INC', status: 'INCOMPLETE', badgeClass: 'status-inc', isGraded: false };
    }
    if (!g.numerical && g.status === 'In Progress') {
        return { display: '--', status: 'PENDING', badgeClass: 'status-pending', isGraded: false };
    }

    const numGrade = parseFloat(g.numerical) || getPHNumericalGrade(((g.midterm || 0) + (g.finals || 0)) / 2);
    const isPassed = numGrade <= 3.0;

    return {
        display: numGrade.toFixed(2),
        status: isPassed ? 'PASSED' : 'FAILED',
        badgeClass: isPassed ? 'status-passed' : 'status-failed',
        isGraded: true,
        numeric: numGrade
    };
};

// ==========================================
// 2. TABLE & GWA ENGINE
// ==========================================

export async function loadGradesData(userId) {
    const tableBody = document.getElementById('gradesTableBody');
    const gwaDisplay = document.getElementById('gwaValue');
    if (!tableBody) return;

    try {
        const { data: grades, error } = await supabaseClient
            .from('student_grades')
            .select('course_name, instructor_name, midterm, finals, numerical, status')
            .eq('student_id', userId);

        if (error) throw error;

        if (!grades?.length) {
            renderEmptyTable(tableBody, gwaDisplay);
            return;
        }

        let totalNum = 0;
        let gradedCount = 0;

        tableBody.innerHTML = grades.map((g, idx) => {
            const { display, status, badgeClass, isGraded, numeric } = processGradeStatus(g);
            if (isGraded) { totalNum += numeric; gradedCount++; }

            return `
                <tr class="grade-row" style="animation-delay: ${idx * 0.05}s">
                    <td class="col-course"><strong>${g.course_name}</strong></td>
                    <td class="col-instructor" style="color: var(--text-muted); font-size: 0.85rem;">${g.instructor_name || 'TBA'}</td>
                    <td class="col-term">${g.midterm ?? '--'}%</td>
                    <td class="col-term">${g.finals ?? '--'}%</td>
                    <td class="col-grade" style="font-weight: 800; color: var(--primary);">${display}</td>
                    <td class="col-status"><span class="status-badge ${badgeClass}">${status}</span></td>
                </tr>`;
        }).join('');

        if (gradedCount > 0 && gwaDisplay) {
            const finalGwa = (totalNum / gradedCount).toFixed(2);
            gwaDisplay.textContent = finalGwa;
            if (typeof updateGwaComparison === 'function') updateGwaComparison(parseFloat(finalGwa));
        }
    } catch (err) { console.error("Grades Engine Error:", err.message); }
}

function renderEmptyTable(body, display) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell" style="text-align:center; padding:40px;">No grades recorded yet.</td></tr>`;
    if (display) display.textContent = '--';
}

// ==========================================
// 3. PERFORMANCE CHART ENGINE (LIVE UPGRADE)
// ==========================================

/**
 * NEW: Attaches a listener to the dropdown so charts update without refresh.
 */
export function initializeChartListener(userId) {
    const filter = document.getElementById('chartFilter');
    if (!filter) return;

    filter.addEventListener('change', (e) => {
        loadPerformanceChart(userId, e.target.value);
    });
}

export async function loadPerformanceChart(userId, filterType = 'grades') {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;

    if (myChart) {
        myChart.destroy();
        myChart = null; 
    }

    const isDark = document.body.classList.contains('dark-mode');
    const theme = {
        grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        text: '#94a3b8',
        accent: '#0062ff',
        bg: isDark ? '#1e293b' : '#ffffff'
    };

    try {
        const config = await getChartConfig(userId, filterType, theme, isDark);
        if (config) {
            myChart = new Chart(canvas, config);
        }
    } catch (err) {
        console.error("Chart Engine Error:", err.message);
    }
}

async function getChartConfig(userId, type, theme, isDark) {
    if (type === 'grades') {
        const { data } = await supabaseClient.from('student_grades').select('course_name, numerical, midterm, finals').eq('student_id', userId);
        if (!data?.length) return null;

        const labels = data.map(g => g.course_name.length > 10 ? g.course_name.substring(0, 8) + '..' : g.course_name);
        const points = data.map(g => parseFloat(g.numerical) || getPHNumericalGrade(((g.midterm || 0) + (g.finals || 0)) / 2));

        return {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'GWA Trend',
                    data: points,
                    borderColor: theme.accent,
                    backgroundColor: 'transparent',
                    fill: false, 
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: theme.accent,
                    pointBorderColor: theme.bg,
                    pointBorderWidth: 3
                }]
            },
            options: getCommonOptions(theme, true) // Reversed for Grades
        };
    } 
    
    if (type === 'progress') {
        const { data } = await supabaseClient.from('student_courses').select('course_name, progress').eq('student_id', userId);
        if (!data?.length) return null;

        return {
            type: 'bar', // UPGRADE: Bar is standard for completion
            data: {
                labels: data.map(c => c.course_name.split(' ')[0]),
                datasets: [{
                    label: 'Progress %',
                    data: data.map(c => c.progress || 0),
                    backgroundColor: theme.accent,
                    borderRadius: 8
                }]
            },
            // UPGRADE: Progress charts should NOT be reversed (0 at bottom, 100 at top)
            options: {
                ...getCommonOptions(theme, false),
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: theme.text, callback: (v) => v + '%' }
                    },
                    x: { grid: { display: false }, ticks: { color: theme.text } }
                }
            }
        };
    }
    return null;
}

function getCommonOptions(theme, reverseY) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: { 
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1e293b',
                padding: 12,
                cornerRadius: 8,
                displayColors: false
            }
        },
        scales: {
            y: { 
                reverse: reverseY, 
                grid: { color: theme.grid, drawTicks: false }, 
                border: { display: false },
                ticks: { color: theme.text, padding: 10, font: { size: 11, weight: '600' } } 
            },
            x: { 
                grid: { display: false }, 
                ticks: { color: theme.text, padding: 10, font: { size: 11, weight: '600' } } 
            }
        }
    }; 
}