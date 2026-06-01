// ================================================================
//  js/students.js — Student Records + Add Individual Student
// ================================================================

let studentFilters = { search:'', status:'All', cert:'All', faculty:'All' };
let allStudents = [];

// ── UCC Faculty / Department structure ────────────────────────────────────
const UCC_FACULTIES = [
  '— Select Faculty / School —',
  // College of Agriculture and Natural Sciences
  'Faculty of Agriculture',
  'Faculty of Biosciences',
  'Faculty of Physical Sciences',
  // College of Distance Education
  'School of Business Studies (CoDE)',
  'School of Arts and Social Sciences (CoDE)',
  'School of Health and Allied Sciences (CoDE)',
  // College of Education Studies
  'Faculty of Educational Foundations',
  'Faculty of Science and Technology Education',
  'Faculty of Social Sciences Education',
  // College of Health and Allied Sciences
  'School of Medical Sciences',
  'School of Allied Health Sciences',
  'School of Nursing and Midwifery',
  // College of Humanities and Legal Studies
  'Faculty of Arts',
  'Faculty of Law',
  'Faculty of Social Sciences',
  // School of Business
  'School of Business',
  'Graduate Business Programmes',
  // Other
  'School of Graduate Studies',
  'Interdisciplinary Studies',
];

const UCC_DEPARTMENTS = [
  '— Select Department —',
  // Agriculture & Natural Sciences
  'Agricultural Economics and Agribusiness',
  'Animal Science',
  'Biochemistry and Biotechnology',
  'Botany',
  'Chemistry',
  'Computer Science and Information Technology',
  'Crop and Soil Sciences',
  'Fisheries and Aquatic Sciences',
  'Food Science and Technology',
  'Mathematics',
  'Molecular Biology and Biotechnology',
  'Physics',
  'Statistics and Actuarial Science',
  'Zoology',
  // Education
  'Agricultural Education',
  'Arts Education',
  'Basic Education',
  'Business and Social Sciences Education',
  'Early Childhood Education',
  'Educational Management',
  'Educational Psychology and Leadership',
  'Health, Physical Education and Recreation',
  'Home Economics Education',
  'Information and Communication Technology Education',
  'Language Education',
  'Mathematics and ICT Education',
  'Science Education',
  'Special Education',
  'Teaching in Higher Education',
  'Technical and Vocational Education',
  // Health Sciences
  'Anatomy',
  'Community Health Nursing',
  'Medical Biochemistry',
  'Medical Laboratory Science',
  'Mental Health Nursing',
  'Microbiology',
  'Midwifery',
  'Occupational Therapy',
  'Optometry',
  'Paediatric Nursing',
  'Pathology',
  'Perioperative Nursing',
  'Pharmacy',
  'Physiotherapy',
  'Public Health Nursing',
  'Radiography',
  // Humanities & Social Sciences
  'Bilingual Studies',
  'Economics',
  'English',
  'Film and Theatre Studies',
  'Geography and Tourism',
  'History',
  'Law',
  'Linguistics',
  'Music and Dance',
  'Philosophy and Classics',
  'Political Science',
  'Psychology',
  'Religion and Human Values',
  'Sociology',
  // Business
  'Accounting',
  'Applied Economics',
  'Business Administration',
  'Commerce',
  'Finance',
  'Human Resource Management',
  'Management',
  'Marketing',
  'Procurement and Supply Chain Management',
  'Project Management',
  'Public Health Education',
  'Public Policy and Administration',
  'Public Policy and Management',
  // General
  'Graduate Studies',
  'Interdisciplinary Studies',
];

// ── Helper: build a <select> options string ───────────────────────────────
function buildOptions(arr, selectedVal='') {
  return arr.map(v => {
    const isPlaceholder = v.startsWith('—');
    return `<option value="${isPlaceholder?'':v}" ${selectedVal===v?'selected':''} ${isPlaceholder?'disabled':''}>
      ${escHtml(v)}
    </option>`;
  }).join('');
}

