// ================================================================
//  js/duplicates.js — Duplicate Detection & Resolution
// ================================================================

async function renderDuplicates() {
  const content = document.getElementById('page-content');

  const { data: dups, error } = await db
    .from('students_full')
    .select('*')
    .eq('duplicate_flag', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  content.innerHTML = `
    <div class="alert alert-warning" style="margin-bottom:20px">
      <span style="font-size:24px">⚠️</span>
      <div>
        <strong>${(dups||[]).length} Duplicate Record${(dups||[]).length!==1?'s':''} Detected</strong><br>
        Review and resolve all flagged records before proceeding with certificate issuance.
      </div>
    </div>
    <div id="dups-list"></div>
  `;

  const list = document.getElementById('dups-list');

  if (!dups || dups.length === 0) {
    list.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <h3>No Duplicate Records</h3>
          <p>All records are clean and free of duplicates.</p>
        </div>
      </div>`;
    return;
  }

  // For each dup, try to find the original
  const allIndexes = dups.map(s => s.student_index_number);
  const { data: originals } = await db
    .from('students_full')
    .select('*')
    .in('student_index_number', allIndexes)
    .eq('duplicate_flag', false);

  const originalsMap = {};
  (originals||[]).forEach(s => { originalsMap[s.student_index_number] = s; });

  list.innerHTML = dups.map(s => {
    const orig = originalsMap[s.student_index_number];
    return `
      <div class="dup-card">
        <div class="dup-card-header">
          <div>
            <span style="font-weight:700;color:#92400E;font-size:14px">⚠️ Possible Duplicate</span>
            <span style="font-size:12px;color:#D97706;margin-left:8px">Index: ${escHtml(s.student_index_number)}</span>
          </div>
          ${can('verify') ? `
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="resolveDuplicate('${s.id}','clear')">✓ Not a Duplicate</button>
            <button class="btn btn-danger btn-sm"  onclick="resolveDuplicate('${s.id}','reject')">Reject Record</button>
          </div>` : ''}
        </div>
        <div class="dup-card-body">
          <div class="dup-panel flagged">
            <div class="dup-panel-label" style="color:var(--gray-400)">⚑ Flagged Record (Batch ${escHtml(s.graduation_batch)})</div>
            <div style="font-size:14px;font-weight:700;color:var(--navy)">${escHtml(s.full_name)}</div>
            <div style="font-size:12px;color:var(--gray-600);margin-top:4px">${escHtml(s.programme)}</div>
            <div style="font-size:12px;color:var(--gray-400)">${escHtml(s.level)} · ${s.graduation_year}</div>
            <div style="margin-top:8px">${badge(s.approval_status||'Pending')}</div>
          </div>
          <div class="dup-panel original">
            <div class="dup-panel-label" style="color:#92400E">
              ⚑ Existing Record ${orig?`(Batch ${escHtml(orig.graduation_batch)})`:''}</div>
            ${orig ? `
              <div style="font-size:14px;font-weight:700;color:#92400E">${escHtml(orig.full_name)}</div>
              <div style="font-size:12px;color:#D97706;margin-top:4px">${escHtml(orig.programme)}</div>
              <div style="font-size:12px;color:#D97706">${escHtml(orig.level)} · ${orig.graduation_year}</div>
              ${(orig.cert_status==='Issued'||orig.cert_status==='Collected') ? `
                <div style="margin-top:8px;padding:4px 8px;background:#FEE2E2;border-radius:6px;
                     font-size:11px;font-weight:700;color:#991B1B;display:inline-block">
                  🏅 Certificate Already Issued
                </div>` : `<div style="margin-top:8px">${badge(orig.approval_status||'Pending')}</div>`}
            ` : `<div style="font-size:13px;color:#D97706;margin-top:8px">No matching original record found for this index number.</div>`}
          </div>
        </div>
      </div>`;
  }).join('');
}

async function resolveDuplicate(studentId, action) {
  // action: 'clear' = remove flag | 'reject' = flag + reject
  const updates = { duplicate_flag: false };
  const qsUpdate = action === 'reject'
    ? { qualification_status:'Rejected', remarks:'Duplicate record rejected by reviewer' }
    : { qualification_status:'Pending' };

  const { error: sErr } = await db.from('students').update(updates).eq('id', studentId);
  if (sErr) { showToast('Error: ' + sErr.message, 'error'); return; }

  const { error: qErr } = await db.from('qualified_students').upsert({
    student_id: studentId, ...qsUpdate,
    approved_by: window.currentUser.id,
    approval_date: new Date().toISOString(),
  }, { onConflict: 'student_id' });
  if (qErr) { showToast('Error: ' + qErr.message, 'error'); return; }

  await logAudit(
    action === 'reject' ? 'Duplicate record rejected' : 'Duplicate flag cleared',
    studentId, 'students'
  );
  showToast(
    action === 'reject' ? '❌ Record rejected and flagged' : '✅ Duplicate flag cleared',
    action === 'reject' ? 'warning' : 'success'
  );
  await renderDuplicates();
}
