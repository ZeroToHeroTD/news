// =============================================================================
// adminAnalytics.js — Dashboard Analytics & Chart Engine
// =============================================================================

import { supabase } from '../config.js';
import {
  getChartTheme, formatCurrency, getTimeAgo,
  avatarUrl, escapeHtml
} from '../utils.js';

let charts = {};

// ─── Destroy existing charts to prevent leaks ─────────────────────────────────
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ─── Main Init ────────────────────────────────────────────────────────────────
export async function initAnalytics(userStats) {
  await Promise.all([
    renderKPIs(userStats),
    renderGradeDistChart(),
    renderAttendanceTrendChart(),
    renderUserBreakdownChart(userStats),
    renderPaymentStatusChart(),
    renderRecentActivity(),
  ]);
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
async function renderKPIs(userStats) {
  // Total users
  const kpiUsers = document.getElementById('kpiTotalUsers');
  if (kpiUsers) kpiUsers.textContent = userStats.total;

  // Topbar focus cards
  const totalStudentsEl = document.getElementById('overviewTotalStudents');
  const totalInstructorsEl = document.getElementById('overviewTotalInstructors');
  const activeEl = document.getElementById('overviewActiveStudents');
  if (totalStudentsEl) totalStudentsEl.textContent = userStats.students;
  if (totalInstructorsEl) totalInstructorsEl.textContent = userStats.instructors;
  if (activeEl) activeEl.textContent = `${userStats.total} total members`;

  // Courses KPI
  const { data: courses } = await supabase.from('student_courses').select('id');
  const kpiCourses = document.getElementById('kpiTotalCourses');
  if (kpiCourses) kpiCourses.textContent = (courses || []).length;

  // Attendance KPI
  const { data: attRecords } = await supabase.from('attendance').select('status');
  if (attRecords && attRecords.length > 0) {
    const present = attRecords.filter(r => r.status === 'present').length;
    const avg = Math.round((present / attRecords.length) * 100);
    const kpiAtt = document.getElementById('kpiAvgAttendance');
    if (kpiAtt) kpiAtt.textContent = `${avg}%`;
  }

  // Revenue KPI
  const { data: payments } = await supabase
    .from('student_payments')
    .select('amount, status')
    .eq('status', 'Paid');
  const totalPaid = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const kpiRev = document.getElementById('kpiTotalRevenue');
  if (kpiRev) kpiRev.textContent = formatCurrency(totalPaid);

  // Grade dist course filter
  const { data: allCourses } = await supabase
    .from('student_courses')
    .select('course_name, course_code');
  const filter = document.getElementById('gradeDistFilter');
  if (filter && allCourses) {
    const uniqueCourses = [...new Set(allCourses.map(c => c.course_name))];
    filter.innerHTML = `<option value="all">All Courses</option>` +
      uniqueCourses.map(c => `<option value="${c}">${c}</option>`).join('');
    filter.addEventListener('change', () => renderGradeDistChart(filter.value === 'all' ? null : filter.value));
  }
}

// ─── Grade Distribution Chart ─────────────────────────────────────────────────
export async function renderGradeDistChart(courseFilter = null) {
  destroyChart('gradeDist');
  const canvas = document.getElementById('gradeDistChart');
  if (!canvas) return;

  const t = getChartTheme();
  let query = supabase.from('student_grades').select('numerical, status, course_name');
  if (courseFilter) query = query.eq('course_name', courseFilter);
  const { data: grades } = await query;

  const buckets = { '1.00-1.50': 0, '1.51-2.00': 0, '2.01-2.50': 0, '2.51-3.00': 0, 'Failed (>3.0)': 0 };
  (grades || []).forEach(g => {
    const n = parseFloat(g.numerical) || 0;
    if (!n) return;
    if (n <= 1.5) buckets['1.00-1.50']++;
    else if (n <= 2.0) buckets['1.51-2.00']++;
    else if (n <= 2.5) buckets['2.01-2.50']++;
    else if (n <= 3.0) buckets['2.51-3.00']++;
    else buckets['Failed (>3.0)']++;
  });

  charts.gradeDist = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: 'Students',
        data: Object.values(buckets),
        backgroundColor: [t.green, '#22c55e', t.amber, '#f97316', t.red],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: t.bg, titleColor: '#fff', bodyColor: '#e2e8f0', padding: 12, cornerRadius: 8 } },
      scales: {
        y: { grid: { color: t.grid }, ticks: { color: t.text, stepSize: 1 }, border: { display: false } },
        x: { grid: { display: false }, ticks: { color: t.text } }
      }
    }
  });
}

