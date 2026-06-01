// ================================================================
//  js/duplicates.js — Duplicate Detection & Resolution
// ================================================================

async function renderDuplicates() {
  const content = document.getElementById('page-content');

  // Fetch all flagged records
  const { data: dups, error } = await db
    .from('students_full')
    .select('*')
    .eq('duplicate_flag', true)
    .order('student_index_number', { ascending: true });

  if (error) throw error;

  // Also fetch rejected duplicates that can be deleted
  const { data: rejected } = await db
    .from('students_full')
    .select('*')
    .eq('approval_status', 'Rejected')
    .eq('duplicate_flag', false)   // previously rejected and flag cleared
    .order('full_name');

  const allFlagged = dups || [];
  const allRejected = (rejected || []).filter(s =>
    s.approval_remarks?.toLowerCase().includes('duplicate')
  );

  content.innerHTML = `
    <!-- Summary banner -->
    <div class="alert alert-warning" style="margin-bottom:20px">
      <span style="font-size:24px">⚠️</span>
      <div>
        <strong>${allFlagged.length} Duplicate Record${allFlagged.length!==1?'s':''} Pending Review</strong><br>
        Review each flagged record carefully. Resolve by clearing the flag or rejecting and deleting the duplicate.
      </div>
    </div>

    <!-- Flagged records -->
    <div id="dups-list"></div>

    <!-- Rejected duplicates awaiting deletion -->
    ${allRejected.length > 0 ? `
      <div style="margin-top:24px">
        <h3 style="font-size:15px;font-weight:700;color:var(--navy);
             margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid var(--gray-200)">
          🗑️ Rejected Records — Ready to Delete (${allRejected.length})
        </h3>
        <div id="rejected-list"></div>
      </div>` : ''}
  `;

  const list = document.getElementById('dups-list');

  if (allFlagged.length === 0) {
    list.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <h3>No Duplicate Records Pending</h3>
          <p>All flagged records have been resolved.</p>
        </div>
      </div>`;
  } else {
    // Find originals for comparison
    const allIndexes = allFlagged.map(s => s.student_index_number);
    const allNames   = allFlagged.map(s => s.full_name?.toLowerCase().trim());

    const { data: originals } = await db
      .from('students_full')
      .select('*')
      .in('student_index_number', allIndexes)
      .eq('duplicate_flag', false);

    const originalsMap = {};
    (originals||[]).forEach(s => {
      originalsMap[s.student_index_number] = s;
    });

    list.innerHTML = allFlagged.map(s => {
      const orig      = originalsMap[s.student_index_number];
      const isRejected = s.approval_status === 'Rejected';

      return `
        <div class="dup-card" style="margin-bottom:16px;
             ${isRejected ? 'border-color:#FECACA;opacity:0.85' : ''}">

          <!-- Header -->
          <div class="dup-card-header" style="${isRejected ? 'background:#FEF2F2' : ''}">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              ${isRejected
                ? `<span style="font-weight:700;color:#991B1B;font-size:14px">❌ Rejected Duplicate</span>`
                : `<span style="font-weight:700;color:#92400E;font-size:14px">⚠️ Possible Duplicate</span>`}
              <span style="font-size:12px;color:#D97706">
                Index: <strong>${escHtml(s.student_index_number)}</strong>
              </span>
              ${isRejected ? `<span style="background:#FEE2E2;color:#991B1B;
                  padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">
                  Ready to delete
                </span>` : ''}
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${!isRejected && can('verify') ? `
                <button class="btn btn-ghost btn-sm"
                  onclick="resolveDuplicate('${s.id}','clear')">
                  ✓ Not a Duplicate
                </button>
                <button class="btn btn-danger btn-sm"
                  onclick="resolveDuplicate('${s.id}','reject')">
                  ❌ Reject
                </button>` : ''}
              ${isRejected && can('approve') ? `
                <button class="btn btn-danger btn-sm"
                  onclick="confirmDeleteRecord('${s.id}','${escHtml(s.full_name)}','${escHtml(s.student_index_number)}')">
                  🗑️ Delete Permanently
                </button>` : ''}
              ${!isRejected && can('verify') ? `
                <button class="btn btn-sm"
                  style="background:#7C2D12;color:#fff"
                  onclick="rejectAndDelete('${s.id}','${escHtml(s.full_name)}','${escHtml(s.student_index_number)}')">
                  ❌ Reject & Delete
                </button>` : ''}
            </div>
          </div>

          <!-- Side-by-side comparison -->
          <div class="dup-card-body">

            <!-- Flagged record -->
            <div class="dup-panel flagged">
              <div class="dup-panel-label" style="color:var(--gray-400)">
                ⚑ Flagged Record — Batch ${escHtml(s.graduation_batch)}
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--navy)">
                ${escHtml(s.full_name)}
              </div>
              <div style="font-size:12px;color:var(--gray-600);margin-top:4px">
                ${escHtml(s.programme)}
              </div>
              <div style="font-size:12px;color:var(--gray-400)">
                ${escHtml(s.level)} · ${s.graduation_year}
                ${s.effective_date ? ` · Eff: ${formatDate(s.effective_date)}` : ''}
              </div>
              <div style="margin-top:8px">${badge(s.approval_status||'Pending')}</div>
            </div>

            <!-- Original record -->
            <div class="dup-panel original">
              <div class="dup-panel-label" style="color:#92400E">
                ⚑ Existing Record ${orig ? `— Batch ${escHtml(orig.graduation_batch)}` : ''}
              </div>
              ${orig ? `
                <div style="font-size:14px;font-weight:700;color:#92400E">
                  ${escHtml(orig.full_name)}
                </div>
                <div style="font-size:12px;color:#D97706;margin-top:4px">
                  ${escHtml(orig.programme)}
                </div>
                <div style="font-size:12px;color:#D97706">
                  ${escHtml(orig.level)} · ${orig.graduation_year}
                  ${orig.effective_date ? ` · Eff: ${formatDate(orig.effective_date)}` : ''}
                </div>
                ${(orig.cert_status==='Issued'||orig.cert_status==='Collected') ? `
                  <div style="margin-top:8px;padding:4px 8px;background:#FEE2E2;
                       border-radius:6px;font-size:11px;font-weight:700;
                       color:#991B1B;display:inline-block">
                    🏅 Certificate Already Issued
                  </div>` : `
                  <div style="margin-top:8px">${badge(orig.approval_status||'Pending')}</div>`}
              ` : `
                <div style="font-size:13px;color:#D97706;margin-top:8px">
                  No non-flagged record found with this index number.<br>
                  This may be a name-based duplicate — check the Students page.
                </div>`}
            </div>

          </div><!-- /dup-card-body -->
        </div>`;
    }).join('');
  }

  // Render rejected-but-not-yet-deleted records
  const rejList = document.getElementById('rejected-list');
  if (rejList && allRejected.length > 0) {
    rejList.innerHTML = allRejected.map(s => `
      <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;
           background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:#991B1B">${escHtml(s.full_name)}</div>
          <div style="font-size:11px;color:#DC2626;font-family:monospace">${escHtml(s.student_index_number)}</div>
          <div style="font-size:11px;color:#DC2626">${escHtml(s.programme)} · ${s.graduation_year}</div>
        </div>
        <div style="font-size:11px;color:#991B1B;font-style:italic;flex-shrink:0">
          ${escHtml(s.approval_remarks||'Rejected duplicate')}
        </div>
        ${can('approve') ? `
          <button class="btn btn-danger btn-sm" style="flex-shrink:0"
            onclick="confirmDeleteRecord('${s.id}','${escHtml(s.full_name)}','${escHtml(s.student_index_number)}')">
            🗑️ Delete
          </button>` : ''}
      </div>`).join('');
  }
}


// ================================================================
//  RESOLVE — Clear flag or Reject
// ================================================================
async function resolveDuplicate(studentId, action) {
  const qsUpdate = action === 'reject'
    ? { qualification_status:'Rejected', remarks:'Duplicate record — rejected by reviewer' }
    : { qualification_status:'Pending' };

  const { error: sErr } = await db.from('students')
    .update({ duplicate_flag: false })
    .eq('id', studentId);
  if (sErr) { showToast('Error: ' + sErr.message, 'error'); return; }

  const { error: qErr } = await db.from('qualified_students').upsert({
    student_id:    studentId,
    ...qsUpdate,
    approved_by:   window.currentUser.id,
    approval_date: new Date().toISOString(),
  }, { onConflict: 'student_id' });
  if (qErr) { showToast('Error: ' + qErr.message, 'error'); return; }

  await logAudit(
    action === 'reject' ? 'Duplicate record rejected' : 'Duplicate flag cleared',
    studentId, 'students'
  );

  showToast(
    action === 'reject'
      ? '❌ Record rejected. Use 🗑️ Delete to remove it permanently.'
      : '✅ Duplicate flag cleared — record restored to Pending.',
    action === 'reject' ? 'warning' : 'success'
  );
  await renderDuplicates();
}


// ================================================================
//  REJECT + DELETE in one step
// ================================================================
async function rejectAndDelete(studentId, name, index) {
  openModal(`
    <div class="modal-head">
      <h3>❌ Reject & Delete Record</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="padding:14px;background:#FEF2F2;border-radius:10px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:#991B1B">${escHtml(name)}</div>
        <div style="font-size:12px;color:#DC2626;font-family:monospace">${escHtml(index)}</div>
      </div>
      <div class="alert alert-danger">
        <span>⚠️</span>
        <div>
          This will <strong>permanently delete</strong> this duplicate record from the system.
          This action <strong>cannot be undone</strong>.<br><br>
          The original record with the same index number will be kept intact.
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" onclick="closeModal();executeDelete('${studentId}','${escHtml(name)}','${escHtml(index)}')">
        🗑️ Yes, Delete Permanently
      </button>
    </div>
  `, '480px');
}


// ================================================================
//  CONFIRM + DELETE already-rejected record
// ================================================================
async function confirmDeleteRecord(studentId, name, index) {
  openModal(`
    <div class="modal-head">
      <h3>🗑️ Delete Rejected Record</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="padding:14px;background:#FEF2F2;border-radius:10px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:#991B1B">${escHtml(name)}</div>
        <div style="font-size:12px;color:#DC2626;font-family:monospace">${escHtml(index)}</div>
      </div>
      <div class="alert alert-danger">
        <span>⚠️</span>
        <div>
          This will <strong>permanently delete</strong> this rejected record.
          This action <strong>cannot be undone</strong>.<br><br>
          Only delete records you are certain are duplicates with no valid use.
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"
        onclick="closeModal();executeDelete('${studentId}','${escHtml(name)}','${escHtml(index)}')">
        🗑️ Yes, Delete Permanently
      </button>
    </div>
  `, '480px');
}


// ================================================================
//  EXECUTE PERMANENT DELETE
// ================================================================
async function executeDelete(studentId, name, index) {
  try {
    // 1. Delete from qualified_students first (foreign key)
    await db.from('qualified_students')
      .delete()
      .eq('student_id', studentId);

    // 2. Delete from certificate_issuance if exists
    await db.from('certificate_issuance')
      .delete()
      .eq('student_id', studentId);

    // 3. Delete the student record
    const { error } = await db.from('students')
      .delete()
      .eq('id', studentId);

    if (error) throw error;

    await logAudit(
      `Duplicate record permanently deleted: ${name}`,
      index,
      'students'
    );

    closeModal();
    showToast(`🗑️ ${name} has been permanently deleted from the system.`, 'success');
    await renderDuplicates();

  } catch (err) {
    showToast('Error deleting record: ' + err.message, 'error');
  }
}
