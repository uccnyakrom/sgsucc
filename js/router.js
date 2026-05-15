// ================================================================
//  js/router.js — Page Navigation
// ================================================================

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  students:   'Student Records',
  upload:     'Upload Batch',
  duplicates: 'Duplicate Review',
  issuance:   'Certificate Issuance',
  reports:    'Reports & Exports',
  audit:      'Audit Logs',
  users:      'User Management',
};

let currentPage = null;

async function navigateTo(page) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navBtn = document.getElementById(`nav-${page}`);
  if (navBtn) navBtn.classList.add('active');

  // Update topbar title
  document.getElementById('topbar-title').textContent = PAGE_TITLES[page] || page;

  // Clear and show loader
  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="page-loader"><div class="loader"></div></div>`;
  currentPage = page;

  // Route to page renderer
  try {
    switch (page) {
      case 'dashboard':  await renderDashboard();  break;
      case 'students':   await renderStudents();   break;
      case 'upload':     await renderUpload();     break;
      case 'duplicates': await renderDuplicates(); break;
      case 'issuance':   await renderIssuance();   break;
      case 'reports':    await renderReports();    break;
      case 'audit':      await renderAudit();      break;
      case 'users':      await renderUsers();      break;
      default:
        content.innerHTML = `<div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h3>Page Not Found</h3><p>This page does not exist.</p></div>`;
    }
  } catch (err) {
    content.innerHTML = `<div class="alert alert-danger" style="margin:0">
      <span>⚠️</span><div><strong>Error loading page:</strong> ${escHtml(err.message)}</div></div>`;
    console.error(err);
  }
}
