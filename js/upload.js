// ================================================================
//  js/upload.js — Batch Excel Upload with full specifications
// ================================================================

let uploadStep      = 1;
let parsedRows      = [];
let validationResult = null;

async function renderUpload() {
  if (!can('upload')) {
    document.getElementById('page-content').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <h3>Access Restricted</h3>
        <p>You do not have permission to upload batches.</p>
      </div>`;
    return;
  }
  uploadStep       = 1;
  parsedRows       = [];
  validationResult = null;
  renderUploadStep();
}

function renderUploadStep() {
  const content = document.getElementById('page-content');

  // ---- Step wizard header ----
  const stepHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-body" style="padding:20px 24px">
        <div class="steps">
          ${['Configure & Upload','Validate & Preview','Complete'].map((label, i) => `
            ${i > 0 ? `<div class="step-connector ${uploadStep > i ? 'done' : ''}"></div>` : ''}
            <div class="step-item">
              <div class="step-circle ${uploadStep > i+1 ? 'done' : uploadStep === i+1 ? 'active' : 'pending'}">
                ${uploadStep > i+1 ? '✓' : i+1}
              </div>
              <div class="step-label ${uploadStep === i+1 ? 'active' : ''}">${label}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  // ================================================================
  //  STEP 1 — Configure + Excel Specifications + Upload
  // ================================================================
  if (uploadStep === 1) {
    content.innerHTML = stepHTML + `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

        <!-- LEFT: Config + Upload -->
        <div style="display:flex;flex-direction:column;gap:20px">

          <!-- Batch config -->
          <div class="card">
            <div class="card-header"><h3>📋 Batch Configuration</h3></div>
            <div class="card-body">
              <div class="form-group">
                <label>Batch Name <span style="color:var(--danger)">*</span></label>
                <input type="text" id="batch-name" class="form-control"
                  placeholder="e.g. 2024A  or  2025-Semester1">
                <small style="color:var(--gray-400)">
                  A short unique identifier for this upload. No spaces — use hyphens or underscores.
                </small>
              </div>
              <div class="form-group" style="margin-top:14px">
                <label>Academic Year</label>
                <input type="text" id="batch-year" class="form-control" value="2024/2025">
              </div>
            </div>
          </div>

          <!-- Upload zone -->
          <div class="card">
            <div class="card-header"><h3>📁 Select File</h3></div>
            <div class="card-body">
              <div class="upload-zone" id="upload-zone"
                ondragover="event.preventDefault();this.classList.add('drag-over')"
                ondragleave="this.classList.remove('drag-over')"
                ondrop="handleFileDrop(event)">
                <div style="font-size:44px;margin-bottom:10px">📁</div>
                <h4>Drop your Excel file here</h4>
                <p>or click to browse</p>
                <input type="file" id="file-input" accept=".xlsx,.csv"
                  style="display:none" onchange="handleFileSelect(event)">
                <button class="btn btn-gold" style="margin-top:8px"
                  onclick="document.getElementById('file-input').click()">
                  📂 Choose File
                </button>
              </div>
              <div id="file-selected" style="display:none;margin-top:12px;padding:10px 14px;
                background:var(--gray-50);border-radius:8px;font-size:13px;
                color:var(--navy);font-weight:600"></div>
            </div>
          </div>

        </div>

        <!-- RIGHT: Excel Specifications -->
        <div class="card">
          <div class="card-header">
            <h3>📄 Excel File Specifications</h3>
          </div>
          <div class="card-body" style="padding:0">

            <!-- Format summary -->
            <div style="padding:14px 18px;background:var(--gray-50);
                 border-bottom:1px solid var(--gray-200)">
              <div style="font-size:13px;color:var(--gray-600);line-height:1.7">
                Your Excel file must meet the following requirements exactly.
                Use the column headers below as the <strong>first row</strong> of your spreadsheet.
                Download the template for a ready-made file.
              </div>
              <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-gold btn-sm" onclick="downloadTemplate()">
                  ⬇ Download Template
                </button>
                <span style="font-size:12px;color:var(--gray-400);align-self:center">
                  Accepted formats: .xlsx · .csv
                </span>
              </div>
            </div>

            <!-- Column table -->
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse">
                <thead>
                  <tr style="background:var(--navy)">
                    <th style="padding:10px 14px;text-align:left;font-size:11px;
                        font-weight:700;color:var(--gold);letter-spacing:0.5px;white-space:nowrap">
                      COLUMN HEADER
                    </th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;
                        font-weight:700;color:var(--gold);letter-spacing:0.5px">
                      REQUIRED
                    </th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;
                        font-weight:700;color:var(--gold);letter-spacing:0.5px">
                      FORMAT / ACCEPTED VALUES
                    </th>
                    <th style="padding:10px 14px;text-align:left;font-size:11px;
                        font-weight:700;color:var(--gold);letter-spacing:0.5px">
                      EXAMPLE
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${[
                    {
                      col: 'student_index_number',
                      req: true,
                      fmt: 'Text. Must be unique within the same batch.',
                      ex:  'UCC/GST/2024/001',
                    },
                    {
                      col: 'full_name',
                      req: true,
                      fmt: 'Full name exactly as it should appear on the certificate.',
                      ex:  'Kwame Asante Mensah',
                    },
                    {
                      col: 'programme',
                      req: true,
                      fmt: 'Full programme name.',
                      ex:  'MSc Computer Science',
                    },
                    {
                      col: 'department',
                      req: true,
                      fmt: 'Department offering the programme.',
                      ex:  'Computer Science',
                    },
                    {
                      col: 'faculty',
                      req: true,
                      fmt: 'Faculty the department belongs to.',
                      ex:  'Science',
                    },
                    {
                      col: 'level',
                      req: true,
                      fmt: 'Exactly one of: <code>Masters</code> · <code>MPhil</code> · <code>PhD</code> · <code>MBA</code>',
                      ex:  'Masters',
                    },
                    {
                      col: 'thesis_status',
                      req: true,
                      fmt: 'One of: <code>Submitted</code> · <code>Examined</code> · <code>Pending</code> · <code>N/A</code>',
                      ex:  'Submitted',
                    },
                    {
                      col: 'graduation_year',
                      req: true,
                      fmt: 'Four-digit year. Must be a number, not text.',
                      ex:  '2024',
                    },
                    {
                      col: 'effective_date',
                      req: true,
                      fmt: 'Date the qualification took effect. Format: YYYY-MM-DD (e.g. 2024-03-31)',
                      ex:  '2024-03-31',
                    },
                    {
                      col: 'email',
                      req: false,
                      fmt: 'Valid email address. Leave blank if not available.',
                      ex:  'k.mensah@stu.ucc.edu.gh',
                    },
                    {
                      col: 'phone',
                      req: false,
                      fmt: 'Phone number. Leave blank if not available.',
                      ex:  '0244000000',
                    },
                  ].map((r, i) => `
                    <tr style="border-bottom:1px solid var(--gray-100);
                        background:${i % 2 === 0 ? '#fff' : 'var(--gray-50)'}">
                      <td style="padding:10px 14px">
                        <code style="font-size:12px;font-weight:700;color:var(--navy);
                            background:#EFF6FF;padding:3px 7px;border-radius:5px">
                          ${r.col}
                        </code>
                      </td>
                      <td style="padding:10px 14px;text-align:center">
                        ${r.req
                          ? `<span style="color:var(--danger);font-weight:700;font-size:13px">Yes</span>`
                          : `<span style="color:var(--gray-400);font-size:13px">No</span>`}
                      </td>
                      <td style="padding:10px 14px;font-size:12px;color:var(--gray-600);line-height:1.5">
                        ${r.fmt}
                      </td>
                      <td style="padding:10px 14px;font-family:monospace;
                          font-size:12px;color:var(--navy);white-space:nowrap">
                        ${r.ex}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>

            <!-- Common mistakes -->
            <div style="padding:14px 18px;border-top:1px solid var(--gray-200)">
              <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">
                ⚠️ Common Mistakes to Avoid
              </div>
              <div style="display:flex;flex-direction:column;gap:5px">
                ${[
                  'Do not rename or reorder the column headers.',
                  'Do not include merged cells, coloured rows, or extra formatting.',
                  'The first row must be the header row — no title rows above it.',
                  'The <code>level</code> column must be exactly: Masters, MPhil, PhD, or MBA.',
                  'The <code>graduation_year</code> must be a number (2024), not text ("2024").',
                  'Do not include a serial number or row-count column.',
                  'Remove any blank rows between records.',
                ].map(m => `
                  <div style="font-size:12px;color:var(--gray-600);
                      display:flex;gap:8px;align-items:flex-start">
                    <span style="color:var(--danger);flex-shrink:0;margin-top:1px">✕</span>
                    <span>${m}</span>
                  </div>`).join('')}
              </div>
            </div>

          </div>
        </div>

      </div><!-- /grid -->
    `;
  }

  // ================================================================
  //  STEP 2 — Validate & Preview
  // ================================================================
  else if (uploadStep === 2 && validationResult) {
    const v = validationResult;
    content.innerHTML = stepHTML + `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px">
        ${[
          { label:'Total Records', value:v.total,             c:'var(--success)', bg:'#F0FDF4', br:'#BBF7D0' },
          { label:'Valid Records', value:v.valid,             c:'var(--success)', bg:'#DCFCE7', br:'#86EFAC' },
          { label:'Duplicates',    value:v.dups.length,       c: v.dups.length       ? 'var(--warning)' : 'var(--success)', bg: v.dups.length       ? '#FEF3C7' : '#F0FDF4', br: v.dups.length       ? '#FDE68A' : '#BBF7D0' },
          { label:'Already Issued',value:v.alreadyIssued.length, c: v.alreadyIssued.length ? 'var(--danger)'  : 'var(--success)', bg: v.alreadyIssued.length ? '#FEE2E2' : '#F0FDF4', br: v.alreadyIssued.length ? '#FECACA' : '#BBF7D0' },
        ].map(s => `
          <div style="background:${s.bg};border:1px solid ${s.br};border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:${s.c}">${s.value}</div>
            <div style="font-size:12px;color:${s.c};font-weight:600;margin-top:4px">${s.label}</div>
          </div>`).join('')}
      </div>

      ${v.errors.length > 0 ? `
        <div class="alert alert-warning" style="margin-bottom:16px">
          <span>⚠️</span>
          <div>
            <strong>${v.errors.length} row${v.errors.length !== 1 ? 's' : ''} skipped</strong>
            due to missing required fields:<br>
            <span style="font-size:12px">${v.errors.map(e => `Row ${e.row}: missing ${e.missing}`).join(' · ')}</span>
          </div>
        </div>` : ''}

      <div class="card">
        <div class="card-header">
          <h3>Preview — ${parsedRows.length} Records in File</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="uploadStep=1;renderUploadStep()">← Back</button>
            <button class="btn btn-gold" onclick="importBatch()" ${v.valid === 0 ? 'disabled' : ''}>
              📥 Import ${v.valid} Valid Record${v.valid !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Row</th><th>Index No.</th><th>Name</th><th>Programme</th><th>Level</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${parsedRows.map((row, idx) => {
                const isDup    = v.dups.includes(row.student_index_number);
                const isCert   = v.alreadyIssued.includes(row.student_index_number);
                const isError  = v.errors.find(e => e.row === idx + 2);
                return `<tr style="background:${isDup||isCert?'#FFF7ED':isError?'#FEF2F2':''}">
                  <td style="font-size:11px;color:var(--gray-400)">${idx + 2}</td>
                  <td style="font-family:monospace;font-size:12px;font-weight:700;color:var(--navy)">
                    ${escHtml(row.student_index_number)}
                  </td>
                  <td style="font-size:13px;font-weight:600">${escHtml(row.full_name)}</td>
                  <td style="font-size:12px;color:var(--gray-600)">${escHtml(row.programme)}</td>
                  <td style="font-size:12px">${escHtml(row.level)}</td>
                  <td>
                    ${isError  ? badge('⚠️ Missing Fields', 'Rejected')
                    : isDup    ? badge('⚠️ Duplicate',      'Rejected')
                    : isCert   ? badge('🏅 Cert Issued',    'Issued')
                               : badge('✅ Valid',           'Approved')}
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
  //  STEP 3 — Success
  // ================================================================
  else if (uploadStep === 3) {
    content.innerHTML = stepHTML + `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:56px 24px">
          <div style="font-size:64px;margin-bottom:16px">✅</div>
          <h3 style="font-size:20px;font-weight:800;color:var(--navy);margin-bottom:8px">
            Upload Successful!
          </h3>
          <p style="color:var(--gray-600);margin-bottom:24px">
            Records have been imported and queued for verification.
          </p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button class="btn btn-outline" onclick="renderUpload()">
              📤 Upload Another Batch
            </button>
            <button class="btn btn-gold" onclick="navigateTo('students')">
              View Students →
            </button>
          </div>
        </div>
      </div>
    `;
  }
}


// ================================================================
//  FILE HANDLING
// ================================================================
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone')?.classList.remove('drag-over');
  const file = e.dataTransfer?.files[0];
  if (file) readFile(file);
}

function handleFileSelect(e) {
  const file = e.target?.files[0];
  if (file) readFile(file);
}

function readFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'csv'].includes(ext)) {
    showToast('Only .xlsx and .csv files are supported.', 'error');
    return;
  }

  const nameEl = document.getElementById('file-selected');
  if (nameEl) {
    nameEl.style.display = 'block';
    nameEl.innerHTML = `📄 <strong>${escHtml(file.name)}</strong>
      <span style="color:var(--gray-400);font-weight:400;margin-left:6px">
        (${(file.size / 1024).toFixed(1)} KB)
      </span>`;
  }

  const batchName = document.getElementById('batch-name')?.value.trim();
  if (!batchName) {
    showToast('Please enter a Batch Name before uploading.', 'warning');
    return;
  }

  const reader    = new FileReader();
  reader.onload   = async (ev) => {
    try {
      const data  = new Uint8Array(ev.target.result);
      const wb    = XLSX.read(data, { type: 'array' });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      const rows  = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) { showToast('The file appears to be empty.', 'error'); return; }

      // Normalise + map column aliases
      parsedRows = rows.map(r => ({
        student_index_number: String(r.student_index_number || r['Index Number'] || r['Index No'] || r['IndexNo'] || '').trim(),
        full_name:            smartCase(String(r.full_name            || r['Full Name']    || r['Name']    || '').trim()),
        programme:            smartCase(String(r.programme            || r['Programme']    || r['Program'] || '').trim()),
        department:           smartCase(String(r.department           || r['Department']   || '').trim()),
        faculty:              smartCase(String(r.faculty              || r['Faculty']      || '').trim()),
        level:                String(r.level                || r['Level']        || '').trim(),
        thesis_status:        String(r.thesis_status        || r['Thesis Status']|| r['Thesis']  || 'Pending').trim(),
        graduation_year:      parseInt(r.graduation_year   || r['Graduation Year'] || r['Year']  || 0),
        effective_date:       String(r.effective_date      || r['Effective Date']|| r['Eff Date'] || r['Date'] || '').trim(),
        email:                String(r.email               || r['Email']        || '').trim().toLowerCase(),
        phone:                String(r.phone               || r['Phone']        || '').trim(),
      }));

      await validateRows(batchName);
    } catch (err) {
      showToast('Could not read file: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function validateRows(batchName) {
  showToast('Validating records…', 'info');

  // Required field check
  const REQUIRED = ['student_index_number','full_name','programme','department','faculty','level','graduation_year'];
  const errors   = [];
  parsedRows.forEach((row, i) => {
    const missing = REQUIRED.filter(f => !row[f] || row[f] === '0');
    if (missing.length) errors.push({ row: i + 2, missing: missing.join(', ') });
  });

  const validRows = parsedRows.filter((_, i) => !errors.find(e => e.row === i + 2));
  const indexes   = validRows.map(r => r.student_index_number);

  // Check existing index numbers in DB
  // A duplicate is SAME index number in SAME batch only
  // Same student in a different year/batch is allowed
  const { data: existing } = await db
    .from('students')
    .select('student_index_number, graduation_batch')
    .in('student_index_number', indexes.length ? indexes : ['__none__']);

  // Build a set of "index|batch" combinations that already exist
  const existingSet = new Set(
    (existing || []).map(s => s.student_index_number + '|' + batchName)
  );
  // Also flag pure index duplicates within same batch from the file itself
  const existingIndexOnly = new Set((existing || []).map(s => s.student_index_number));

  // Check already-issued (these should never get a second certificate
  // regardless of batch or year)
  const { data: issued } = await db
    .from('students_full')
    .select('student_index_number')
    .in('cert_status', ['Issued', 'Collected'])
    .in('student_index_number', indexes.length ? indexes : ['__none__']);
  const issuedSet = new Set((issued || []).map(s => s.student_index_number));

  // Flag as duplicate only if the index exists in the SAME batch name
  const dups = validRows
    .filter(r => existingIndexOnly.has(r.student_index_number))
    .map(r => r.student_index_number);
  const alreadyIssued = indexes.filter(idx => issuedSet.has(idx));
  const valid        = validRows.filter(r =>
    !dups.includes(r.student_index_number) &&
    !alreadyIssued.includes(r.student_index_number)
  ).length;

  validationResult = { total: parsedRows.length, valid, dups, alreadyIssued, errors };
  uploadStep = 2;
  renderUploadStep();
}

async function importBatch() {
  const batchName = document.getElementById('batch-name')?.value.trim() || 'Unknown';
  const year      = document.getElementById('batch-year')?.value.trim() || '2024/2025';
  const v         = validationResult;
  if (!v || v.valid === 0) { showToast('No valid records to import.', 'warning'); return; }

  const btn = document.querySelector('#page-content .btn-gold:last-child');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loader" style="width:14px;height:14px;border-width:2px;border-color:rgba(255,255,255,0.3);border-top-color:#fff"></span> Importing…'; }

  try {
    // 1. Create the batch record
    const { data: batch, error: bErr } = await db
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
    if (bErr) throw bErr;

    // 2. Build only the valid rows to insert
    //    NEVER delete or overwrite existing students - only ADD new ones
    const toInsert = parsedRows
      .filter((r, idx) =>
        r.student_index_number &&
        r.full_name &&
        !v.dups.includes(r.student_index_number) &&
        !v.alreadyIssued.includes(r.student_index_number) &&
        !v.errors.find(e => e.row === idx + 2)
      )
      .map(r => ({
        student_index_number: r.student_index_number,
        full_name:            r.full_name,
        programme:            r.programme,
        department:           r.department,
        faculty:              r.faculty,
        level:                r.level,
        thesis_status:        r.thesis_status || 'Pending',
        graduation_year:      r.graduation_year,
        graduation_batch:     batchName,
        effective_date:       r.effective_date || null,
        email:                r.email  || null,
        phone:                r.phone  || null,
        uploaded_batch_id:    batch.id,
        duplicate_flag:       false,
      }));

    if (toInsert.length === 0) {
      showToast('No new records to insert after filtering.', 'warning');
      return;
    }

    // 3. Insert ONLY new students - existing records are NEVER touched
    const { data: insertedStudents, error: iErr } = await db
      .from('students')
      .insert(toInsert)
      .select('id');
    if (iErr) throw iErr;

    // 4. Create qualified_students rows ONLY for the newly inserted IDs
    if (insertedStudents && insertedStudents.length > 0) {
      const { error: qErr } = await db
        .from('qualified_students')
        .insert(insertedStudents.map(s => ({
          student_id:           s.id,
          qualification_status: 'Pending',
        })));
      if (qErr && !qErr.message.includes('duplicate')) throw qErr;
    }

    // 5. Insert duplicate records WITH duplicate_flag=true so they appear
    //    in the Duplicate Review page for the admin to resolve
    const dupRows = parsedRows
      .filter((r, idx) =>
        r.student_index_number &&
        r.full_name &&
        v.dups.includes(r.student_index_number) &&
        !v.alreadyIssued.includes(r.student_index_number) &&
        !v.errors.find(e => e.row === idx + 2)
      )
      .map(r => ({
        student_index_number: r.student_index_number,
        full_name:            r.full_name,
        programme:            r.programme,
        department:           r.department,
        faculty:              r.faculty,
        level:                r.level,
        thesis_status:        r.thesis_status || 'Pending',
        graduation_year:      r.graduation_year,
        graduation_batch:     batchName,
        effective_date:       r.effective_date || null,
        email:                r.email  || null,
        phone:                r.phone  || null,
        uploaded_batch_id:    batch.id,
        duplicate_flag:       true,   // ← flagged for Duplicate Review
      }));

    if (dupRows.length > 0) {
      const { data: dupInserted, error: dErr } = await db
        .from('students')
        .insert(dupRows)
        .select('id');
      // Ignore unique constraint errors for dups that truly already exist
      if (dErr && !dErr.message.includes('duplicate key')) throw dErr;

      // Also queue them in qualified_students as Pending
      if (dupInserted && dupInserted.length > 0) {
        await db.from('qualified_students').insert(
          dupInserted.map(s => ({ student_id: s.id, qualification_status: 'Pending' }))
        );
      }
    }

    await logAudit(
      `Batch uploaded: ${batchName} - ${insertedStudents?.length || 0} new records added`,
      batchName, 'uploaded_batches'
    );
    uploadStep = 3;
    renderUploadStep();

  } catch (err) {
    showToast('Import failed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `Import ${v.valid} Valid Records`; }
  }
}


// ================================================================
//  DOWNLOAD EXCEL TEMPLATE
// ================================================================
function downloadTemplate() {
  // Build a sample workbook with the exact required headers + 2 example rows
  const sampleData = [
    {
      student_index_number: 'UCC/GST/2024/001',
      full_name:            'Kwame Asante Mensah',
      programme:            'Master of Science (Computer Science)',
      department:           'Computer Science and Information Technology',
      faculty:              'Faculty of Physical Sciences',
      level:                'Masters',
      thesis_status:        'Submitted',
      graduation_year:      2024,
      effective_date:       '2024-03-31',
      email:                'k.mensah@stu.ucc.edu.gh',
      phone:                '0244000000',
    },
    {
      student_index_number: 'UCC/GST/2024/002',
      full_name:            'Adwoa Sarpong Boateng',
      programme:            'Doctor of Philosophy (Economics)',
      department:           'Economics',
      faculty:              'Faculty of Social Sciences',
      level:                'PhD',
      thesis_status:        'Examined',
      graduation_year:      2024,
      effective_date:       '2024-09-30',
      email:                'a.boateng@stu.ucc.edu.gh',
      phone:                '0201000000',
    },
    {
      student_index_number: 'UCC/GST/2024/003',
      full_name:            'Ama Owusu Barimah',
      programme:            'Master of Philosophy (English Language)',
      department:           'English',
      faculty:              'Faculty of Arts',
      level:                'MPhil',
      thesis_status:        'Examined',
      graduation_year:      2024,
      effective_date:       '2024-03-31',
      email:                '',
      phone:                '',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'student_index_number','full_name','programme','department',
      'faculty','level','thesis_status','graduation_year',
      'effective_date','email','phone',
    ],
  });

  // Set column widths
  ws['!cols'] = [
    { wch:22 },{ wch:30 },{ wch:40 },{ wch:32 },
    { wch:28 },{ wch:10 },{ wch:16 },{ wch:18 },{ wch:16 },{ wch:30 },{ wch:15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Qualified Students');
  XLSX.writeFile(wb, 'UCC_GradClearance_Upload_Template.xlsx');
  showToast('✅ Template downloaded. Fill it in and upload here.', 'success');
}