// ─── Attendance Trend Chart ───────────────────────────────────────────────────
async function renderAttendanceTrendChart() {
  destroyChart('attTrend');
  const canvas = document.getElementById('attendanceTrendChart');
  if (!canvas) return;

  const t = getChartTheme();
  const { data: att } = await supabase.from('attendance').select('status, date');

  // Handle Empty State gracefully
  if (!att || att.length === 0) {
    canvas.parentElement.innerHTML = '<div class="admin-empty-state">No attendance data yet</div>';
    return;
  }

  const monthly = {};
  att.forEach(r => {
    const month = r.date ? r.date.substring(0, 7) : 'Unknown';
    if (!monthly[month]) monthly[month] = { present: 0, absent: 0, total: 0 };
    monthly[month].total++;
    if (r.status === 'present') monthly[month].present++;
    if (r.status === 'absent') monthly[month].absent++;
  });

  // CRITICAL FIX: Sort chronologically before slicing
  const labels = Object.keys(monthly).sort().slice(-6); 
  
  const presentRates = labels.map(m => Math.round((monthly[m].present / monthly[m].total) * 100));
  const absentRates = labels.map(m => Math.round((monthly[m].absent / monthly[m].total) * 100));
  const displayLabels = labels.map(l => {
    const [y, m] = l.split('-');
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  charts.attTrend = new Chart(canvas, {
    type: 'line',
    data: {
      labels: displayLabels.length ? displayLabels : ['No Data'],
      datasets: [
        {
          label: 'Present %',
          data: presentRates.length ? presentRates : [0],
          borderColor: t.green, backgroundColor: 'rgba(34,197,94,0.08)',
          fill: true, tension: 0.4, pointRadius: 5, pointBorderColor: t.bg, pointBorderWidth: 2
        },
        {
          label: 'Absent %',
          data: absentRates.length ? absentRates : [0],
          borderColor: t.red, backgroundColor: 'rgba(239,68,68,0.08)',
          fill: true, tension: 0.4, pointRadius: 5, pointBorderColor: t.bg, pointBorderWidth: 2
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: t.text, boxWidth: 12 } }, tooltip: { backgroundColor: t.bg, titleColor: '#fff', bodyColor: '#e2e8f0', padding: 12, cornerRadius: 8 } },
      scales: {
        y: { min: 0, max: 100, grid: { color: t.grid }, ticks: { color: t.text, callback: v => v + '%' }, border: { display: false } },
        x: { grid: { display: false }, ticks: { color: t.text } }
      }
    }
  });
}

// ─── User Breakdown Doughnut ──────────────────────────────────────────────────
function renderUserBreakdownChart(userStats) {
  destroyChart('userBreakdown');
  const canvas = document.getElementById('userBreakdownChart');
  if (!canvas) return;

  const t = getChartTheme();

  charts.userBreakdown = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Students', 'Instructors', 'Admins'],
      datasets: [{
        data: [userStats.students, userStats.instructors, userStats.admins],
        backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(168,85,247,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: t.bg,
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: t.text, padding: 16, boxWidth: 12 } },
        tooltip: { backgroundColor: t.bg, titleColor: '#fff', bodyColor: '#e2e8f0', padding: 12, cornerRadius: 8 }
      },
      cutout: '65%',
    }
  });
}

// ─── Payment Status Chart ─────────────────────────────────────────────────────
async function renderPaymentStatusChart() {
  destroyChart('payStatus');
  const canvas = document.getElementById('paymentStatusChart');
  if (!canvas) return;

  const t = getChartTheme();
  const { data: payments } = await supabase.from('student_payments').select('status, amount');

  const totals = { Paid: 0, Pending: 0, Overdue: 0 };
  (payments || []).forEach(p => {
    const key = p.status in totals ? p.status : 'Pending';
    totals[key] += parseFloat(p.amount || 0);
  });

  charts.payStatus = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: ['Paid', 'Pending', 'Overdue'],
      datasets: [{
        data: [totals.Paid, totals.Pending, totals.Overdue],
        backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: t.bg,
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: t.text, padding: 12, boxWidth: 12 } },
        tooltip: {
          backgroundColor: t.bg, titleColor: '#fff', bodyColor: '#e2e8f0', padding: 12, cornerRadius: 8,
          callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` }
        }
      }
    }
  });
}

// ─── Recent Activity Log ──────────────────────────────────────────────────────
function renderRecentActivity() {
  const container = document.getElementById('recentActivityLog');
  if (!container) return;

  const logs = JSON.parse(localStorage.getItem('admin_activity_log') || '[]');

  if (!logs.length) {
    container.innerHTML = `<div class="admin-empty-state" style="padding:24px;">
      <span class="material-symbols-outlined" style="font-size:2rem; opacity:0.4;">history</span>
      <p style="margin:0; font-size:0.82rem;">No recent activity</p>
    </div>`;
    return;
  }

  container.innerHTML = logs.slice(0, 8).map(log => `
    <div class="admin-activity-item">
      <div class="admin-activity-dot" style="background:var(--primary);"></div>
      <div>
        <div class="admin-activity-text">${escapeHtml(log.action)}</div>
        <div class="admin-activity-time">${getTimeAgo(log.ts)} · ${escapeHtml(log.adminName)}</div>
      </div>
    </div>
  `).join('');
}

export { renderRecentActivity };