/* ============================================================
   dashboard-patch.js
   Drop this AFTER your existing app.js <script> tag.
   It patches loadGradesData, loadDeadlines, and loadPaymentData
   rendering so they use the new premium UI.
   ============================================================ */

(function () {
  "use strict";

  /* ---- Helpers ---- */
  function getPHNumericalGrade(avg) {
    if (avg >= 97) return 1.0;
    if (avg >= 94) return 1.25;
    if (avg >= 91) return 1.5;
    if (avg >= 88) return 1.75;
    if (avg >= 85) return 2.0;
    if (avg >= 82) return 2.25;
    if (avg >= 79) return 2.5;
    if (avg >= 76) return 2.75;
    if (avg >= 75) return 3.0;
    return 5.0;
  }

  function gradeClass(numGrade) {
    if (numGrade <= 1.75) return "grade-high";
    if (numGrade <= 2.5)  return "grade-mid";
    if (numGrade <= 3.0)  return "grade-low";
    return "grade-low";
  }

  function pctColor(pct) {
    if (pct >= 85) return "#10b981";
    if (pct >= 70) return "#f59e0b";
    return "#ef4444";
  }

  function daysFromNow(dateStr) {
    const ms = new Date(dateStr) - new Date();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  function formatPHP(amount) {
    return "₱" + parseFloat(amount).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /* ====================================================
     GRADES — Wrap table in premium shell + add GWA bar
     ==================================================== */
  function upgradeGradesView() {
    const view = document.getElementById("view-grades");
    if (!view) return;
    const card = view.querySelector(".section-card");
    if (!card || card.dataset.upgraded) return;
    card.dataset.upgraded = "1";

    // Inject GWA summary bar above table
    const gwaBar = document.createElement("div");
    gwaBar.className = "gwa-summary-bar";
    gwaBar.id = "gwaStatBar";
    gwaBar.innerHTML = `
      <div class="gwa-stat-pill blue">
        <small>Current GWA</small>
        <strong id="gwaPillCurrent">--</strong>
      </div>
      <div class="gwa-stat-pill green">
        <small>Target GWA</small>
        <strong id="gwaPillTarget">--</strong>
      </div>
      <div class="gwa-stat-pill amber">
        <small>Courses Loaded</small>
        <strong id="gwaPillCount">--</strong>
      </div>
      <div class="gwa-stat-pill">
        <small>Status</small>
        <strong id="gwaPillStatus" style="font-size:1rem;">--</strong>
      </div>`;

    // Wrap the table
    const tableWrap = document.createElement("div");
    tableWrap.className = "grades-table-wrapper";

    const existingTableParent = card.querySelector("div[style*='overflow-x']") || card;
    const existingTable = card.querySelector(".grades-table");
    if (existingTable) {
      existingTable.parentNode.insertBefore(tableWrap, existingTable);
      tableWrap.appendChild(existingTable);
    }

    // Insert GWA bar before the wrap
    card.insertBefore(gwaBar, tableWrap);

    // Observer: when tbody content changes, re-render enhanced rows
    observeGradesTable();
  }

  function observeGradesTable() {
    const tbody = document.getElementById("gradesTableBody");
    if (!tbody) return;
    const observer = new MutationObserver(() => enhanceGradesRows());
    observer.observe(tbody, { childList: true, subtree: true });
    // Also run immediately in case data already loaded
    enhanceGradesRows();
  }

  function enhanceGradesRows() {
    const tbody = document.getElementById("gradesTableBody");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr:not([data-enhanced])");
    if (rows.length === 0) return;

    let totalGrade = 0, count = 0, passedCount = 0;

    rows.forEach(row => {
      row.dataset.enhanced = "1";
      const cells = row.querySelectorAll("td");
      if (cells.length < 5) return;

      const midtermCell  = cells[1];
      const finalsCell   = cells[2];
      const gradeCell    = cells[3];
      const statusCell   = cells[4];

      // --- Midterm & Finals cells: add bar ---
      [midtermCell, finalsCell].forEach(cell => {
        const raw = cell.textContent.trim();
        const pct = parseInt(raw);
        if (!isNaN(pct) && raw.endsWith("%")) {
          const color = pctColor(pct);
          cell.innerHTML = `
            <div class="grade-pct-wrap">
              <div class="grade-pct-bar">
                <div class="grade-pct-fill" style="width:${pct}%; background:${color};"></div>
              </div>
              <span class="grade-pct-text">${raw}</span>
            </div>`;
        }
      });

      // --- Grade cell: wrap in pill ---
      const gradeRaw = gradeCell.textContent.trim();
      const numGrade = parseFloat(gradeRaw);
      if (!isNaN(numGrade)) {
        gradeCell.innerHTML = `<span class="grade-num ${gradeClass(numGrade)}">${gradeRaw}</span>`;
        totalGrade += numGrade;
        count++;
      } else if (gradeRaw === "TBA") {
        gradeCell.innerHTML = `<span class="grade-num grade-tba">TBA</span>`;
      }

      // --- Status cell: upgrade badge ---
      const statusRaw = statusCell.textContent.trim().toLowerCase();
      const badgeClass = statusRaw.includes("pass") ? "passed" :
                         statusRaw.includes("fail") ? "failed" : "progress";
      if (badgeClass === "passed") passedCount++;
      const icon = badgeClass === "passed" ? "✓" : badgeClass === "failed" ? "✗" : "·";
      statusCell.innerHTML = `
        <span class="grade-status-badge ${badgeClass}">${statusRaw === "in progress" ? "In Progress" : statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1)}</span>`;
    });

    // Update GWA pill
    const gwa = count > 0 ? (totalGrade / count).toFixed(2) : "--";
    const pilCur = document.getElementById("gwaPillCurrent");
    const pilCnt = document.getElementById("gwaPillCount");
    const pilSta = document.getElementById("gwaPillStatus");
    const pilTgt = document.getElementById("gwaPillTarget");

    if (pilCur) pilCur.textContent = gwa;
    if (pilCnt) pilCnt.textContent = count;
    if (pilSta) {
      const gwaNum = parseFloat(gwa);
      pilSta.textContent = gwaNum <= 2.0 ? "🏆 Excellent" :
                           gwaNum <= 3.0 ? "✅ Passing"   : "⚠️ At Risk";
    }

    // Sync target GWA from existing element
    const tgtEl = document.getElementById("targetGwaDisplay");
    if (tgtEl && pilTgt) pilTgt.textContent = tgtEl.textContent || "--";
  }

  /* ====================================================
     DEADLINES — Rebuild each item with new structure
     ==================================================== */
  function observeDeadlines() {
    const container = document.getElementById("deadlinesContainer");
    if (!container) return;
    const observer = new MutationObserver(() => enhanceDeadlineItems());
    observer.observe(container, { childList: true, subtree: false });
    enhanceDeadlineItems();
  }

  function enhanceDeadlineItems() {
    const container = document.getElementById("deadlinesContainer");
    if (!container) return;
    const items = container.querySelectorAll(".deadline-item:not([data-enhanced])");
    items.forEach(item => {
      item.dataset.enhanced = "1";

      // Add accent strip at the start
      if (!item.querySelector(".deadline-accent-strip")) {
        const strip = document.createElement("div");
        strip.className = "deadline-accent-strip";
        item.insertBefore(strip, item.firstChild);
      }

      // Add right meta column
      if (!item.querySelector(".deadline-meta-right")) {
        const info = item.querySelector(".deadline-info");
        const dueEl = item.querySelector(".deadline-due");

        let days = null;
        if (dueEl) {
          const txt = dueEl.textContent.trim();
          if (txt.includes("OVERDUE"))  days = "OVR";
          else if (txt.includes("today")) days = "0";
          else if (txt.includes("tomorrow")) days = "1";
          else {
            const m = txt.match(/(\d+)\s*day/);
            if (m) days = m[1];
          }
        }

        const meta = document.createElement("div");
        meta.className = "deadline-meta-right";
        let daysClass = "blue";
        if (days === "OVR") daysClass = "red";
        else if (days !== null && parseInt(days) <= 2) daysClass = "amber";

        meta.innerHTML = `
          <div class="deadline-days-num ${daysClass}">${days === "OVR" ? "!" : (days !== null ? days : "·")}</div>
          <div class="deadline-days-label">${days === "OVR" ? "Overdue" : (days === "0" ? "Today" : days === "1" ? "Tomorrow" : "Days left")}</div>`;
        item.appendChild(meta);
      }
    });
  }

  /* ====================================================
     PAYMENTS — Upgrade table cells + add info row
     ==================================================== */
  function observePayments() {
    const tbody = document.getElementById("paymentsTableBody");
    if (!tbody) return;
    const observer = new MutationObserver(() => enhancePaymentRows());
    observer.observe(tbody, { childList: true, subtree: true });
    enhancePaymentRows();

    // Insert info row once
    injectPaymentInfoRow();
  }

  function injectPaymentInfoRow() {
    const view = document.getElementById("view-payments");
    if (!view || view.dataset.infoInjected) return;
    view.dataset.infoInjected = "1";

    const summaryRow = view.querySelector(".payment-summary-row");
    if (!summaryRow) return;

    const infoRow = document.createElement("div");
    infoRow.className = "payment-info-row";
    infoRow.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:1rem;">info</span>
      <span>For payment concerns or disputes, please contact the Finance Office or your instructor directly.</span>`;
    summaryRow.insertAdjacentElement("afterend", infoRow);

    // Wrap table
    const tableContainer = view.querySelector("div[style*='overflow-x']");
    if (tableContainer && !tableContainer.classList.contains("payments-table-wrap")) {
      tableContainer.classList.add("payments-table-wrap");
    }
  }

  function enhancePaymentRows() {
    const tbody = document.getElementById("paymentsTableBody");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr:not([data-enhanced])");
    rows.forEach(row => {
      row.dataset.enhanced = "1";
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) return;

      // Amount cell (index 1)
      const amtCell = cells[1];
      amtCell.classList.add("pay-td-amount");

      // Due date cell (index 2)
      cells[2].classList.add("pay-td-date");

      // Status cell already handled by CSS classes — just ensure the badge has the dot
      const statusCell = cells[3];
      const badge = statusCell.querySelector(".payment-status");
      if (badge && !badge.dataset.enhanced) {
        badge.dataset.enhanced = "1";
        // Classes already applied — the ::before pseudo handles the dot
      }
    });
  }

  /* ====================================================
     BOOT — Run after a short delay to let app.js load
     ==================================================== */
  function boot() {
    upgradeGradesView();
    observeGradesTable();
    observeDeadlines();
    observePayments();

    // Re-run when views become active (hash routing)
    window.addEventListener("hashchange", () => {
      setTimeout(() => {
        enhanceGradesRows();
        enhanceDeadlineItems();
        enhancePaymentRows();
        injectPaymentInfoRow();
      }, 150);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400));
  } else {
    setTimeout(boot, 400);
  }
})();