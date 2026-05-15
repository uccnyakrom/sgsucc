// ================================================================
//  js/auth.js — Authentication + Password Change
// ================================================================
//
//  HOW TO ONBOARD A NEW STAFF MEMBER:
//  1. Go to Supabase → Authentication → Users → Add user
//  2. Enter their email, set password to:  UCC@2025!
//     (or whatever your default is — update DEFAULT_PASSWORD below)
//  3. Do NOT tick "Auto Confirm User" — just click Save
//  4. Run this SQL to give them a role:
//       UPDATE user_profiles SET role='Verification Officer',
//       full_name='Their Full Name' WHERE id=(
//       SELECT id FROM auth.users WHERE email='their@email.com');
//  5. Tell the staff member: log in at your portal URL
//     with email + password UCC@2025!
//  6. The portal will immediately ask them to set a new password.
// ================================================================

window.currentUser = null;

// ---- Change this to whatever default password you give new users ----
const DEFAULT_PASSWORD = 'UCC@2025!';

async function initAuth() {
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
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display        = 'none';
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await loadUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      document.getElementById('login-page').style.display = 'flex';
      document.getElementById('app').style.display        = 'none';
    }
  });
}

async function loadUserProfile(authUser) {
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
    showToast('Your account is deactivated. Contact your administrator.', 'error');
    await db.auth.signOut();
    return;
  }

  const pwChanged = !!localStorage.getItem('pw_changed_' + authUser.id);

  window.currentUser = {
    id:          authUser.id,
    email:       authUser.email,
    full_name:   profile.full_name,
    role:        profile.role,
    department:  profile.department || '',
    avatar:      profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    mustChangePw: !pwChanged,
  };

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display        = 'flex';
  renderSidebar();
  renderTopbar();
  navigateTo('dashboard');
  await logAudit('User signed in', authUser.email, 'auth');

  if (!pwChanged) {
    // Force password change — modal cannot be dismissed
    setTimeout(() => openChangePasswordModal(true), 700);
  } else {
    showToast(`Welcome back, ${profile.full_name.split(' ')[0]}! 👋`, 'success');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent   = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled  = true;
  btn.innerHTML = 'Signing in…';

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent   = 'Incorrect email or password. Please try again.';
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.innerHTML       = '🔐 Sign In Securely';
  }
}

async function handleLogout() {
  await logAudit('User signed out', window.currentUser?.email, 'auth');
  await db.auth.signOut();
}


// ================================================================
//  CHANGE PASSWORD MODAL
// ================================================================

