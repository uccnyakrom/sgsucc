// ================================================================
//  js/dashboard.js — Dashboard Page
// ================================================================


// Returns current academic year e.g. "2025/2026"
// Rolls over on 1st August each year automatically
function getAcademicYear() {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = now.getMonth() + 1; // 1=Jan … 12=Dec
  const startY = month >= 8 ? year : year - 1;
  return `${startY}/${startY + 1}`;
}

async function renderDashboard() {
  const content = document.getElementById('page-content');

  // Fetch stats from Supabase in parallel
  const [
    { count: totalStudents },
    { count: issuedCerts },
    { count: pendingApproval },
    { count: duplicateFlags },
    { data: deptData },
    { data: recentLogs },
  ] = await Promise.all([
    db.from('students').select('*', { count:'exact', head:true }),
    db.from('certificate_issuance').select('*', { count:'exact', head:true }),
    db.from('qualified_students').select('*', { count:'exact', head:true })
      .eq('qualification_status','Pending'),
    db.from('students').select('*', { count:'exact', head:true })
      .eq('duplicate_flag', true),
    db.from('students').select('department').limit(500),
    db.from('audit_logs').select('*').order('created_at',{ascending:false}).limit(6),
  ]);

  // Department counts
  const deptCounts = {};
  (deptData || []).forEach(s => {
    deptCounts[s.department] = (deptCounts[s.department] || 0) + 1;
  });
  const topDepts = Object.entries(deptCounts)
    .sort((a,b) => b[1]-a[1]).slice(0, 5);
  const maxDept = topDepts.length ? topDepts[0][1] : 1;

  // Completion %
  const completionPct = totalStudents ? Math.round((issuedCerts / totalStudents) * 100) : 0;

  content.innerHTML = `
    <!-- Banner -->
    <div class="banner" style="margin-bottom:24px">
      <div>
        <div class="banner-eyebrow">Academic Year ${getAcademicYear()}</div>
        <div class="banner-title">Graduate Clearance Overview</div>
        <div class="banner-sub">Certificate issuance tracking · School of Graduate Studies</div>
      </div>
      <div class="banner-icon">
        <img src="favicon-96x96.png"
             alt="UCC Coat of Arms"
             style="width:72px;height:72px;object-fit:contain;
                    border-radius:50%;background:#fff;padding:6px;
                    box-shadow:0 4px 16px rgba(0,0,0,0.25)">
      </div>
    </div>

    <!-- Stat cards -->
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Total Students</span>
          <span class="stat-icon">👥</span>
        </div>
        <div class="stat-value">${totalStudents ?? 0}</div>
        <div class="stat-sub">Across all batches</div>
      </div>
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Certificates Issued</span>
          <span class="stat-icon" style="background:#DCFCE7">🏅</span>
        </div>
        <div class="stat-value" style="color:var(--success)">${issuedCerts ?? 0}</div>
        <div class="stat-sub">${completionPct}% completion rate</div>
      </div>
      <div class="stat-card">
        <div class="stat-top">
          <span class="stat-label">Pending Approval</span>
          <span class="stat-icon" style="background:#FEF9C3">⏳</span>
        </div>
        <div class="stat-value" style="color:var(--warning)">${pendingApproval ?? 0}</div>
        <div class="stat-sub">Awaiting review</div>
      </div>
      <div class="stat-card" style="cursor:pointer" onclick="navigateTo('duplicates')">
        <div class="stat-top">
          <span class="stat-label">Duplicate Flags</span>
          <span class="stat-icon" style="background:#FEE2E2">⚠️</span>
        </div>
        <div class="stat-value" style="color:var(--danger)">${duplicateFlags ?? 0}</div>
        <div class="stat-sub">Requires review →</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">

      <!-- Department bar chart -->
      <div class="card">
        <div class="card-header"><h3>Top Departments</h3></div>
        <div class="card-body">
          ${topDepts.length === 0
            ? `<div class="empty-state" style="padding:24px"><p>No data yet</p></div>`
            : `<div class="bar-chart">
                ${topDepts.map(([dept, count]) => `
                  <div class="bar-row">
                    <div class="bar-meta">
                      <span class="bar-name">${escHtml(dept)}</span>
                      <span class="bar-count">${count}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill"
                        style="width:${Math.round(count/maxDept*100)}%;
                               background:linear-gradient(90deg,var(--navy),var(--gold))">
                      </div>
                    </div>
                  </div>`).join('')}
              </div>`}
        </div>
      </div>

      <!-- Completion summary -->
      <div class="card">
        <div class="card-header"><h3>Issuance Summary</h3></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
          <div style="text-align:center;padding:20px;background:var(--gray-50);border-radius:10px">
            <div style="font-size:52px;font-weight:800;color:var(--navy);letter-spacing:-2px">${completionPct}%</div>
            <div style="font-size:13px;color:var(--gray-400);margin-top:4px">${issuedCerts} of ${totalStudents} certificates issued</div>
            <div class="progress-bar" style="margin-top:14px;height:10px">
              <div class="progress-fill"
                style="width:${completionPct}%;
                       background:${completionPct>=75?'var(--success)':completionPct>=50?'var(--gold)':'var(--danger)'}">
              </div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${[
              { label:'Approved',     perm: 'approve', icon:'✅', page:'students' },
              { label:'Pending Review', perm:null,     icon:'⏳', page:'students' },
              { label:'Duplicates',    perm:null,      icon:'⚠️', page:'duplicates' },
            ].map(r => `
              <div onclick="navigateTo('${r.page}')"
                style="display:flex;align-items:center;justify-content:space-between;
                       padding:10px 14px;background:var(--gray-50);border-radius:9px;cursor:pointer">
                <span style="font-size:13px;font-weight:600;color:var(--navy)">${r.icon} ${r.label}</span>
                <span style="font-size:12px;color:var(--gold);font-weight:700">View →</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card">
      <div class="card-header"><h3>Recent Activity</h3></div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Activity</th><th>User</th><th>Record</th><th>Time</th>
          </tr></thead>
          <tbody>
            ${(recentLogs || []).length === 0
              ? `<tr><td colspan="4"><div class="empty-state" style="padding:32px"><p>No activity yet</p></div></td></tr>`
              : (recentLogs || []).map(log => {
                const icon = log.activity.includes('sign') ? '🔐'
                  : log.activity.includes('Upload') ? '📤'
                  : log.activity.includes('ssued') ? '🏅'
                  : log.activity.includes('pprove') ? '✅'
                  : log.activity.includes('erif') ? '🔍' : '⚙️';
                return `<tr>
                  <td><span style="font-size:14px">${icon}</span> <strong>${escHtml(log.activity)}</strong></td>
                  <td style="font-size:12px;color:var(--gray-600)">${escHtml(log.user_name||'System')}</td>
                  <td style="font-size:12px;color:var(--gray-400);font-family:monospace">${escHtml(log.affected_record||'—')}</td>
                  <td style="font-size:12px;color:var(--gray-400)">${formatDate(log.created_at)}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
