// =============================================================================
// grades.js — Academic Records & Performance Analytics (LIVE SYNC UPGRADE)
// =============================================================================

import { supabase as supabaseClient } from './config.js';
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
                <tr class="grade-row" style="animation: slideInRight 0.4s ease forwards ${idx * 0.05}s; opacity: 0;">
                    <td class="col-course" style="font-weight:700; color:var(--text-main);">${g.course_name}</td>
                    <td class="col-instructor" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">${g.instructor_name || 'TBA'}</td>
                    <td class="col-term" style="font-weight: 600;">${g.midterm ?? '--'}%</td>
                    <td class="col-term" style="font-weight: 600;">${g.finals ?? '--'}%</td>
                    <td class="col-grade" style="font-weight: 800; font-family: var(--font-mono, monospace); color: var(--text-main);">${display}</td>
                    <td class="col-status"><span class="status-badge ${badgeClass}">${status}</span></td>
                </tr>`;
        }).join('');

        if (gradedCount > 0 && gwaDisplay) {
            const finalGwa = (totalNum / gradedCount).toFixed(2);
            gwaDisplay.textContent = finalGwa;
            if (typeof updateGwaComparison === 'function') updateGwaComparison(parseFloat(finalGwa));
        }
    } catch (err) { 
        console.error("Grades Engine Error:", err.message); 
    }
}

function renderEmptyTable(body, display) {
    body.innerHTML = `<tr><td colspan="6" class="empty-cell" style="text-align:center; padding:60px; color:var(--text-muted);">No academic records found.</td></tr>`;
    if (display) display.textContent = '--';
}

// ==========================================
// 3. PERFORMANCE CHART ENGINE (LIVE UPGRADE)
// ==========================================

export function initializeChartListener(userId) {
    const filter = document.getElementById('chartFilter');
    if (!filter) return;

    filter.addEventListener('change', (e) => {
        loadPerformanceChart(userId, e.target.value);
    });
}

export async function loadPerformanceChart(userId, filterType = 'grades') {
    const canvas = document.getElementById('performanceChart');
    const placeholder = document.getElementById('chartPlaceholder');
    
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

    const ctx = canvas.getContext('2d');

    try {
        // 1. Instantly hide the ugly HTML text placeholder if it exists
        if (placeholder) placeholder.style.display = 'none';
        
        // 2. Show the canvas and draw a sleek loading text directly on it
        canvas.style.display = 'block';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "600 14px 'Sora', sans-serif";
        ctx.fillStyle = theme.text;
        ctx.textAlign = "center";
        ctx.fillText("Loading chart data...", canvas.width / 2, canvas.height / 2);

        // 3. Fetch data
        const config = await getChartConfig(userId, filterType, theme, isDark);
        
        // 4. Render chart or empty state
        if (config) {
            myChart = new Chart(canvas, config);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillText("No analytical data available yet", canvas.width / 2, canvas.height / 2);
        }
    } catch (err) {
        console.error("Chart Engine Error:", err.message);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillText("Failed to load chart", canvas.width / 2, canvas.height / 2);
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
                    backgroundColor: 'rgba(0, 98, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: theme.accent,
                    pointBorderColor: theme.bg,
                    pointBorderWidth: 3
                }]
            },
            options: getCommonOptions(theme, true) // Reversed for Grades (1.0 is at the top)
        };
    } 
    
    if (type === 'progress') {
        const { data } = await supabaseClient.from('student_courses').select('course_name, progress').eq('student_id', userId);
        if (!data?.length) return null;

        return {
            type: 'bar',
            data: {
                labels: data.map(c => c.course_name.split(' ')[0]),
                datasets: [{
                    label: 'Progress %',
                    data: data.map(c => c.progress || 0),
                    backgroundColor: theme.accent,
                    borderRadius: 8
                }]
            },
            options: {
                ...getCommonOptions(theme, false),
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        grid: { color: theme.grid, drawTicks: false },
                        border: { display: false },
                        ticks: { color: theme.text, padding: 10, font: { size: 11, weight: '600' }, callback: (v) => v + '%' }
                    },
                    x: { grid: { display: false }, ticks: { color: theme.text, font: { size: 11, weight: '600' } } }
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
                backgroundColor: theme.bg === '#ffffff' ? '#1e293b' : '#334155',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0',
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