function openChangePasswordModal(firstLogin = false) {
  openModal(`
    <div class="modal-head">
      <h3>${firstLogin ? '🔑 Set Your Personal Password' : '🔑 Change Password'}</h3>
      ${firstLogin
        ? `<span style="font-size:11px;background:#FEE2E2;color:#991B1B;
               padding:4px 10px;border-radius:6px;font-weight:700">REQUIRED</span>`
        : `<button class="modal-close" onclick="closeModal()">×</button>`}
    </div>
    <div class="modal-body">

      ${firstLogin
        ? `<div style="padding:14px 16px;background:#FEF9C3;border:1px solid #FDE68A;
               border-radius:10px;margin-bottom:20px;font-size:13px;color:#92400E;line-height:1.7">
             <strong>⚠️ You are using a temporary default password.</strong><br>
             Your administrator set a default password for your account.
             You must create your own personal password to continue using the portal.
           </div>`
        : `<div style="padding:10px 14px;background:var(--gray-50);border-radius:9px;
               margin-bottom:20px;font-size:13px;color:var(--gray-600)">
             Changing password for:
             <strong style="color:var(--navy)">${escHtml(window.currentUser?.email)}</strong>
           </div>`}

      <div id="chpw-alert" style="display:none"></div>

      <!-- New password -->
      <div class="form-group">
        <label>New Password <span style="color:var(--danger)">*</span></label>
        <input type="password" id="chpw-new" class="form-control"
          placeholder="Choose a strong password"
          oninput="chpwStrength(this.value)"
          autocomplete="new-password">

        <div style="margin-top:8px">
          <div style="height:6px;background:var(--gray-200);border-radius:99px;overflow:hidden">
            <div id="chpw-bar"
              style="height:100%;border-radius:99px;width:0%;
                     background:var(--gray-200);transition:width .3s,background .3s">
            </div>
          </div>
          <span id="chpw-slabel"
            style="font-size:11px;font-weight:700;color:var(--gray-400)"></span>
        </div>

        <div style="margin-top:12px;display:flex;flex-direction:column;gap:7px">
          <div id="chpw-r1" class="pw-req"><span class="pw-dot">○</span> At least 8 characters</div>
          <div id="chpw-r2" class="pw-req"><span class="pw-dot">○</span> At least one uppercase letter (A–Z)</div>
          <div id="chpw-r3" class="pw-req"><span class="pw-dot">○</span> At least one number (0–9)</div>
          <div id="chpw-r4" class="pw-req"><span class="pw-dot">○</span> At least one special character (!@#$%&*)</div>
        </div>
      </div>

      <!-- Confirm password -->
      <div class="form-group" style="margin-top:18px">
        <label>Confirm New Password <span style="color:var(--danger)">*</span></label>
        <input type="password" id="chpw-confirm" class="form-control"
          placeholder="Re-enter your new password"
          autocomplete="new-password">
      </div>

    </div>
    <div class="modal-footer">
      ${!firstLogin ? `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>` : ''}
      <button class="btn btn-gold" id="chpw-btn" onclick="submitChangePassword()">
        ✅ Save New Password
      </button>
    </div>
  `, '520px');
}

const PW_RULES = [
  { id:'chpw-r1', fn: v => v.length >= 8,                     label:'At least 8 characters' },
  { id:'chpw-r2', fn: v => /[A-Z]/.test(v),                   label:'At least one uppercase letter (A–Z)' },
  { id:'chpw-r3', fn: v => /[0-9]/.test(v),                   label:'At least one number (0–9)' },
  { id:'chpw-r4', fn: v => /[!@#$%^&*(),.?":{}|<>]/.test(v), label:'At least one special character (!@#$%&*)' },
];

function chpwStrength(val) {
  const score = PW_RULES.reduce((n, rule) => {
    const el  = document.getElementById(rule.id);
    const met = rule.fn(val);
    if (el) {
      el.innerHTML = `<span class="pw-dot">${met ? '✓' : '○'}</span> ${rule.label}`;
      met ? el.classList.add('pw-req-met') : el.classList.remove('pw-req-met');
    }
    return n + (met ? 1 : 0);
  }, 0);

  const bar   = document.getElementById('chpw-bar');
  const lbl   = document.getElementById('chpw-slabel');
  const lvls  = [
    { w:'0%',   c:'#E2E8F0', t:'' },
    { w:'25%',  c:'#DC2626', t:'Weak' },
    { w:'50%',  c:'#D97706', t:'Fair' },
    { w:'75%',  c:'#CA8A04', t:'Good' },
    { w:'100%', c:'#16A34A', t:'Strong ✓' },
  ];
  const lv = lvls[score] || lvls[0];
  if (bar) { bar.style.width = lv.w; bar.style.background = lv.c; }
  if (lbl) { lbl.textContent = lv.t; lbl.style.color = lv.c; }
}

async function submitChangePassword() {
  const newPw   = document.getElementById('chpw-new')?.value    || '';
  const confPw  = document.getElementById('chpw-confirm')?.value || '';
  const alertEl = document.getElementById('chpw-alert');
  const btn     = document.getElementById('chpw-btn');

  const showAlert = (msg, type) => {
    alertEl.innerHTML    = `<div class="alert alert-${type}" style="margin-bottom:14px">
      <span>${type === 'error' ? '❌' : '⚠️'}</span><div>${msg}</div></div>`;
    alertEl.style.display = 'block';
  };
  alertEl.style.display = 'none';

  if (!newPw) { showAlert('Please enter a new password.', 'warning'); return; }
  if (newPw !== confPw) { showAlert('Passwords do not match. Please re-enter them.', 'error'); return; }
  if (!PW_RULES.every(r => r.fn(newPw))) {
    showAlert('Please meet all four password requirements above.', 'warning'); return;
  }

  btn.disabled    = true;
  btn.textContent = 'Saving…';

  const { error } = await db.auth.updateUser({ password: newPw });

  if (error) {
    showAlert('Error: ' + error.message, 'error');
    btn.disabled    = false;
    btn.textContent = '✅ Save New Password';
    return;
  }

  localStorage.setItem('pw_changed_' + window.currentUser.id, '1');
  window.currentUser.mustChangePw = false;
  await logAudit('User changed password', window.currentUser.email, 'auth');
  closeModal();
  showToast('✅ Password changed! Use your new password next time you sign in.', 'success');
}


// ================================================================
//  SIDEBAR & TOPBAR
// ================================================================
function renderSidebar() {
  const u     = window.currentUser;
  const items = [
    { id:'dashboard',  label:'Dashboard',           icon:'📊', perm:null },
    { id:'students',   label:'Students',             icon:'👥', perm:null },
    { id:'upload',     label:'Upload Batch',         icon:'📤', perm:'upload' },
    { id:'duplicates', label:'Duplicate Review',     icon:'⚠️', perm:null },
    { id:'issuance',   label:'Certificate Issuance', icon:'🏅', perm:'issue' },
    { id:'reports',    label:'Reports',              icon:'📋', perm:'reports' },
    { id:'audit',      label:'Audit Logs',           icon:'🔍', perm:'audit' },
    { id:'users',      label:'User Management',      icon:'⚙️', perm:'users' },
  ].filter(i => !i.perm || can(i.perm));

  document.getElementById('sidebar-nav').innerHTML =
    items.map(i => `
      <button class="nav-item" id="nav-${i.id}" onclick="navigateTo('${i.id}')">
        <span class="nav-icon">${i.icon}</span>
        <span class="nav-label">${i.label}</span>
      </button>`).join('') +
    `<button class="nav-item" onclick="openChangePasswordModal(false)"
       style="margin-top:8px">
       <span class="nav-icon">🔑</span>
       <span class="nav-label">Change Password</span>
     </button>`;

  document.getElementById('sidebar-avatar').textContent = u.avatar;
  document.getElementById('sidebar-name').textContent   = u.full_name.split(' ')[0];
  document.getElementById('sidebar-role').textContent   = u.role.split(' ').pop();
}

function renderTopbar() {
  const u = window.currentUser;
  document.getElementById('topbar-avatar').textContent = u.avatar;
  document.getElementById('topbar-name').textContent   = u.full_name;
  document.getElementById('topbar-role').textContent   = u.role;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
  document.getElementById('main').classList.toggle('sidebar-collapsed');
}
