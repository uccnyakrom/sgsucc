// ================================================================
//  js/reports.js — Reports & Exports Page
// ================================================================

async function renderReports() {
  const content = document.getElementById('page-content');

  const [
    { count: total },
    { count: issued },
    { count: pending },
    { data: facData },
  ] = await Promise.all([
    db.from('students').select('*', { count:'exact', head:true }),
    db.from('certificate_issuance').select('*', { count:'exact', head:true }),
    db.from('qualified_students').select('*', { count:'exact', head:true })
      .eq('qualification_status', 'Pending'),
    db.from('students_full').select('faculty,cert_status,approval_status').limit(1000),
  ]);

  // Faculty breakdown
  const facMap = {};
  (facData || []).forEach(s => {
    if (!facMap[s.faculty]) facMap[s.faculty] = { total:0, approved:0, issued:0, pending:0 };
    facMap[s.faculty].total++;
    if (s.approval_status === 'Approved') facMap[s.faculty].approved++;
    if (s.cert_status === 'Issued' || s.cert_status === 'Collected') facMap[s.faculty].issued++;
    if (s.approval_status === 'Pending') facMap[s.faculty].pending++;
  });

  const reportTypes = [
    { title:'Full Graduation List',     desc:'All qualified graduates with status',          icon:'📋' },
    { title:'Certificate Issuance Log', desc:'All issued certs with dates and numbers',      icon:'🏅' },
    { title:'Pending Issuance Report',  desc:'Approved students awaiting certificates',       icon:'⏳' },
    { title:'Duplicate Records Report', desc:'All flagged and resolved duplicate records',   icon:'⚠️' },
    { title:'Departmental Summary',     desc:'Graduates by department and faculty',          icon:'🏛️' },
    { title:'Audit Trail Export',       desc:'Full system activity log',                     icon:'🔍' },
  ];

  content.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Total Records</span><span class="stat-icon">📋</span></div>
        <div class="stat-value">${total??0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Certs Issued</span><span class="stat-icon" style="background:#DCFCE7">🏅</span></div>
        <div class="stat-value" style="color:var(--success)">${issued??0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Pending</span><span class="stat-icon" style="background:#FEF9C3">⏳</span></div>
        <div class="stat-value" style="color:var(--warning)">${pending??0}</div>
      </div>
    </div>

    <!-- Report types grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      ${reportTypes.map(r => `
        <div class="card" style="display:flex;align-items:center;gap:16px;padding:18px 20px">
          <div style="width:48px;height:48px;border-radius:12px;background:var(--gray-50);border:1px solid var(--gray-200);
               display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
            ${r.icon}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${r.title}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${r.desc}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-outline btn-sm" onclick="generateReport('${r.title}','pdf')">📄 PDF</button>
            <button class="btn btn-ghost btn-sm"   onclick="generateReport('${r.title}','excel')">📊 Excel</button>
          </div>
        </div>`).join('')}
    </div>

    <!-- Faculty breakdown -->
    <div class="card">
      <div class="card-header">
        <h3>Faculty Breakdown</h3>
        <button class="btn btn-gold btn-sm" onclick="generateReport('Faculty Breakdown','excel')">Export All</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Faculty</th><th>Total</th><th>Approved</th><th>Issued</th><th>Pending</th><th>Completion</th>
          </tr></thead>
          <tbody>
            ${Object.entries(facMap).map(([faculty, counts]) => {
              const pct = counts.total ? Math.round(counts.issued / counts.total * 100) : 0;
              const barColor = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--gold)' : 'var(--danger)';
              return `<tr>
                <td style="font-size:13px;font-weight:600;color:var(--navy)">${escHtml(faculty)}</td>
                <td style="font-size:13px;font-weight:700">${counts.total}</td>
                <td style="font-size:13px">${counts.approved}</td>
                <td style="font-size:13px;color:var(--success);font-weight:700">${counts.issued}</td>
                <td style="font-size:13px;color:var(--warning);font-weight:700">${counts.pending}</td>
                <td style="min-width:120px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div class="progress-bar" style="flex:1">
                      <div class="progress-fill" style="width:${pct}%;background:${barColor}"></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:var(--navy);min-width:32px">${pct}%</span>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function generateReport(title, format) {
  showToast(`📋 Generating "${title}" (${format.toUpperCase()})…`, 'info');

  // For a production build, you would:
  // PDF:   use jsPDF to build the document
  // Excel: use SheetJS (XLSX.utils.json_to_sheet) to build the workbook
  // Below is a working Excel export using SheetJS for the issuance log

  if (format === 'excel' && title === 'Certificate Issuance Log') {
    const { data } = await db.from('students_full')
      .select('student_index_number,full_name,programme,level,graduation_year,cert_status,certificate_number,issuance_date,collected_by')
      .not('certificate_number', 'is', null);

    if (!data || data.length === 0) { showToast('No issuance records to export', 'warning'); return; }

    const ws = XLSX.utils.json_to_sheet(data.map(s => ({
      'Index Number':     s.student_index_number,
      'Full Name':        s.full_name,
      'Programme':        s.programme,
      'Level':            s.level,
      'Year':             s.graduation_year,
      'Certificate No.':  s.certificate_number,
      'Issue Date':       s.issuance_date,
      'Status':           s.cert_status,
      'Collected By':     s.collected_by || '',
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Issuance Log');
    XLSX.writeFile(wb, `UCC_Certificate_Issuance_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('✅ Excel file downloaded', 'success');
    return;
  }

  // Generic message for other report types
  setTimeout(() => showToast(`✅ "${title}" ${format.toUpperCase()} ready — connect jsPDF/SheetJS to fully activate`, 'success'), 1200);
}


// ================================================================
//  js/audit.js — Audit Logs Page (included here for brevity)
// ================================================================

async function renderAudit() {
  if (!can('audit')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state"><div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3><p>Only Administrators and Auditors can view audit logs.</p></div>`;
    return;
  }

  const { data: logs, error } = await db
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw error;

  document.getElementById('page-content').innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>System Audit Trail</h3>
        <span style="font-size:13px;color:var(--gray-400)">${(logs||[]).length} entries (last 200)</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Timestamp</th><th>User</th><th>Role</th><th>Activity</th><th>Record</th>
          </tr></thead>
          <tbody>
            ${(logs||[]).length === 0
              ? `<tr><td colspan="5"><div class="empty-state"><p>No audit entries yet</p></div></td></tr>`
              : (logs||[]).map(log => `
                  <tr>
                    <td style="font-family:monospace;font-size:11px;color:var(--gray-400);white-space:nowrap">
                      ${new Date(log.created_at).toLocaleString('en-GB')}
                    </td>
                    <td style="font-size:13px;font-weight:600;color:var(--navy)">${escHtml(log.user_name||'System')}</td>
                    <td style="font-size:11px;color:var(--gray-400)">${escHtml(log.user_role||'—')}</td>
                    <td style="font-size:13px">${escHtml(log.activity)}</td>
                    <td style="font-size:12px;font-family:monospace;color:var(--gray-400)">${escHtml(log.affected_record||'—')}</td>
                  </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}


// ================================================================
//  js/users.js — User Management Page (included here for brevity)
// ================================================================

async function renderUsers() {
  if (!can('users')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state"><div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3><p>Only Super Administrators can manage users.</p></div>`;
    return;
  }

  const { data: users, error } = await db
    .from('user_profiles')
    .select('*')
    .order('created_at');

  if (error) throw error;

  document.getElementById('page-content').innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
      <button class="btn btn-gold" onclick="openAddUserModal()">➕ Add Staff User</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Staff Member</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${(users||[]).map(u => {
              const initials = u.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
              return `<tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--navy),var(--navy-mid));
                         color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">
                      ${initials}
                    </div>
                    <div>
                      <div style="font-size:13px;font-weight:600;color:var(--navy)">${escHtml(u.full_name)}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size:12px">${badge(u.is_active?'Approved':'Rejected')}<br>
                  <span style="font-size:11px;color:var(--gray-400)">${escHtml(u.role)}</span></td>
                <td style="font-size:12px;color:var(--gray-600)">${escHtml(u.department||'—')}</td>
                <td>${u.is_active ? badge('Active','Approved') : badge('Inactive','Rejected')}</td>
                <td>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">Edit Role</button>
                    ${u.id !== window.currentUser.id
                      ? `<button class="btn ${u.is_active?'btn-danger':'btn-success'} btn-sm"
                           onclick="toggleUser('${u.id}',${!u.is_active})">
                           ${u.is_active?'Deactivate':'Activate'}</button>` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openAddUserModal() {
  openModal(`
    <div class="modal-head">
      <h3>Add Staff User</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="alert alert-info" style="margin-bottom:20px">
        <span>ℹ️</span>
        <div>Create the user in <strong>Supabase → Authentication → Users</strong> first,
          then set their role here. Or use the fields below to invite via email.</div>
      </div>
      <div class="form-group">
        <label>Full Name <span style="color:var(--danger)">*</span></label>
        <input type="text" id="new-name" class="form-control" placeholder="e.g. Dr. Kwame Asante">
      </div>
      <div class="form-group">
        <label>Role <span style="color:var(--danger)">*</span></label>
        <select id="new-role" class="form-control">
          ${Object.values(ROLES).map(r => `<option>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Department</label>
        <input type="text" id="new-dept" class="form-control" placeholder="e.g. Graduate Studies">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="showToast('Create the user in Supabase Auth first, then their profile is auto-created.','info')">
        📧 Instructions
      </button>
    </div>
  `, '500px');
}

async function editUser(userId) {
  openModal(`
    <div class="modal-head">
      <h3>Edit User Role</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>New Role</label>
        <select id="edit-role" class="form-control">
          ${Object.values(ROLES).map(r => `<option>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Department</label>
        <input type="text" id="edit-dept" class="form-control" placeholder="Department">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="saveUserRole('${userId}')">Save Changes</button>
    </div>
  `, '440px');
}

async function saveUserRole(userId) {
  const role = document.getElementById('edit-role')?.value;
  const dept = document.getElementById('edit-dept')?.value;

  const { error } = await db.from('user_profiles').update({
    role, department: dept || null,
  }).eq('id', userId);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`User role updated to: ${role}`, userId, 'user_profiles');
  showToast('✅ User role updated', 'success');
  closeModal();
  await renderUsers();
}

async function toggleUser(userId, active) {
  const { error } = await db.from('user_profiles').update({ is_active: active }).eq('id', userId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`User account ${active?'activated':'deactivated'}`, userId, 'user_profiles');
  showToast(`✅ User ${active?'activated':'deactivated'}`, 'success');
  await renderUsers();
}
