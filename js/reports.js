// ================================================================
//  js/reports.js — Reports & Exports (Full working downloads)
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
    { title:'Full Graduation List',      desc:'All qualified graduates with status',          icon:'📋', type:'graduation' },
    { title:'Certificate Issuance Log',  desc:'All issued certs with dates and numbers',      icon:'🏅', type:'issuance'  },
    { title:'Pending Issuance Report',   desc:'Approved students awaiting certificates',      icon:'⏳', type:'pending'   },
    { title:'Duplicate Records Report',  desc:'All flagged and resolved duplicate records',   icon:'⚠️', type:'duplicates' },
    { title:'Departmental Summary',      desc:'Graduates by department and faculty',          icon:'🏛️', type:'dept'      },
    { title:'Audit Trail Export',        desc:'Full system activity log',                     icon:'🔍', type:'audit'     },
  ];

  content.innerHTML = `
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

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      ${reportTypes.map(r => `
        <div class="card" style="display:flex;align-items:center;gap:16px;padding:18px 20px">
          <div style="width:48px;height:48px;border-radius:12px;background:var(--gray-50);
               border:1px solid var(--gray-200);display:flex;align-items:center;
               justify-content:center;font-size:22px;flex-shrink:0">${r.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${r.title}</div>
            <div style="font-size:12px;color:var(--gray-400);margin-top:2px">${r.desc}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-outline btn-sm" onclick="generateReport('${r.type}','pdf')">📄 PDF</button>
            <button class="btn btn-ghost btn-sm"   onclick="generateReport('${r.type}','excel')">📊 Excel</button>
          </div>
        </div>`).join('')}
    </div>

    <!-- Faculty breakdown -->
    <div class="card">
      <div class="card-header">
        <h3>Faculty Breakdown</h3>
        <button class="btn btn-gold btn-sm" onclick="generateReport('dept','excel')">⬇ Export Excel</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Faculty</th><th>Total</th><th>Approved</th>
            <th>Issued</th><th>Pending</th><th>Completion</th>
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

// ================================================================
//  GENERATE REPORT — Full working Excel & PDF for all types
// ================================================================
async function generateReport(type, format) {
  showToast(`⏳ Preparing ${format.toUpperCase()} report…`, 'info');

  try {
    // ── Fetch data based on report type ──────────────────────────
    let data = [], filename = '', sheetName = '', columns = [];

    if (type === 'graduation') {
      const { data: rows } = await db.from('students_full')
        .select('student_index_number,full_name,programme,department,faculty,level,graduation_year,graduation_batch,approval_status,cert_status,certificate_number,issuance_date')
        .order('full_name');
      data = (rows||[]).map(s => ({
        'Index Number':    s.student_index_number,
        'Full Name':       s.full_name,
        'Programme':       s.programme,
        'Department':      s.department,
        'Faculty':         s.faculty,
        'Level':           s.level,
        'Graduation Year': s.graduation_year,
        'Batch':           s.graduation_batch,
        'Approval Status': s.approval_status || 'Pending',
        'Cert Status':     s.cert_status || 'Not Initiated',
        'Certificate No.': s.certificate_number || '',
        'Issue Date':      s.issuance_date || '',
      }));
      filename = `UCC_Graduation_List_${today()}`;
      sheetName = 'Graduation List';
      columns = [22,30,40,26,20,10,16,14,16,16,22,14];

    } else if (type === 'issuance') {
      const { data: rows } = await db.from('students_full')
        .select('student_index_number,full_name,programme,level,graduation_year,graduation_batch,cert_status,certificate_number,issuance_date,collected_by,collection_date')
        .not('certificate_number','is',null)
        .order('issuance_date', { ascending: false });
      data = (rows||[]).map(s => ({
        'Index Number':    s.student_index_number,
        'Full Name':       s.full_name,
        'Programme':       s.programme,
        'Level':           s.level,
        'Year':            s.graduation_year,
        'Batch':           s.graduation_batch,
        'Certificate No.': s.certificate_number,
        'Issue Date':      s.issuance_date || '',
        'Status':          s.cert_status,
        'Collected By':    s.collected_by || '',
        'Collection Date': s.collection_date || '',
      }));
      filename = `UCC_Certificate_Issuance_Log_${today()}`;
      sheetName = 'Issuance Log';
      columns = [22,30,40,10,10,12,24,14,12,24,14];

    } else if (type === 'pending') {
      const { data: rows } = await db.from('students_full')
        .select('student_index_number,full_name,programme,department,faculty,level,graduation_year,graduation_batch,approval_status')
        .eq('approval_status','Approved')
        .is('certificate_number',null)
        .order('full_name');
      data = (rows||[]).map(s => ({
        'Index Number':    s.student_index_number,
        'Full Name':       s.full_name,
        'Programme':       s.programme,
        'Department':      s.department,
        'Faculty':         s.faculty,
        'Level':           s.level,
        'Year':            s.graduation_year,
        'Batch':           s.graduation_batch,
        'Approval Status': s.approval_status,
      }));
      filename = `UCC_Pending_Issuance_${today()}`;
      sheetName = 'Pending Issuance';
      columns = [22,30,40,26,20,10,10,14,16];

    } else if (type === 'duplicates') {
      const { data: rows } = await db.from('students_full')
        .select('student_index_number,full_name,programme,level,graduation_year,graduation_batch,approval_status,duplicate_flag')
        .eq('duplicate_flag', true)
        .order('student_index_number');
      data = (rows||[]).map(s => ({
        'Index Number':    s.student_index_number,
        'Full Name':       s.full_name,
        'Programme':       s.programme,
        'Level':           s.level,
        'Year':            s.graduation_year,
        'Batch':           s.graduation_batch,
        'Status':          s.approval_status || 'Pending',
        'Duplicate Flag':  s.duplicate_flag ? 'Yes' : 'Resolved',
      }));
      filename = `UCC_Duplicate_Records_${today()}`;
      sheetName = 'Duplicate Records';
      columns = [22,30,40,10,10,14,14,14];

    } else if (type === 'dept') {
      const { data: rows } = await db.from('students_full')
        .select('department,faculty,level,approval_status,cert_status')
        .limit(2000);
      const deptMap = {};
      (rows||[]).forEach(s => {
        const key = s.department || 'Unknown';
        if (!deptMap[key]) deptMap[key] = { department:key, faculty:s.faculty||'', total:0, approved:0, issued:0, pending:0 };
        deptMap[key].total++;
        if (s.approval_status === 'Approved') deptMap[key].approved++;
        if (s.cert_status === 'Issued' || s.cert_status === 'Collected') deptMap[key].issued++;
        if (s.approval_status === 'Pending') deptMap[key].pending++;
      });
      data = Object.values(deptMap).sort((a,b) => b.total - a.total).map(d => ({
        'Department':   d.department,
        'Faculty':      d.faculty,
        'Total':        d.total,
        'Approved':     d.approved,
        'Issued':       d.issued,
        'Pending':      d.pending,
        'Completion %': d.total ? Math.round(d.issued/d.total*100)+'%' : '0%',
      }));
      filename = `UCC_Departmental_Summary_${today()}`;
      sheetName = 'Dept Summary';
      columns = [32,24,10,12,10,10,14];

    } else if (type === 'audit') {
      const { data: rows } = await db.from('audit_logs')
        .select('created_at,user_name,user_role,activity,affected_record')
        .order('created_at', { ascending: false })
        .limit(500);
      data = (rows||[]).map(l => ({
        'Timestamp':       l.created_at ? formatDateTime(l.created_at) : '',
        'User':            l.user_name  || 'System',
        'Role':            l.user_role  || '',
        'Activity':        l.activity   || '',
        'Affected Record': l.affected_record || '',
      }));
      filename = `UCC_Audit_Trail_${today()}`;
      sheetName = 'Audit Trail';
      columns = [24,26,24,40,30];
    }

    if (!data.length) {
      showToast('No data found for this report.', 'warning');
      return;
    }

    if (format === 'excel') {
      exportExcel(data, filename, sheetName, columns);
    } else {
      exportPDF(data, filename, type);
    }

  } catch (err) {
    showToast('Error generating report: ' + err.message, 'error');
    console.error(err);
  }
}

// ================================================================
//  EXCEL EXPORT — uses SheetJS (already loaded via CDN)
// ================================================================
function exportExcel(data, filename, sheetName, colWidths) {
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws['!cols'] = (colWidths || []).map(w => ({ wch: w }));

  // Style header row bold (SheetJS CE supports basic column widths, not cell styles)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
  showToast(`✅ Excel downloaded: ${filename}.xlsx`, 'success');
}

// ================================================================
//  PDF EXPORT — using jsPDF (loaded via CDN in index.html)
// ================================================================
function exportPDF(data, filename, type) {
  // Check jsPDF is available
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    showToast('PDF library loading… please try again in a moment.', 'warning');
    // Load jsPDF dynamically if not present
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const script2 = document.createElement('script');
      script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      script2.onload = () => exportPDF(data, filename, type);
      document.head.appendChild(script2);
    };
    document.head.appendChild(script);
    return;
  }

  const { jsPDF } = window.jspdf || window;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  const titleMap = {
    graduation:  'Full Graduation List',
    issuance:    'Certificate Issuance Log',
    pending:     'Pending Issuance Report',
    duplicates:  'Duplicate Records Report',
    dept:        'Departmental Summary',
    audit:       'Audit Trail Export',
  };

  // Navy header bar
  doc.setFillColor(0, 33, 71);
  doc.rect(0, 0, 297, 24, 'F');

  // UCC title
  doc.setTextColor(200, 146, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('UNIVERSITY OF CAPE COAST', 14, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text(titleMap[type] || 'Report', 14, 17);

  // Date top right
  doc.setFontSize(8);
  doc.setTextColor(200, 146, 42);
  doc.text(`Generated: ${formatDate(new Date())}  ${formatTime(new Date())}`, 283, 9, { align: 'right' });
  doc.setTextColor(200, 200, 200);
  doc.text('School of Graduate Studies', 283, 17, { align: 'right' });

  // Table
  const headers = Object.keys(data[0]);
  const rows    = data.map(r => Object.values(r).map(v => String(v || '')));

  doc.autoTable({
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2.5, font: 'helvetica', overflow: 'linebreak' },
    headStyles: { fillColor: [0,33,71], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [241,245,249] },
    margin: { left: 14, right: 14 },
    tableLineColor: [200,200,200],
    tableLineWidth: 0.1,
    didDrawPage: (hookData) => {
      // Footer on every page
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `School of Graduate Studies  |  University of Cape Coast  |  Page ${hookData.pageNumber} of ${pageCount}`,
        148, doc.internal.pageSize.height - 8, { align: 'center' }
      );
      // Gold footer line
      doc.setDrawColor(200, 146, 42);
      doc.setLineWidth(0.5);
      doc.line(14, doc.internal.pageSize.height - 12, 283, doc.internal.pageSize.height - 12);
    }
  });

  doc.save(`${filename}.pdf`);
  showToast(`✅ PDF downloaded: ${filename}.pdf`, 'success');
}

// ── Helper ──────────────────────────────────────────────────────
function today() {
  // Use Ghana timezone for file naming dates
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
}


// ================================================================
//  AUDIT PAGE
// ================================================================
async function renderAudit() {
  if (!can('audit')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3>
        <p>Only Administrators and Auditors can view audit logs.</p>
      </div>`;
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
        <div style="display:flex;gap:8px">
          <span style="font-size:13px;color:var(--gray-400);align-self:center">${(logs||[]).length} entries (last 200)</span>
          <button class="btn btn-gold btn-sm" onclick="generateReport('audit','excel')">⬇ Export Excel</button>
          <button class="btn btn-outline btn-sm" onclick="generateReport('audit','pdf')">📄 PDF</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Timestamp</th><th>User</th><th>Role</th><th>Activity</th><th>Record</th>
          </tr></thead>
          <tbody>
            ${!(logs||[]).length
              ? `<tr><td colspan="5"><div class="empty-state"><p>No audit entries yet</p></div></td></tr>`
              : (logs||[]).map(log => `
                <tr>
                  <td style="font-family:monospace;font-size:11px;color:var(--gray-400);white-space:nowrap">
                    ${formatDateTime(log.created_at)}
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
//  USERS PAGE
// ================================================================
async function renderUsers() {
  if (!can('users')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3>
        <p>Only Super Administrators can manage users.</p>
      </div>`;
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
                    <div style="width:34px;height:34px;border-radius:50%;
                         background:linear-gradient(135deg,var(--navy),var(--navy-mid));
                         color:#fff;display:flex;align-items:center;justify-content:center;
                         font-size:11px;font-weight:800">${initials}</div>
                    <div style="font-size:13px;font-weight:600;color:var(--navy)">${escHtml(u.full_name)}</div>
                  </div>
                </td>
                <td style="font-size:12px;color:var(--gray-600)">${escHtml(u.role)}</td>
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
      <div class="alert alert-info" style="margin-bottom:16px">
        <span>ℹ️</span>
        <div>Create the user in <strong>Supabase → Authentication → Users</strong> first
          (email + password <code>UCC@2025!</code> + tick Auto Confirm),
          then their profile is created automatically.</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `, '480px');
}

async function editUser(userId) {
  const { data: profile } = await db.from('user_profiles').select('*').eq('id', userId).single();
  openModal(`
    <div class="modal-head">
      <h3>Edit User: ${escHtml(profile?.full_name||'')}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Role</label>
        <select id="edit-role" class="form-control">
          ${['Super Administrator','Graduate School Administrator','Verification Officer',
             'Certificate Issuance Officer','Read-Only Auditor']
            .map(r => `<option ${profile?.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>Department</label>
        <input type="text" id="edit-dept" class="form-control"
          value="${escHtml(profile?.department||'')}" placeholder="Department name">
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
  const { error } = await db.from('user_profiles')
    .update({ role, department: dept || null })
    .eq('id', userId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`User role updated to: ${role}`, userId, 'user_profiles');
  showToast('✅ User role updated', 'success');
  closeModal();
  await renderUsers();
}

async function toggleUser(userId, active) {
  const { error } = await db.from('user_profiles')
    .update({ is_active: active })
    .eq('id', userId);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`User account ${active?'activated':'deactivated'}`, userId, 'user_profiles');
  showToast(`✅ User ${active?'activated':'deactivated'}`, 'success');
  await renderUsers();
}
