// ================================================================
//  js/auth.js — Authentication + Password Change
// ================================================================
//
//  HOW TO ONBOARD A NEW STAFF MEMBER:
//  1. Go to Supabase → Authentication → Users → Add user
//  2. Enter their email, set password to:  UCC@2025!
//  3. ✅ TICK "Auto Confirm User" — this is required or they cannot log in
//  4. Click Save / Create User
//  5. Run this SQL in Supabase SQL Editor to assign their role:
//
//       UPDATE public.user_profiles
//       SET full_name  = 'Their Full Name',
//           role       = 'Verification Officer',
//           department = 'Their Department',
//           is_active  = true
//       WHERE id = (
//         SELECT id FROM auth.users
//         WHERE email = 'their.email@ucc.edu.gh'
//       );
//
//  6. Tell the staff member: go to the portal URL,
//     log in with their email + UCC@2025!
//     The portal will immediately ask them to set their own password.
//
//  AVAILABLE ROLES (copy exactly):
//    Super Administrator
//    Graduate School Administrator
//    Verification Officer
//    Certificate Issuance Officer
//    Read-Only Auditor
// ================================================================

window.currentUser = null;

const DEFAULT_PASSWORD = 'UCC@2025!';

// ── Safe element setter — prevents crash if element not in DOM ────────────
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setElHTML(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = value;
}
function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}
function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ================================================================
//  INITIALISE AUTH
// ================================================================
async function initAuth() {
  // Guard: Supabase not yet configured
  if (SUPABASE_URL.includes('YOUR-PROJECT')) {
    const e = document.getElementById('login-error');
    if (e) {
      e.textContent   = '⚠️ Open js/config.js and add your Supabase URL and anon key.';
      e.style.display = 'block';
    }
    return;
  }

  const { data: { session } } = await db.auth.getSession();

  if (session) {
    await loadUserProfile(session.user);
  } else {
    showEl('login-page');
    hideEl('app');
  }

  // Listen for future auth events
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await loadUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      showEl('login-page');
      hideEl('app');
    }
  });
}

// ================================================================
//  LOAD USER PROFILE
// ================================================================
async function loadUserProfile(authUser) {
  try {
    const { data: profile, error } = await db
      .from('user_profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error || !profile) {
      showToast('Profile not found. Contact your administrator.', 'error');
      await db.auth.signOut();
      return;
    }

    if (!profile.is_active) {
      showToast('Your account has been deactivated. Contact your administrator.', 'error');
      await db.auth.signOut();
      return;
    }

    // Build avatar initials safely
    const nameParts = (profile.full_name || 'User').trim().split(/\s+/);
    const avatar    = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : nameParts[0].slice(0, 2).toUpperCase();

    const pwChanged = !!localStorage.getItem('pw_changed_' + authUser.id);

    window.currentUser = {
      id:          authUser.id,
      email:       authUser.email,
      full_name:   profile.full_name   || 'User',
      role:        profile.role        || 'Read-Only Auditor',
      department:  profile.department  || '',
      avatar,
      mustChangePw: !pwChanged,
    };

    // Show the app
    hideEl('login-page');
    showEl('app');

    // Render navigation and topbar
    renderSidebar();
    renderTopbar();

    // Navigate to dashboard
    navigateTo('dashboard');

    // Log sign-in
    await logAudit('User signed in', authUser.email, 'auth');

    if (!pwChanged) {
      // First login — force password change (modal cannot be dismissed)
      setTimeout(() => openChangePasswordModal(true), 700);
    } else {
      const firstName = (profile.full_name || 'there').split(' ')[0];
      showToast(`Welcome back, ${firstName}! 👋`, 'success');
    }

  } catch (err) {
    console.error('loadUserProfile error:', err);
    showToast('An error occurred loading your profile. Please try again.', 'error');
    await db.auth.signOut();
  }
}

// ================================================================
//  LOGIN FORM
// ================================================================
async function handleLogin(e) {
  e.preventDefault();

  const email    = (document.getElementById('login-email')?.value    || '').trim();
  const password =  document.getElementById('login-password')?.value || '';
  const btn      =  document.getElementById('login-btn');
  const errEl    =  document.getElementById('login-error');

  if (errEl) errEl.style.display = 'none';

  if (!email || !password) {
    if (errEl) {
      errEl.textContent   = 'Please enter your email address and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  if (btn) {
    btn.disabled  = true;
    btn.innerHTML = '<span style="opacity:0.7">Signing in…</span>';
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    if (errEl) {
      errEl.textContent   = 'Incorrect email or password. Please try again.';
      errEl.style.display = 'block';
    }
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = '🔐 Sign In Securely';
    }
  }
  // On success, onAuthStateChange fires and calls loadUserProfile
}

