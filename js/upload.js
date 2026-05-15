// ================================================================
//  js/upload.js — Excel Batch Upload (SheetJS + Supabase)
// ================================================================

let uploadStep = 1;
let parsedRows = [];
let validationResult = null;

async function renderUpload() {
  if (!can('upload')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state"><div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3><p>You do not have permission to upload batches.</p></div>`;
    return;
  }
  uploadStep = 1;
  parsedRows = [];
  validationResult = null;
  renderUploadStep();
}

function renderUploadStep() {
  const content = document.getElementById('page-content');

  const stepHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:20px 24px">
        <div class="steps">
          ${['Configure','Validate & Preview','Complete'].map((label,i) => `
            ${i>0?`<div class="step-connector ${uploadStep>i?'done':''}"></div>`:''}
            <div class="step-item">
              <div class="step-circle ${uploadStep>i+1?'done':uploadStep===i+1?'active':'pending'}">
                ${uploadStep>i+1?'✓':i+1}
              </div>
              <div class="step-label ${uploadStep===i+1?'active':''}">${label}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
  `;

  if (uploadStep === 1) {
    content.innerHTML = stepHTML + `
      <div style="display:flex;flex-direction:column;gap:20px">
        <div class="card">
          <div class="card-header"><h3>📋 Batch Configuration</h3></div>
          <div class="card-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
              <div class="form-group">
                <label>Batch Name <span style="color:var(--danger)">*</span></label>
                <input type="text" id="batch-name" class="form-control"
                  placeholder="e.g. 2024B" value="">
                <small style="color:var(--gray-400)">Unique name for this upload (no spaces)</small>
              </div>
              <div class="form-group">
                <label>Academic Year</label>
                <input type="text" id="batch-year" class="form-control"
                  value="2024/2025">
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>📁 Upload Excel File</h3></div>
          <div class="card-body">
            <div class="upload-zone" id="upload-zone"
              ondragover="event.preventDefault();this.classList.add('drag-over')"
              ondragleave="this.classList.remove('drag-over')"
              ondrop="handleFileDrop(event)">
              <div style="font-size:48px;margin-bottom:12px">📁</div>
              <h4>Drop your Excel file here</h4>
              <p>Supports .xlsx and .csv formats</p>
              <input type="file" id="file-input" accept=".xlsx,.csv" style="display:none"
                onchange="handleFileSelect(event)">
              <button class="btn btn-gold" onclick="document.getElementById('file-input').click()">
                📂 Select File
              </button>
            </div>
          </div>
        </div>

        <div class="alert alert-info">
          <span style="font-size:20px">📄</span>
          <div>
            <strong>Required Excel Columns:</strong><br>
            <code>student_index_number, full_name, programme, department, faculty, level, thesis_status, graduation_year</code><br>
            <small>Column headers must match exactly. Level must be: Masters, MPhil, PhD, or MBA.</small>
          </div>
        </div>
      </div>
    `;
  }

  else if (uploadStep === 2 && validationResult) {
    const v = validationResult;
    content.innerHTML = stepHTML + `
      <!-- Validation summary -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">
        ${[
          { label:'Total Records', value:v.total,     color:'var(--success)', bg:'#F0FDF4', border:'#BBF7D0' },
          { label:'Valid Records', value:v.valid,     color:'var(--success)', bg:'#DCFCE7', border:'#86EFAC' },
          { label:'Duplicates',    value:v.dups.length, color:v.dups.length?'var(--warning)':'var(--success)', bg:v.dups.length?'#FEF3C7':'#F0FDF4', border:v.dups.length?'#FDE68A':'#BBF7D0' },
          { label:'Already Issued',value:v.alreadyIssued.length, color:v.alreadyIssued.length?'var(--danger)':'var(--success)', bg:v.alreadyIssued.length?'#FEE2E2':'#F0FDF4', border:v.alreadyIssued.length?'#FECACA':'#BBF7D0' },
        ].map(s => `
          <div style="background:${s.bg};border:1px solid ${s.border};border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:${s.color}">${s.value}</div>
            <div style="font-size:12px;color:${s.color};font-weight:600;margin-top:4px">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Preview table -->
      <div class="card">
        <div class="card-header">
          <h3>Preview — ${parsedRows.length} Records</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="uploadStep=1;renderUploadStep()">← Back</button>
            <button class="btn btn-gold" onclick="importBatch()" ${v.valid===0?'disabled':''}>
              📥 Import ${v.valid} Valid Record${v.valid!==1?'s':''}
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Index No.</th><th>Name</th><th>Programme</th><th>Level</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${parsedRows.map(row => {
                const isDup   = v.dups.includes(row._index);
                const isCert  = v.alreadyIssued.includes(row._index);
                const isValid = !isDup && !isCert;
                return `<tr style="background:${isDup?'#FFF7ED':isCert?'#FEF2F2':''}">
                  <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--navy)">${escHtml(row.student_index_number)}</td>
                  <td style="font-size:13px;font-weight:600">${escHtml(row.full_name)}</td>
                  <td style="font-size:12px;color:var(--gray-600)">${escHtml(row.programme)}</td>
                  <td style="font-size:12px">${escHtml(row.level)}</td>
                  <td>${isDup?badge('⚠️ Duplicate','Rejected'):isCert?badge('🏅 Cert Issued','Issued'):badge('✅ Valid','Approved')}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  else if (uploadStep === 3) {
    content.innerHTML = stepHTML + `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:56px 24px">
          <div style="font-size:64px;margin-bottom:16px">✅</div>
          <h3 style="font-size:20px;font-weight:800;color:var(--navy);margin-bottom:8px">Upload Successful!</h3>
          <p style="color:var(--gray-600);margin-bottom:24px">
            Batch has been imported and is ready for verification.
          </p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button class="btn btn-outline" onclick="renderUpload()">Upload Another Batch</button>
            <button class="btn btn-gold" onclick="navigateTo('students')">View Students →</button>
          </div>
        </div>
      </div>
    `;
  }
}

// ---- File handling ----
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone')?.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target?.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx','csv'].includes(ext)) {
    showToast('Only .xlsx and .csv files are supported', 'error');
    return;
  }
  const batchName = document.getElementById('batch-name')?.value.trim();
  if (!batchName) {
    showToast('Please enter a batch name first', 'warning');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = new Uint8Array(ev.target.result);
      const wb   = XLSX.read(data, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });

      if (rows.length === 0) {
        showToast('The file appears to be empty', 'error');
        return;
      }

      // Normalise rows
      parsedRows = rows.map(r => ({
        student_index_number: String(r.student_index_number || r['Index Number'] || r['Index No'] || '').trim(),
        full_name:            String(r.full_name            || r['Full Name']    || r['Name']    || '').trim(),
        programme:            String(r.programme            || r['Programme']    || '').trim(),
        department:           String(r.department           || r['Department']   || '').trim(),
        faculty:              String(r.faculty              || r['Faculty']      || '').trim(),
        level:                String(r.level                || r['Level']        || 'Masters').trim(),
        thesis_status:        String(r.thesis_status        || r['Thesis Status']|| 'Pending').trim(),
        graduation_year:      parseInt(r.graduation_year   || r['Year']         || new Date().getFullYear()),
        _index:               String(r.student_index_number || r['Index Number'] || '').trim(),
      })).filter(r => r.student_index_number && r.full_name);

      await validateRows(batchName);
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function validateRows(batchName) {
  showToast('Validating records…', 'info');

  // Get existing index numbers from DB
  const { data: existing } = await db.from('students').select('student_index_number, graduation_batch');
  const existingIndexes = new Set((existing||[]).map(s => s.student_index_number));

  // Get already-issued
  const { data: issued } = await db
    .from('students_full')
    .select('student_index_number')
    .in('cert_status', ['Issued','Collected']);
  const issuedIndexes = new Set((issued||[]).map(s => s.student_index_number));

  const newIndexes    = parsedRows.map(r => r._index);
  const dups          = newIndexes.filter(idx => existingIndexes.has(idx));
  const alreadyIssued = newIndexes.filter(idx => issuedIndexes.has(idx));
  const valid         = parsedRows.filter(r => !dups.includes(r._index) && !alreadyIssued.includes(r._index)).length;

  validationResult = { total: parsedRows.length, valid, dups, alreadyIssued };
  uploadStep = 2;
  renderUploadStep();
}

async function importBatch() {
  const batchName = document.getElementById('batch-name')?.value.trim() || 'Unknown';
  const year      = document.getElementById('batch-year')?.value.trim()  || '2024/2025';
  const v         = validationResult;

  if (!v || v.valid === 0) {
    showToast('No valid records to import', 'warning');
    return;
  }

  const btn = document.querySelector('#page-content .btn-gold:last-child');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader"></span> Importing…'; }

  try {
    // 1. Create the batch record
    const { data: batch, error: batchErr } = await db
      .from('uploaded_batches')
      .insert({
        batch_name:       batchName,
        academic_year:    year,
        uploaded_by:      window.currentUser.id,
        total_records:    v.total,
        valid_records:    v.valid,
        duplicates_found: v.dups.length,
        already_issued:   v.alreadyIssued.length,
        status:           'Completed',
      })
      .select()
      .single();

    if (batchErr) throw batchErr;

    // 2. Insert valid students
    const toInsert = parsedRows
      .filter(r => !v.dups.includes(r._index) && !v.alreadyIssued.includes(r._index))
      .map(r => ({
        student_index_number: r.student_index_number,
        full_name:            r.full_name,
        programme:            r.programme,
        department:           r.department,
        faculty:              r.faculty,
        level:                r.level,
        thesis_status:        r.thesis_status,
        graduation_year:      r.graduation_year,
        graduation_batch:     batchName,
        uploaded_batch_id:    batch.id,
      }));

    const { error: insertErr } = await db.from('students').insert(toInsert);
    if (insertErr) throw insertErr;

    // 3. Create pending qualified_students rows
    const { data: insertedStudents } = await db
      .from('students')
      .select('id')
      .eq('graduation_batch', batchName);

    if (insertedStudents?.length) {
      await db.from('qualified_students').insert(
        insertedStudents.map(s => ({ student_id: s.id, qualification_status: 'Pending' }))
      );
    }

    await logAudit(`Batch uploaded: ${batchName} (${v.valid} records)`, batchName, 'uploaded_batches');
    uploadStep = 3;
    renderUploadStep();
  } catch (err) {
    showToast('Import failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = `📥 Import ${v.valid} Valid Records`; }
  }
}
