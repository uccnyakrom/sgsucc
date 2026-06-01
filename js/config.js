// ================================================================
//  js/config.js
//  UCC Graduate Clearance Portal — Configuration
// ================================================================
//  INSTRUCTIONS:
//    Replace the two values below with your actual Supabase
//    credentials. Find them at:
//    Supabase Dashboard → Your Project → Settings → API
// ================================================================

const SUPABASE_URL  = 'https://viflvvqqcgfjhbhnlpci.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpZmx2dnFxY2dmamhiaG5scGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3OTY5NDIsImV4cCI6MjA5NDM3Mjk0Mn0.bM5kHNUgukQyNnqyo9fEtjkEyRO7ZaPlYQrutB8wWdk';

// ----------------------------------------------------------------
//  Do not edit below this line
// ----------------------------------------------------------------
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// App-wide constants
const APP_NAME    = 'UCC Graduate Clearance Portal';
const APP_VERSION = '1.0';

const ROLES = {
  SUPER_ADMIN:  'Super Administrator',
  GRAD_ADMIN:   'Graduate School Administrator',
  VERIFIER:     'Verification Officer',
  ISSUER:       'Certificate Issuance Officer',
  AUDITOR:      'Read-Only Auditor',
};

const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]:  ['upload','approve','verify','issue','reports','audit','users','settings'],
  [ROLES.GRAD_ADMIN]:   ['upload','approve','verify','reports'],
  [ROLES.VERIFIER]:     ['verify','reports'],
  [ROLES.ISSUER]:       ['issue','reports'],
  [ROLES.AUDITOR]:      ['reports','audit'],
};

function can(permission) {
  const role = window.currentUser?.role;
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}

// ----------------------------------------------------------------
//  Supabase helpers
// ----------------------------------------------------------------

async function logAudit(activity, record = '', table = '') {
  try {
    const u = window.currentUser;
    await db.from('audit_logs').insert({
      user_id:         u?.id,
      user_name:       u?.full_name,
      user_role:       u?.role,
      activity,
      affected_record: record,
      table_name:      table,
    });
  } catch (_) { /* audit log failures are silent */ }
}

function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const colors = {
    success: '#16A34A',
    error:   '#DC2626',
    warning: '#D97706',
    info:    '#0369A1',
  };
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.innerHTML = `
    <span style="font-size:18px">${icons[type]}</span>
    <span style="flex:1;font-size:14px;font-weight:500;color:#1E293B">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:#94A3B8;font-size:18px;line-height:1">×</button>
  `;
  Object.assign(toast.style, {
    position:     'fixed',
    bottom:       '28px',
    right:        '28px',
    background:   '#fff',
    border:       `2px solid ${colors[type]}`,
    borderRadius: '12px',
    padding:      '14px 18px',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.15)',
    display:      'flex',
    alignItems:   'center',
    gap:          '12px',
    zIndex:       '9999',
    maxWidth:     '380px',
    animation:    'slideUp 0.3s ease',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast?.remove(), 4000);
}

function openModal(html, width = '600px') {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  Object.assign(overlay.style, {
    position:       'fixed',
    inset:          '0',
    background:     'rgba(0,21,48,0.6)',
    backdropFilter: 'blur(4px)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         '1000',
    padding:        '16px',
  });
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;width:100%;max-width:${width};max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.25)">
      ${html}
    </div>`;
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}

function closeModal() {
  const o = document.getElementById('modal-overlay');
  if (o) o.remove();
}

function badge(label, color = '#94A3B8') {
  const map = {
    'Approved':        { bg:'#DCFCE7', fg:'#166534', dot:'#16A34A' },
    'Pending':         { bg:'#FEF9C3', fg:'#854D0E', dot:'#CA8A04' },
    'Verified':        { bg:'#DBEAFE', fg:'#1E40AF', dot:'#2563EB' },
    'Rejected':        { bg:'#FEE2E2', fg:'#991B1B', dot:'#DC2626' },
    'Issued':          { bg:'#DCFCE7', fg:'#166534', dot:'#16A34A' },
    'Collected':       { bg:'#F3E8FF', fg:'#6B21A8', dot:'#9333EA' },
    'Not Initiated':   { bg:'#F1F5F9', fg:'#475569', dot:'#94A3B8' },
    'Processing':      { bg:'#FEF9C3', fg:'#854D0E', dot:'#CA8A04' },
  };
  const c = map[label] || { bg:'#F1F5F9', fg:'#475569', dot:'#94A3B8' };
  return `<span style="background:${c.bg};color:${c.fg};display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;white-space:nowrap">
    <span style="width:6px;height:6px;border-radius:50%;background:${c.dot};flex-shrink:0"></span>${label}
  </span>`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}


// ----------------------------------------------------------------
//  smartCase — converts ALL CAPS or lowercase to proper sentence case
//  "DEPARTMENT OF ENGLISH" → "Department of English"
//  "MASTER OF PHILOSOPHY ( ENGLISH LANGUAGE)" → "Master of Philosophy (English Language)"
// ----------------------------------------------------------------
function smartCase(str) {
  if (!str) return str;
  const minorWords = new Set([
    'a','an','the','and','but','or','nor','for','so','yet',
    'at','by','in','of','on','to','up','as','is','it',
  ]);

  const capWord = (word) =>
    word.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('-');

  return str
    .toLowerCase()
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, idx, arr) => {
      if (!word) return word;
      const isAfterParen = idx > 0 && arr[idx - 1] && arr[idx - 1].endsWith('(');
      const bare = word.replace(/[()]/g, '');
      if (idx === 0 || isAfterParen || word.startsWith('(') || !minorWords.has(bare)) {
        return word.startsWith('(') ? '(' + capWord(word.slice(1)) : capWord(word);
      }
      return word;
    })
    .join(' ')
    .replace(/\s+\)/g, ')')
    .replace(/\(\s+/g, '(')
    .trim();
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