// ================================================================
//  LOGOUT
// ================================================================
async function handleLogout() {
  try {
    await logAudit('User signed out', window.currentUser?.email, 'auth');
  } catch (_) {}
  await db.auth.signOut();
}

// ================================================================
//  CHANGE PASSWORD MODAL
// ================================================================
function openChangePasswordModal(firstLogin = false) {
  const email = window.currentUser?.email || '';

  openModal(`
    <div class="modal-head">
      <h3>${firstLogin ? '🔑 Set Your Personal Password' : '🔑 Change Password'}</h3>
      ${firstLogin
        ? `<span style="font-size:11px;background:#FEE2E2;color:#991B1B;
               padding:4px 10px;border-radius:6px;font-weight:700">REQUIRED</span>`
        : `<button class="modal-close" onclick="closeModal()">×</button>`
      }
    </div>
    <div class="modal-body">

      ${firstLogin
        ? `<div style="padding:14px 16px;background:#FEF9C3;border:1px solid #FDE68A;
               border-radius:10px;margin-bottom:20px;font-size:13px;
               color:#92400E;line-height:1.7">
             <strong>⚠️ You are using a temporary password.</strong><br>
             Your administrator created a default password for your account.
             You must set your own personal password before you can use the portal.
           </div>`
        : `<div style="padding:10px 14px;background:var(--gray-50);
               border-radius:9px;margin-bottom:20px;
               font-size:13px;color:var(--gray-600)">
             Changing password for:
             <strong style="color:var(--navy)">${escHtml(email)}</strong>
           </div>`
      }

      <div id="chpw-alert" style="display:none"></div>

      <div class="form-group">
        <label>New Password <span style="color:var(--danger)">*</span></label>
        <input type="password" id="chpw-new" class="form-control"
          placeholder="Choose a strong password"
          oninput="chpwStrength(this.value)"
          autocomplete="new-password">

        <!-- Strength bar -->
        <div style="margin-top:10px">
          <div style="height:6px;background:var(--gray-200);
               border-radius:99px;overflow:hidden">
            <div id="chpw-bar"
              style="height:100%;border-radius:99px;width:0%;
                     background:var(--gray-200);transition:width .3s,background .3s">
            </div>
          </div>
          <span id="chpw-slabel"
            style="font-size:11px;font-weight:700;
                   color:var(--gray-400);margin-top:4px;display:block"></span>
        </div>

        <!-- Requirements checklist -->
        <div style="margin-top:14px;display:flex;flex-direction:column;gap:7px">
          <div id="chpw-r1" class="pw-req">
            <span class="pw-dot">○</span> At least 8 characters
          </div>
          <div id="chpw-r2" class="pw-req">
            <span class="pw-dot">○</span> At least one uppercase letter (A–Z)
          </div>
          <div id="chpw-r3" class="pw-req">
            <span class="pw-dot">○</span> At least one number (0–9)
          </div>
          <div id="chpw-r4" class="pw-req">
            <span class="pw-dot">○</span> At least one special character (!@#$%&*)
          </div>
        </div>
      </div>

      <div class="form-group" style="margin-top:18px">
        <label>Confirm New Password <span style="color:var(--danger)">*</span></label>
        <input type="password" id="chpw-confirm" class="form-control"
          placeholder="Re-enter your new password"
          autocomplete="new-password">
      </div>

    </div>
    <div class="modal-footer">
      ${!firstLogin
        ? `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`
        : ''
      }
      <button class="btn btn-gold" id="chpw-btn"
        onclick="submitChangePassword()">
        ✅ Save New Password
      </button>
    </div>
  `, '520px');
}

// ── Password rules ────────────────────────────────────────────────────────
const PW_RULES = [
  { id: 'chpw-r1', fn: v => v.length >= 8,
    label: 'At least 8 characters' },
  { id: 'chpw-r2', fn: v => /[A-Z]/.test(v),
    label: 'At least one uppercase letter (A–Z)' },
  { id: 'chpw-r3', fn: v => /[0-9]/.test(v),
    label: 'At least one number (0–9)' },
  { id: 'chpw-r4', fn: v => /[!@#$%^&*(),.?":{}|<>]/.test(v),
    label: 'At least one special character (!@#$%&*)' },
];

function chpwStrength(val) {
  let score = 0;
  PW_RULES.forEach(rule => {
    const el  = document.getElementById(rule.id);
    const met = rule.fn(val);
    if (el) {
      el.innerHTML = `<span class="pw-dot">${met ? '✓' : '○'}</span> ${rule.label}`;
      met ? el.classList.add('pw-req-met') : el.classList.remove('pw-req-met');
    }
    if (met) score++;
  });

  const levels = [
    { w: '0%',   c: '#E2E8F0', t: '' },
    { w: '25%',  c: '#DC2626', t: 'Weak' },
    { w: '50%',  c: '#D97706', t: 'Fair' },
    { w: '75%',  c: '#CA8A04', t: 'Good' },
    { w: '100%', c: '#16A34A', t: 'Strong ✓' },
  ];
  const lv  = levels[score] || levels[0];
  const bar = document.getElementById('chpw-bar');
  const lbl = document.getElementById('chpw-slabel');
  if (bar) { bar.style.width = lv.w; bar.style.background = lv.c; }
  if (lbl) { lbl.textContent = lv.t; lbl.style.color = lv.c; }
}

async function submitChangePassword() {
  const newPw  = document.getElementById('chpw-new')?.value     || '';
  const confPw = document.getElementById('chpw-confirm')?.value || '';
  const alertEl = document.getElementById('chpw-alert');
  const btn     = document.getElementById('chpw-btn');

  const showAlert = (msg, type) => {
    if (!alertEl) return;
    alertEl.innerHTML =
      `<div class="alert alert-${type}" style="margin-bottom:14px">
         <span>${type === 'error' ? '❌' : '⚠️'}</span>
         <div>${msg}</div>
       </div>`;
    alertEl.style.display = 'block';
  };
  if (alertEl) alertEl.style.display = 'none';

  if (!newPw) {
    showAlert('Please enter a new password.', 'warning'); return;
  }
  if (newPw !== confPw) {
    showAlert('Passwords do not match. Please re-enter them.', 'error'); return;
  }
  if (!PW_RULES.every(r => r.fn(newPw))) {
    showAlert('Please meet all four password requirements listed above.', 'warning'); return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const { error } = await db.auth.updateUser({ password: newPw });

  if (error) {
    showAlert('Error: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✅ Save New Password'; }
    return;
  }

  localStorage.setItem('pw_changed_' + window.currentUser.id, '1');
  window.currentUser.mustChangePw = false;

  try {
    await logAudit('User changed password', window.currentUser.email, 'auth');
  } catch (_) {}

  closeModal();
  showToast('✅ Password changed successfully. Use your new password next time you sign in.', 'success');
}

// ================================================================
//  SIDEBAR
// ================================================================
function renderSidebar() {
  const u = window.currentUser;
  if (!u) return;

  const navEl = document.getElementById('sidebar-nav');
  if (!navEl) return;

  const items = [
    { id: 'dashboard',  label: 'Dashboard',           icon: '📊', perm: null },
    { id: 'students',   label: 'Students',             icon: '👥', perm: null },
    { id: 'upload',     label: 'Upload Batch',         icon: '📤', perm: 'upload' },
    { id: 'duplicates', label: 'Duplicate Review',     icon: '⚠️', perm: null },
    { id: 'issuance',   label: 'Certificate Issuance', icon: '🏅', perm: 'issue' },
    { id: 'reports',    label: 'Reports',              icon: '📋', perm: 'reports' },
    { id: 'audit',      label: 'Audit Logs',           icon: '🔍', perm: 'audit' },
    { id: 'users',      label: 'User Management',      icon: '⚙️', perm: 'users' },
  ].filter(i => !i.perm || can(i.perm));

  navEl.innerHTML =
    items.map(i => `
      <button class="nav-item" id="nav-${i.id}"
        onclick="navigateTo('${i.id}')">
        <span class="nav-icon">${i.icon}</span>
        <span class="nav-label">${i.label}</span>
      </button>`).join('') +
    `<button class="nav-item" onclick="openChangePasswordModal(false)"
       style="margin-top:8px">
       <span class="nav-icon">🔑</span>
       <span class="nav-label">Change Password</span>
     </button>`;

  // Sidebar user info — all null-safe
  setEl('sidebar-avatar', u.avatar);
  setEl('sidebar-name',   u.full_name.split(' ')[0]);
  setEl('sidebar-role',   u.role.split(' ').pop());
}

// ================================================================
//  TOPBAR  — all element writes are null-safe
// ================================================================
function renderTopbar() {
  const u = window.currentUser;
  if (!u) return;

  setEl('topbar-avatar', u.avatar);
  setEl('topbar-name',   u.full_name);
  setEl('topbar-role',   u.role);
}

// ================================================================
//  SIDEBAR TOGGLE (mobile)
// ================================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  if (sidebar) sidebar.classList.toggle('collapsed');
  if (main)    main.classList.toggle('sidebar-collapsed');
}
