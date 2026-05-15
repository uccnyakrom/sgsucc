// ================================================================
//  js/issuance.js — Certificate Issuance Module
// ================================================================

let allIssuanceStudents = [];

async function renderIssuance() {
  const content = document.getElementById('page-content');

  // Fetch all approved students
  const { data, error } = await db
    .from('students_full')
    .select('*')
    .eq('approval_status', 'Approved')
    .order('full_name');

  if (error) throw error;
  allIssuanceStudents = data || [];

  const issued    = allIssuanceStudents.filter(s => s.cert_status === 'Issued').length;
  const collected = allIssuanceStudents.filter(s => s.cert_status === 'Collected').length;
  const pending   = allIssuanceStudents.filter(s => !s.cert_status || s.cert_status === 'Not Initiated').length;

  content.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Pending Issuance</span><span class="stat-icon" style="background:#FEF9C3">⏳</span></div>
        <div class="stat-value" style="color:var(--warning)">${pending}</div>
        <div class="stat-sub">Approved but not yet issued</div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Issued (Uncollected)</span><span class="stat-icon" style="background:#DBEAFE">🏅</span></div>
        <div class="stat-value" style="color:var(--info)">${issued}</div>
        <div class="stat-sub">Awaiting collection</div>
      </div>
      <div class="stat-card">
        <div class="stat-top"><span class="stat-label">Collected</span><span class="stat-icon" style="background:#DCFCE7">✅</span></div>
        <div class="stat-value" style="color:var(--success)">${collected}</div>
        <div class="stat-sub">Fully completed</div>
      </div>
    </div>

    <!-- Filters + table -->
    <div class="card">
      <div class="card-header">
        <h3>Approved Students — Certificate Status</h3>
        <input type="search" id="issue-search" placeholder="🔍 Search…"
          oninput="filterIssuance()"
          style="padding:7px 12px;border-radius:8px;border:1.5px solid var(--gray-200);font-size:13px;width:200px">
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Student</th><th>Programme</th><th>Level</th>
            <th>Certificate No.</th><th>Issue Date</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody id="issuance-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  filterIssuance();
}

function filterIssuance() {
  const q = (document.getElementById('issue-search')?.value || '').toLowerCase();
  const filtered = allIssuanceStudents.filter(s =>
    !q || s.full_name?.toLowerCase().includes(q) || s.student_index_number?.toLowerCase().includes(q)
  );

  const tbody = document.getElementById('issuance-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔍</div><h3>No records found</h3></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const certStatus = s.cert_status || 'Not Initiated';
    return `<tr>
      <td>
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${escHtml(s.full_name)}</div>
        <div style="font-size:11px;color:var(--gray-400);font-family:monospace">${escHtml(s.student_index_number)}</div>
      </td>
      <td style="font-size:12px;color:var(--gray-600)">${escHtml(s.programme)}</td>
      <td style="font-size:12px">${escHtml(s.level)}</td>
      <td style="font-size:12px;font-family:monospace;font-weight:600;color:var(--navy)">${escHtml(s.certificate_number)||'—'}</td>
      <td style="font-size:12px">${formatDate(s.issuance_date)}</td>
      <td>${badge(certStatus)}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${can('issue') && certStatus === 'Not Initiated'
            ? `<button class="btn btn-gold btn-sm" onclick="openIssueModal('${s.id}')">🏅 Issue</button>`
            : ''}
          ${can('issue') && certStatus === 'Issued'
            ? `<button class="btn btn-success btn-sm" onclick="markCollected('${s.id}')">✅ Mark Collected</button>`
            : ''}
          ${certStatus === 'Collected'
            ? `${badge('Collected')}`
            : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ---- Issue certificate modal ----
function openIssueModal(studentId) {
  const s = allIssuanceStudents.find(x => x.id === studentId);
  if (!s) return;

  // Auto-generate certificate number
  const prefix = s.level === 'PhD' ? 'PhD' : s.level === 'MPhil' ? 'MPhil' : 'MSc';
  const autoCertNum = `UCC-${prefix}-${s.graduation_year}-${String(Math.floor(Math.random()*9000)+1000)}`;

  openModal(`
    <div class="modal-head">
      <h3>🏅 Issue Certificate</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="padding:14px;background:var(--gray-50);border-radius:10px;margin-bottom:20px">
        <div style="font-weight:700;color:var(--navy);font-size:15px">${escHtml(s.full_name)}</div>
        <div style="font-size:13px;color:var(--gray-600)">${escHtml(s.programme)}</div>
        <div style="font-size:12px;color:var(--gray-400);font-family:monospace">${escHtml(s.student_index_number)}</div>
      </div>
      <div class="form-group">
        <label>Certificate Number <span style="color:var(--danger)">*</span></label>
        <input type="text" id="cert-num" class="form-control" value="${autoCertNum}"
          placeholder="e.g. UCC-MSc-2024-0001">
        <small style="color:var(--gray-400)">Edit if needed. Must be unique.</small>
      </div>
      <div class="form-group">
        <label>Collected By (if collecting in person)</label>
        <input type="text" id="collected-by" class="form-control"
          placeholder="Full name of person collecting the certificate">
      </div>
      <div class="alert alert-warning" style="margin-top:8px">
        <span>⚠️</span>
        <div>This action is <strong>permanent</strong>. A certificate number cannot be reused once recorded.</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="confirmIssue('${studentId}')">🏅 Confirm & Issue</button>
    </div>
  `, '500px');
}

async function confirmIssue(studentId) {
  const certNum     = document.getElementById('cert-num')?.value.trim();
  const collectedBy = document.getElementById('collected-by')?.value.trim();

  if (!certNum) { showToast('Please enter a certificate number', 'warning'); return; }

  const s = allIssuanceStudents.find(x => x.id === studentId);

  const { error } = await db.from('certificate_issuance').upsert({
    student_id:        studentId,
    certificate_number: certNum,
    issuance_date:     new Date().toISOString().split('T')[0],
    collected_by:      collectedBy || null,
    collection_date:   collectedBy ? new Date().toISOString().split('T')[0] : null,
    issued_by:         window.currentUser.id,
    issuance_status:   collectedBy ? 'Collected' : 'Issued',
  }, { onConflict: 'student_id' });

  if (error) {
    if (error.code === '23505') {
      showToast('That certificate number is already in use. Please use a different one.', 'error');
    } else {
      showToast('Error: ' + error.message, 'error');
    }
    return;
  }

  await logAudit(`Certificate issued: ${certNum}`, s?.student_index_number, 'certificate_issuance');
  showToast(`🏅 Certificate issued to ${s?.full_name}`, 'success');
  closeModal();
  await renderIssuance();
}

async function markCollected(studentId) {
  const s = allIssuanceStudents.find(x => x.id === studentId);

  const { error } = await db.from('certificate_issuance')
    .update({
      issuance_status: 'Collected',
      collection_date: new Date().toISOString().split('T')[0],
    })
    .eq('student_id', studentId);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit('Certificate marked as collected', s?.student_index_number, 'certificate_issuance');
  showToast(`✅ Certificate collection confirmed for ${s?.full_name}`, 'success');
  await renderIssuance();
}
