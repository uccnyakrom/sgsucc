// ================================================================
//  js/auth.js — Authentication (Login / Logout / Session)
// ================================================================

window.currentUser = null;

async function initAuth() {
  // Check for an existing session (user refreshed the page)
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    await loadUserProfile(session.user);
  } else {
    showLogin();
  }

  // Listen for auth state changes
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await loadUserProfile(session.user);
    } else if (event === 'SIGNED_OUT') {
      window.currentUser = null;
      showLogin();
    }
  });
}

async function loadUserProfile(authUser) {
  // Fetch the user's role and details from user_profiles
  const { data: profile, error } = await db
    .from('user_profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (error || !profile) {
    showToast('Could not load your profile. Contact your administrator.', 'error');
    await db.auth.signOut();
    return;
  }

  if (!profile.is_active) {
    showToast('Your account has been deactivated. Contact your administrator.', 'error');
    await db.auth.signOut();
    return;
  }

  window.currentUser = {
    id:         authUser.id,
    email:      authUser.email,
    full_name:  profile.full_name,
    role:       profile.role,
    department: profile.department,
    avatar:     profile.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase(),
  };

  showApp();
  showToast(`Welcome back, ${profile.full_name.split(' ')[0]}! 👋`, 'success');
  await logAudit('User signed in', authUser.email, 'auth');
}

async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> Signing in…';
  errEl.style.display = 'none';

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'Invalid email or password. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = '🔐 Sign In Securely';
  }
  // If success, onAuthStateChange fires and calls loadUserProfile
}

async function handleLogout() {
  await logAudit('User signed out', window.currentUser?.email, 'auth');
  await db.auth.signOut();
}

function showLogin() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  renderSidebar();
  renderTopbar();
  navigateTo('dashboard');
}

// ----------------------------------------------------------------
//  Sidebar & Topbar population
// ----------------------------------------------------------------
function renderSidebar() {
  const u = window.currentUser;
  const nav = document.getElementById('sidebar-nav');

  const items = [
    { id:'dashboard',  label:'Dashboard',            icon:'📊', perm:null },
    { id:'students',   label:'Students',              icon:'👥', perm:null },
    { id:'upload',     label:'Upload Batch',          icon:'📤', perm:'upload' },
    { id:'duplicates', label:'Duplicate Review',      icon:'⚠️',  perm:null },
    { id:'issuance',   label:'Certificate Issuance',  icon:'🏅', perm:'issue' },
    { id:'reports',    label:'Reports',               icon:'📋', perm:'reports' },
    { id:'audit',      label:'Audit Logs',            icon:'🔍', perm:'audit' },
    { id:'users',      label:'User Management',       icon:'⚙️',  perm:'users' },
  ].filter(i => !i.perm || can(i.perm));

  nav.innerHTML = items.map(i => `
    <button class="nav-item" id="nav-${i.id}" onclick="navigateTo('${i.id}')">
      <span class="nav-icon">${i.icon}</span>
      <span class="nav-label">${i.label}</span>
    </button>`).join('');

  // Avatar & user info
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

// ----------------------------------------------------------------
//  Sidebar collapse toggle
// ----------------------------------------------------------------
function toggleSidebar() {
  const sb   = document.getElementById('sidebar');
  const main = document.getElementById('main');
  sb.classList.toggle('collapsed');
  main.classList.toggle('sidebar-collapsed');
}
