// ================================================================
//  js/students.js — Student Records Page
// ================================================================

let studentFilters = { search:'', status:'All', cert:'All', faculty:'All' };
let allStudents = [];

async function renderStudents() {
  const content = document.getElementById('page-content');

  // Load all students via the view
  const { data, error } = await db
    .from('students_full')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  allStudents = data || [];

  // Unique faculties for filter
  const faculties = ['All', ...new Set(allStudents.map(s => s.faculty).filter(Boolean))];

  content.innerHTML = `
    <!-- Filters -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:16px 20px">
        <div class="filters">
          <input type="search" id="stu-search" placeholder="🔍  Search name, index, programme…"
            value="${escHtml(studentFilters.search)}" oninput="filterStudents()">
          <select id="stu-status" onchange="filterStudents()">
            ${['All','Approved','Pending','Verified','Rejected']
              .map(s => `<option ${studentFilters.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <select id="stu-cert" onchange="filterStudents()">
            ${['All','Issued','Collected','Not Initiated']
              .map(s => `<option ${studentFilters.cert===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <select id="stu-faculty" onchange="filterStudents()">
            ${faculties.map(f => `<option ${studentFilters.faculty===f?'selected':''}>${f}</option>`).join('')}
          </select>
          <span class="record-count" id="stu-count"></span>
          ${can('approve') ? `<button class="btn btn-gold btn-sm" onclick="navigateTo('upload')">📤 Upload Batch</button>` : ''}
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Index No.</th>
            <th>Student Name</th>
            <th>Programme</th>
            <th>Faculty</th>
            <th>Approval</th>
            <th>Certificate</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="students-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  filterStudents();
}

function filterStudents() {
  studentFilters.search  = (document.getElementById('stu-search')?.value  || '').toLowerCase();
  studentFilters.status  = document.getElementById('stu-status')?.value  || 'All';
  studentFilters.cert    = document.getElementById('stu-cert')?.value    || 'All';
  studentFilters.faculty = document.getElementById('stu-faculty')?.value || 'All';

  const filtered = allStudents.filter(s => {
    const q = studentFilters.search;
    if (q && !s.full_name?.toLowerCase().includes(q)
           && !s.student_index_number?.toLowerCase().includes(q)
           && !s.programme?.toLowerCase().includes(q)) return false;
    if (studentFilters.status !== 'All' && s.approval_status !== studentFilters.status) return false;
    if (studentFilters.cert   !== 'All' && (s.cert_status || 'Not Initiated') !== studentFilters.cert) return false;
    if (studentFilters.faculty !== 'All' && s.faculty !== studentFilters.faculty) return false;
    return true;
  });

  document.getElementById('stu-count').textContent = `${filtered.length} record${filtered.length!==1?'s':''}`;

  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔍</div><h3>No records found</h3><p>Try adjusting your search or filters.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const approvalStatus = s.approval_status || 'Pending';
    const certStatus     = s.cert_status     || 'Not Initiated';
    const isDup          = s.duplicate_flag;
    return `
      <tr class="${isDup?'dup-row':''}">
        <td>
          <div style="font-size:12px;font-weight:700;color:var(--navy);font-family:monospace">${escHtml(s.student_index_number)}</div>
          ${isDup ? `<span style="font-size:10px;background:#FEF3C7;color:#92400E;padding:2px 6px;border-radius:4px;font-weight:700">⚠️ DUPLICATE</span>` : ''}
        </td>
        <td>
          <div style="font-size:13px;font-weight:600;color:var(--gray-800)">${escHtml(s.full_name)}</div>
          <div style="font-size:11px;color:var(--gray-400)">${escHtml(s.level)} · ${s.graduation_year||''}</div>
        </td>
        <td style="font-size:12px;color:var(--gray-600)">${escHtml(s.programme)}</td>
        <td style="font-size:12px;color:var(--gray-600)">${escHtml(s.faculty)}</td>
        <td>${badge(approvalStatus)}</td>
        <td>${badge(certStatus)}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="viewStudent('${s.id}')">View</button>
            ${can('approve') && approvalStatus === 'Pending'
              ? `<button class="btn btn-gold btn-sm" onclick="reviewStudent('${s.id}')">Review</button>` : ''}
            ${can('verify') && approvalStatus === 'Pending'
              ? `<button class="btn btn-outline btn-sm" onclick="verifyStudent('${s.id}')">Verify</button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ---- View student detail modal ----
async function viewStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  const certStatus = s.cert_status || 'Not Initiated';
  const approvalStatus = s.approval_status || 'Pending';

  openModal(`
    <div class="modal-head">
      <h3>Student Record</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <!-- Student header -->
      <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--gray-50);border-radius:12px;margin-bottom:20px">
        <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,var(--navy),var(--navy-mid));display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0">🎓</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;color:var(--navy)">${escHtml(s.full_name)}</div>
          <div style="font-size:12px;color:var(--gray-400);font-family:monospace">${escHtml(s.student_index_number)}</div>
        </div>
        ${s.duplicate_flag ? `<div style="background:#FEF3C7;color:#92400E;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700">⚠️ Duplicate Flag</div>` : ''}
      </div>

      <div class="detail-grid" style="margin-bottom:16px">
        ${[
          ['Programme',       s.programme],
          ['Department',      s.department],
          ['Faculty',         s.faculty],
          ['Level',           s.level],
          ['Thesis Status',   s.thesis_status],
          ['Graduation Year', s.graduation_year],
          ['Batch',           s.graduation_batch],
          ['Email',           s.email],
        ].map(([k,v]) => `
          <div class="detail-cell">
            <div class="detail-label">${k}</div>
            <div class="detail-value">${escHtml(v)||'—'}</div>
          </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${s.certificate_number?'16px':'0'}">
        <div class="detail-cell">
          <div class="detail-label">Approval Status</div>
          <div style="margin-top:6px">${badge(approvalStatus)}</div>
          ${s.approval_date ? `<div style="font-size:11px;color:var(--gray-400);margin-top:4px">Date: ${formatDate(s.approval_date)}</div>` : ''}
          ${s.approval_remarks ? `<div style="font-size:11px;color:var(--gray-600);margin-top:4px;font-style:italic">"${escHtml(s.approval_remarks)}"</div>` : ''}
        </div>
        <div class="detail-cell">
          <div class="detail-label">Certificate Status</div>
          <div style="margin-top:6px">${badge(certStatus)}</div>
        </div>
      </div>

      ${s.certificate_number ? `
        <div class="alert alert-success">
          <span>🏅</span>
          <div>
            <strong>Certificate Issued</strong><br>
            Number: <code>${escHtml(s.certificate_number)}</code><br>
            Date: ${formatDate(s.issuance_date)}
            ${s.collected_by ? `<br>Collected by: ${escHtml(s.collected_by)}` : ''}
          </div>
        </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      ${can('approve') && approvalStatus === 'Pending' ? `<button class="btn btn-gold" onclick="closeModal();reviewStudent('${s.id}')">Review This Student</button>` : ''}
    </div>
  `);
}

// ---- Mark as Verified ----
async function verifyStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  // Upsert into qualified_students
  const { error } = await db.from('qualified_students').upsert({
    student_id: id,
    qualification_status: 'Verified',
  }, { onConflict: 'student_id' });

  if (error) { showToast('Error verifying record: ' + error.message, 'error'); return; }
  await logAudit('Student record verified', s.student_index_number, 'qualified_students');
  showToast(`✅ ${s.full_name} marked as Verified`, 'success');
  await renderStudents();
}

// ---- Approve / Reject Modal ----
async function reviewStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;

  openModal(`
    <div class="modal-head">
      <h3>Review: ${escHtml(s.full_name)}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="padding:12px 14px;background:var(--gray-50);border-radius:9px;margin-bottom:18px;font-size:13px">
        <strong>${escHtml(s.student_index_number)}</strong> &middot;
        ${escHtml(s.programme)} &middot; ${s.graduation_year}
      </div>
      <div class="form-group">
        <label>Review Comments</label>
        <textarea id="review-comment" rows="4" class="form-control"
          placeholder="Add comments or reasons for approval/rejection…"
          style="resize:vertical"></textarea>
      </div>
      ${s.duplicate_flag ? `<div class="alert alert-warning" style="margin-top:8px">
        <span>⚠️</span><div>This record has a <strong>duplicate flag</strong>. Verify carefully before approving.</div></div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="submitReview('${id}','Rejected')">❌ Reject</button>
      <button class="btn btn-success" onclick="submitReview('${id}','Approved')">✅ Approve</button>
    </div>
  `, '500px');
}

async function submitReview(id, status) {
  const comment = document.getElementById('review-comment')?.value;
  const s = allStudents.find(x => x.id === id);

  const { error } = await db.from('qualified_students').upsert({
    student_id:           id,
    qualification_status: status,
    approved_by:          window.currentUser.id,
    approval_date:        new Date().toISOString(),
    remarks:              comment || null,
  }, { onConflict: 'student_id' });

  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`Student ${status.toLowerCase()}`, s?.student_index_number, 'qualified_students');
  showToast(`${status === 'Approved' ? '✅' : '❌'} ${s?.full_name} has been ${status.toLowerCase()}`, status === 'Approved' ? 'success' : 'warning');
  closeModal();
  await renderStudents();
}