// ── Render students page ──────────────────────────────────────────────────
async function renderStudents() {
  const content = document.getElementById('page-content');

  const { data, error } = await db
    .from('students_full')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  allStudents = data || [];

  const faculties = ['All', ...new Set(allStudents.map(s => s.faculty).filter(Boolean))];

  content.innerHTML = `
    <!-- Filters -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:16px 20px">
        <div class="filters">
          <input type="search" id="stu-search"
            placeholder="🔍  Search name, index, programme…"
            value="${escHtml(studentFilters.search)}" oninput="filterStudents()">
          <select id="stu-status" onchange="filterStudents()">
            ${['All','Approved','Pending','Verified','Rejected']
              .map(s=>`<option ${studentFilters.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <select id="stu-cert" onchange="filterStudents()">
            ${['All','Issued','Collected','Not Initiated']
              .map(s=>`<option ${studentFilters.cert===s?'selected':''}>${s}</option>`).join('')}
          </select>
          <select id="stu-faculty" onchange="filterStudents()">
            ${faculties.map(f=>`<option ${studentFilters.faculty===f?'selected':''}>${f}</option>`).join('')}
          </select>
          <span class="record-count" id="stu-count"></span>
          ${can('upload') ? `
            <button class="btn btn-outline btn-sm" onclick="navigateTo('upload')">
              📤 Batch Upload
            </button>
            <button class="btn btn-gold btn-sm" onclick="openAddStudentModal()">
              ➕ Add Student
            </button>` : ''}
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
            <th>Eff. Date</th>
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
  studentFilters.status  = document.getElementById('stu-status')?.value   || 'All';
  studentFilters.cert    = document.getElementById('stu-cert')?.value     || 'All';
  studentFilters.faculty = document.getElementById('stu-faculty')?.value  || 'All';

  const filtered = allStudents.filter(s => {
    const q = studentFilters.search;
    if (q && !s.full_name?.toLowerCase().includes(q)
           && !s.student_index_number?.toLowerCase().includes(q)
           && !s.programme?.toLowerCase().includes(q)) return false;
    if (studentFilters.status !== 'All' && s.approval_status !== studentFilters.status) return false;
    if (studentFilters.cert   !== 'All' && (s.cert_status||'Not Initiated') !== studentFilters.cert) return false;
    if (studentFilters.faculty !== 'All' && s.faculty !== studentFilters.faculty) return false;
    return true;
  });

  const countEl = document.getElementById('stu-count');
  if (countEl) countEl.textContent = `${filtered.length} record${filtered.length!==1?'s':''}`;

  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No records found</h3>
        <p>Try adjusting your search or filters.</p>
      </div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const approvalStatus = s.approval_status || 'Pending';
    const certStatus     = s.cert_status     || 'Not Initiated';
    return `
      <tr class="${s.duplicate_flag?'dup-row':''}">
        <td>
          <div style="font-size:12px;font-weight:700;color:var(--navy);font-family:monospace">
            ${escHtml(s.student_index_number)}
          </div>
          ${s.duplicate_flag
            ? `<span style="font-size:10px;background:#FEF3C7;color:#92400E;
                   padding:2px 6px;border-radius:4px;font-weight:700">⚠️ DUPLICATE</span>` : ''}
        </td>
        <td>
          <div style="font-size:13px;font-weight:600;color:var(--gray-800)">${escHtml(s.full_name)}</div>
          <div style="font-size:11px;color:var(--gray-400)">${escHtml(s.level)} · ${s.graduation_year||''}</div>
        </td>
        <td style="font-size:12px;color:var(--gray-600)">${escHtml(s.programme)}</td>
        <td style="font-size:12px;color:var(--gray-600)">${escHtml(s.faculty)}</td>
        <td style="font-size:12px;color:var(--gray-600)">${s.effective_date ? formatDate(s.effective_date) : '—'}</td>
        <td>${badge(approvalStatus)}</td>
        <td>${badge(certStatus)}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="viewStudent('${s.id}')">View</button>
            ${can('approve') && approvalStatus==='Pending'
              ? `<button class="btn btn-gold btn-sm" onclick="reviewStudent('${s.id}')">Review</button>`:''}
            ${can('verify') && approvalStatus==='Pending'
              ? `<button class="btn btn-outline btn-sm" onclick="verifyStudent('${s.id}')">Verify</button>`:''}
          </div>
        </td>
      </tr>`;
  }).join('');
}


// ================================================================
//  ADD INDIVIDUAL STUDENT MODAL
// ================================================================
function openAddStudentModal() {
  const currentYear = new Date().getFullYear();

  openModal(`
    <div class="modal-head">
      <h3>➕ Add Individual Student</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">

      <div class="alert alert-info" style="margin-bottom:16px">
        <span>ℹ️</span>
        <div style="font-size:13px">
          Use this form to add a single student manually.
          For multiple students, use <strong>Upload Batch</strong> instead.
        </div>
      </div>

      <div id="add-stu-alert" style="display:none"></div>

      <!-- Row 1: Index + Full Name -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Index Number <span style="color:var(--danger)">*</span></label>
          <input type="text" id="as-index" class="form-control"
            placeholder="e.g. UCC/GST/2024/001">
        </div>
        <div class="form-group" style="margin:0">
          <label>Full Name <span style="color:var(--danger)">*</span></label>
          <input type="text" id="as-name" class="form-control"
            placeholder="e.g. Kwame Asante Mensah">
        </div>
      </div>

      <!-- Row 2: Programme + Level -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Programme <span style="color:var(--danger)">*</span></label>
          <input type="text" id="as-programme" class="form-control"
            placeholder="e.g. Master of Philosophy (English)">
        </div>
        <div class="form-group" style="margin:0">
          <label>Level <span style="color:var(--danger)">*</span></label>
          <select id="as-level" class="form-control">
            <option value="">— Select Level —</option>
            <option value="Masters">Masters</option>
            <option value="MPhil">MPhil</option>
            <option value="PhD">PhD</option>
            <option value="MBA">MBA</option>
          </select>
        </div>
      </div>

      <!-- Row 3: Faculty + Department (dropdowns) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Faculty / School <span style="color:var(--danger)">*</span></label>
          <select id="as-faculty" class="form-control">
            ${buildOptions(UCC_FACULTIES)}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Department <span style="color:var(--danger)">*</span></label>
          <select id="as-department" class="form-control">
            ${buildOptions(UCC_DEPARTMENTS)}
          </select>
        </div>
      </div>

      <!-- Row 4: Thesis Status + Graduation Year -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Thesis / Project Status <span style="color:var(--danger)">*</span></label>
          <select id="as-thesis" class="form-control">
            <option value="Submitted">Submitted</option>
            <option value="Examined">Examined</option>
            <option value="Pending">Pending</option>
            <option value="N/A">N/A (Coursework only)</option>
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Graduation Year <span style="color:var(--danger)">*</span></label>
          <input type="number" id="as-year" class="form-control"
            value="${currentYear}" min="2000" max="2099">
        </div>
      </div>

      <!-- Row 5: Effective Date + Batch Name -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Effective Date <span style="color:var(--danger)">*</span>
            <span style="font-weight:400;color:var(--gray-400);font-size:11px">
              — date qualification took effect
            </span>
          </label>
          <input type="date" id="as-effdate" class="form-control">
          <small style="color:var(--gray-400)">
            e.g. 31 March ${currentYear} or 30 September ${currentYear}
          </small>
        </div>
        <div class="form-group" style="margin:0">
          <label>Batch Name <span style="color:var(--danger)">*</span></label>
          <input type="text" id="as-batch" class="form-control"
            placeholder="e.g. 2024A or Individual">
          <small style="color:var(--gray-400)">Group label for this record</small>
        </div>
      </div>

      <!-- Row 6: Email + Phone -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label>Email Address</label>
          <input type="email" id="as-email" class="form-control"
            placeholder="student@ucc.edu.gh">
        </div>
        <div class="form-group" style="margin:0">
          <label>Phone Number</label>
          <input type="tel" id="as-phone" class="form-control"
            placeholder="e.g. 0244000000">
        </div>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-gold" onclick="submitAddStudent()">➕ Add Student</button>
    </div>
  `, '660px');
}

async function submitAddStudent() {
  const alertEl = document.getElementById('add-stu-alert');
  const showAlert = (msg, type) => {
    alertEl.innerHTML    = `<div class="alert alert-${type}" style="margin-bottom:14px">
      <span>${type==='error'?'❌':'⚠️'}</span><div>${msg}</div></div>`;
    alertEl.style.display = 'block';
  };
  alertEl.style.display = 'none';

  // Collect values
  const index   = document.getElementById('as-index')?.value.trim();
  const name    = document.getElementById('as-name')?.value.trim();
  const prog    = document.getElementById('as-programme')?.value.trim();
  const dept    = document.getElementById('as-department')?.value;
  const faculty = document.getElementById('as-faculty')?.value;
  const level   = document.getElementById('as-level')?.value;
  const thesis  = document.getElementById('as-thesis')?.value;
  const year    = parseInt(document.getElementById('as-year')?.value);
  const effdate = document.getElementById('as-effdate')?.value;
  const batch   = document.getElementById('as-batch')?.value.trim();
  const email   = document.getElementById('as-email')?.value.trim();
  const phone   = document.getElementById('as-phone')?.value.trim();

  // Validate required fields
  if (!index)   { showAlert('Please enter the student index number.', 'warning'); return; }
  if (!name)    { showAlert('Please enter the student full name.', 'warning'); return; }
  if (!prog)    { showAlert('Please enter the programme name.', 'warning'); return; }
  if (!faculty || faculty.startsWith('—')) { showAlert('Please select a Faculty / School.', 'warning'); return; }
  if (!dept || dept.startsWith('—'))       { showAlert('Please select a Department.', 'warning'); return; }
  if (!level)   { showAlert('Please select a level.', 'warning'); return; }
  if (!effdate) { showAlert('Please enter the effective date.', 'warning'); return; }
  if (!batch)   { showAlert('Please enter a batch name.', 'warning'); return; }
  if (!year || year < 2000 || year > 2099) {
    showAlert('Please enter a valid graduation year (e.g. 2024).', 'warning'); return;
  }

  // Check for duplicate index in same batch
  const { data: existing } = await db
    .from('students')
    .select('id')
    .eq('student_index_number', index)
    .eq('graduation_batch', batch)
    .maybeSingle();

  if (existing) {
    showAlert(`Index number <strong>${escHtml(index)}</strong> already exists in batch <strong>${escHtml(batch)}</strong>.`, 'error');
    return;
  }

  // Apply smart casing
  const safeName    = typeof smartCase === 'function' ? smartCase(name)    : name;
  const safeProg    = typeof smartCase === 'function' ? smartCase(prog)    : prog;

  // Insert student
  const { data: newStudent, error: sErr } = await db
    .from('students')
    .insert({
      student_index_number: index.trim().toUpperCase(),
      full_name:            safeName,
      programme:            safeProg,
      department:           dept,
      faculty:              faculty,
      level,
      thesis_status:        thesis,
      graduation_year:      year,
      graduation_batch:     batch,
      effective_date:       effdate || null,
      email:                email   || null,
      phone:                phone   || null,
      duplicate_flag:       false,
    })
    .select()
    .single();

  if (sErr) {
    // If column doesn't exist yet, retry without effective_date
    if (sErr.message.includes('effective_date')) {
      showAlert('⚠️ The effective_date column does not exist yet in your database. Please run the SQL from the migration script, then try again.', 'error');
    } else {
      showAlert('Error adding student: ' + sErr.message, 'error');
    }
    return;
  }

  // Create pending qualified_students row
  await db.from('qualified_students').insert({
    student_id:           newStudent.id,
    qualification_status: 'Pending',
  });

  await logAudit(`Individual student added: ${safeName}`, index, 'students');
  closeModal();
  showToast(`✅ ${safeName} added successfully and queued for review.`, 'success');
  await renderStudents();
}


// ================================================================
//  VIEW STUDENT DETAIL
// ================================================================
async function viewStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  const approvalStatus = s.approval_status || 'Pending';
  const certStatus     = s.cert_status     || 'Not Initiated';

  openModal(`
    <div class="modal-head">
      <h3>Student Record</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:16px;padding:16px;
           background:var(--gray-50);border-radius:12px;margin-bottom:20px">
        <div style="width:52px;height:52px;border-radius:14px;
             background:linear-gradient(135deg,var(--navy),var(--navy-mid));
             display:flex;align-items:center;justify-content:center;
             font-size:24px;color:#fff;flex-shrink:0">🎓</div>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:800;color:var(--navy)">${escHtml(s.full_name)}</div>
          <div style="font-size:12px;color:var(--gray-400);font-family:monospace">${escHtml(s.student_index_number)}</div>
        </div>
        ${s.duplicate_flag
          ? `<div style="background:#FEF3C7;color:#92400E;padding:6px 12px;
                 border-radius:8px;font-size:12px;font-weight:700">⚠️ Duplicate Flag</div>` : ''}
      </div>

      <div class="detail-grid" style="margin-bottom:16px">
        ${[
          ['Programme',       s.programme],
          ['Department',      s.department],
          ['Faculty',         s.faculty],
          ['Level',           s.level],
          ['Thesis Status',   s.thesis_status],
          ['Graduation Year', s.graduation_year],
          ['Effective Date',  s.effective_date ? formatDate(s.effective_date) : '—'],
          ['Batch',           s.graduation_batch],
          ['Email',           s.email],
          ['Phone',           s.phone],
        ].map(([k,v]) => `
          <div class="detail-cell">
            <div class="detail-label">${k}</div>
            <div class="detail-value">${escHtml(String(v||'—'))}</div>
          </div>`).join('')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:${s.certificate_number?'16px':'0'}">
        <div class="detail-cell">
          <div class="detail-label">Approval Status</div>
          <div style="margin-top:6px">${badge(approvalStatus)}</div>
          ${s.approval_date
            ? `<div style="font-size:11px;color:var(--gray-400);margin-top:4px">Date: ${formatDate(s.approval_date)}</div>`:''}
          ${s.approval_remarks
            ? `<div style="font-size:11px;color:var(--gray-600);margin-top:4px;font-style:italic">"${escHtml(s.approval_remarks)}"</div>`:''}
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
            ${s.collected_by?`<br>Collected by: ${escHtml(s.collected_by)}`:''}
          </div>
        </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      ${can('approve') && approvalStatus==='Pending'
        ? `<button class="btn btn-gold" onclick="closeModal();reviewStudent('${s.id}')">Review This Student</button>`:''}
    </div>
  `, '640px');
}


// ================================================================
//  VERIFY / APPROVE / REJECT
// ================================================================
async function verifyStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  const { error } = await db.from('qualified_students').upsert({
    student_id: id, qualification_status: 'Verified',
  }, { onConflict: 'student_id' });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit('Student record verified', s.student_index_number, 'qualified_students');
  showToast(`✅ ${s.full_name} marked as Verified`, 'success');
  await renderStudents();
}

async function reviewStudent(id) {
  const s = allStudents.find(x => x.id === id);
  if (!s) return;
  openModal(`
    <div class="modal-head">
      <h3>Review Student Record</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="padding:12px 14px;background:var(--gray-50);border-radius:9px;margin-bottom:18px;font-size:13px">
        <strong>${escHtml(s.student_index_number)}</strong> &middot;
        ${escHtml(s.full_name)} &middot; ${escHtml(s.programme)} &middot; ${s.graduation_year}
        ${s.effective_date?` &middot; Effective: ${formatDate(s.effective_date)}`:''}
      </div>
      ${s.duplicate_flag?`<div class="alert alert-warning" style="margin-bottom:14px">
        <span>⚠️</span><div>This record has a <strong>duplicate flag</strong>. Verify carefully before approving.</div>
      </div>`:''}
      <div class="form-group">
        <label>Review Comments</label>
        <textarea id="review-comment" rows="4" class="form-control"
          placeholder="Add any comments or reasons for your decision…"
          style="resize:vertical"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost"   onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"  onclick="submitReview('${id}','Rejected')">❌ Reject</button>
      <button class="btn btn-success" onclick="submitReview('${id}','Approved')">✅ Approve</button>
    </div>
  `, '500px');
}

async function submitReview(id, status) {
  const comment = document.getElementById('review-comment')?.value;
  const s       = allStudents.find(x => x.id === id);
  const { error } = await db.from('qualified_students').upsert({
    student_id:           id,
    qualification_status: status,
    approved_by:          window.currentUser.id,
    approval_date:        new Date().toISOString(),
    remarks:              comment || null,
  }, { onConflict: 'student_id' });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await logAudit(`Student ${status.toLowerCase()}`, s?.student_index_number, 'qualified_students');
  showToast(
    `${status==='Approved'?'✅':'❌'} ${s?.full_name} has been ${status.toLowerCase()}.`,
    status==='Approved'?'success':'warning'
  );
  closeModal();
  await renderStudents();
}
