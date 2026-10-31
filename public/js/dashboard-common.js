/* ==========================================================
   dashboard-common.js  (Member 3)
   Shared helpers for provider/admin/superadmin dashboards:
   - API wrapper with clearly-labelled MOCK fallback
   - Role guard (client side only; server MUST enforce too)
   - Sidebar/topbar renderer, toasts, formatting, state helpers

   ASSUMPTIONS TO CONFIRM WITH MEMBER 2 (change in CONFIG only):
   - API base path is /api
   - Login stores JWT in localStorage key "token" and the user object
     {id, name, email, role} in "user". role: customer | provider | admin | superadmin
   - Requests send header  Authorization: Bearer <token>
   ========================================================== */
(function (global) {
  'use strict';

  const CONFIG = {
    API_BASE: '/api',              // absolute: backend route, not a file path
    TOKEN_KEY: 'token',
    USER_KEY: 'user',
    LOGIN_URL: '../login.html',    // Member 1's login page (public/login.html)
    USE_MOCK_WHEN_API_DOWN: true,  // set false once Member 2's APIs are tested
    DEV_BYPASS_AUTH: true          // set false before final integration
  };

  /* ---------- Navigation per role ---------- */
  const NAV = {
    provider: [
      { href: '../provider/dashboard.html', icon: '📊', label: 'Dashboard' },
      { href: '../provider/add-package.html', icon: '➕', label: 'Add Package' },
      { href: '../provider/packages.html', icon: '🧳', label: 'My Packages' },
      { href: '../provider/bookings.html', icon: '🎫', label: 'Bookings' }
    ],
    admin: [
      { href: '../admin/dashboard.html', icon: '📊', label: 'Dashboard' },
      { href: '../admin/approvals.html', icon: '✅', label: 'Package Approvals' },
      { href: '../admin/users.html', icon: '👥', label: 'Users & Providers' },
      { href: '../admin/bookings.html', icon: '🎫', label: 'Bookings' }
    ],
    superadmin: [
      { href: '../superadmin/dashboard.html', icon: '📊', label: 'Dashboard' },
      { href: '../superadmin/admins.html', icon: '🛡️', label: 'Administrators' },
      { href: '../superadmin/permissions.html', icon: '🔑', label: 'Permissions' },
      { href: '../superadmin/reports.html', icon: '📈', label: 'Reports & Logs' }
    ]
  };
  const ROLE_TITLE = { provider: 'Provider Panel', admin: 'Admin Panel', superadmin: 'Super Admin Panel' };

  /* ---------- Small utilities ---------- */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }
  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? esc(d) : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function badge(status) {
    const s = String(status || 'unknown').toLowerCase();
    return '<span class="badge badge--' + esc(s) + '">' + esc(s.charAt(0).toUpperCase() + s.slice(1)) + '</span>';
  }

  /* ---------- Session ---------- */
  function getUser() {
    try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY)); } catch (e) { return null; }
  }
  function getToken() {
    try { return localStorage.getItem(CONFIG.TOKEN_KEY); } catch (e) { return null; }
  }
  function logout() {
    try { localStorage.removeItem(CONFIG.TOKEN_KEY); localStorage.removeItem(CONFIG.USER_KEY); } catch (e) { /* ignore */ }
    location.href = CONFIG.LOGIN_URL;
  }

  /* Superadmin can open admin pages (assignment: "access all admin functions"). */
  function roleAllowed(userRole, pageRole) {
    if (userRole === pageRole) return true;
    return userRole === 'superadmin' && pageRole === 'admin';
  }

  /* Client-side guard = UX only. Real protection is server-side (Member 2). */
  function guard(pageRole) {
    const user = getUser();
    if (!user || !roleAllowed(user.role, pageRole)) {
      if (CONFIG.DEV_BYPASS_AUTH) {
        return { id: 0, name: 'Dev ' + pageRole, email: 'dev@example.com', role: pageRole, dev: true };
      }
      location.href = CONFIG.LOGIN_URL;
      return null;
    }
    return user;
  }

  /* ---------- API wrapper ----------
     api(path, {method, body, mock}) -> Promise<{data, mock:boolean}>
     `mock` is a function/value used ONLY when the backend is unreachable
     (network failure / 404 / 5xx) and USE_MOCK_WHEN_API_DOWN is true.
     401/403/422 etc. are never mocked: they surface as real errors. */
  async function api(path, opts) {
    opts = opts || {};
    const headers = { Accept: 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (opts.body) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(CONFIG.API_BASE + path, {
        method: opts.method || 'GET',
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'same-origin'
      });
    } catch (networkErr) {
      return useMock(opts, networkErr, 'Cannot reach server');
    }

    if (res.status === 404 || res.status >= 500) {
      return useMock(opts, null, 'Endpoint unavailable (' + res.status + ')');
    }
    let payload = null;
    try { payload = await res.json(); } catch (e) { /* empty body */ }
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (!res.ok) {
      const err = new Error((payload && payload.message) || 'Request failed (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return { data: payload, mock: false };
  }

  function useMock(opts, networkErr, reason) {
    if (CONFIG.USE_MOCK_WHEN_API_DOWN && opts.mock !== undefined) {
      const data = typeof opts.mock === 'function' ? opts.mock() : opts.mock;
      return Promise.resolve({ data: data, mock: true });
    }
    return Promise.reject(networkErr || new Error(reason));
  }

  /* ---------- UI helpers ---------- */
  function toast(message, type) {
    let area = document.getElementById('toastArea');
    if (!area) {
      area = document.createElement('div');
      area.id = 'toastArea';
      area.className = 'toast-area';
      area.setAttribute('aria-live', 'polite');
      document.body.appendChild(area);
    }
    const t = document.createElement('div');
    t.className = 'toast toast--' + (type || 'success');
    t.textContent = message;
    area.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  function showLoading(el, text) {
    el.innerHTML = '<div class="state" role="status"><div class="spinner"></div>' + esc(text || 'Loading…') + '</div>';
  }
  function showEmpty(el, text) {
    el.innerHTML = '<div class="state">' + esc(text || 'Nothing to show yet.') + '</div>';
  }
  function showError(el, text) {
    el.innerHTML = '<div class="state state--error" role="alert">⚠️ ' + esc(text || 'Something went wrong.') + '</div>';
  }
  function mockBanner(show) {
    const slot = document.getElementById('bannerSlot');
    if (!slot) return;
    slot.innerHTML = show
      ? '<div class="banner banner--mock">⚠️ <strong>Mock data</strong> — the backend API is not available, so sample data is shown. Nothing here is saved.</div>'
      : '';
  }

  /* ---------- Layout renderer ----------
     Pages contain <div id="app-shell" data-role="provider" data-title="Dashboard" data-active="/provider/dashboard.html">
     and a <template id="page-content"> holding the page-specific markup. */
  function renderShell() {
    const shell = document.getElementById('app-shell');
    if (!shell) return null;
    const role = shell.dataset.role;
    const user = guard(role);
    if (!user) return null;

    const navRole = user.role === 'superadmin' && role === 'admin' ? 'admin' : role;
    const links = NAV[navRole].map(function (l) {
      const active = location.pathname.endsWith(l.href.replace('..', ''));
      return '<li><a href="' + l.href + '"' + (active ? ' class="active" aria-current="page"' : '') + '>' +
        '<span aria-hidden="true">' + l.icon + '</span>' + esc(l.label) + '</a></li>';
    }).join('');

    const tpl = document.getElementById('page-content');
    shell.outerHTML =
      '<div class="app">' +
        '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
          '<div class="sidebar__brand">Local<span style="color:var(--c-accent)">Trails.</span><small>' + esc(ROLE_TITLE[navRole]) + '</small></div>' +
          '<ul class="sidebar__nav">' + links + '</ul>' +
          '<div class="sidebar__footer">' + esc(user.name) + '<br><small>' + esc(user.email) + '</small>' +
            '<button type="button" id="logoutBtn">Log out</button></div>' +
        '</aside>' +
        '<div class="overlay" id="overlay"></div>' +
        '<div class="main">' +
          '<header class="topbar">' +
            '<button class="menu-btn" id="menuBtn" type="button" aria-label="Open menu" aria-controls="sidebar">☰</button>' +
            '<h1>' + esc(shell.dataset.title) + '</h1>' +
            '<span class="topbar__user">Signed in as <strong>' + esc(user.name) + '</strong></span>' +
          '</header>' +
          '<main class="content"><div id="bannerSlot"></div>' + (tpl ? tpl.innerHTML : '') + '</main>' +
        '</div>' +
      '</div>';

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    function toggle(open) {
      sidebar.classList.toggle('open', open);
      overlay.classList.toggle('show', open);
    }
    document.getElementById('menuBtn').addEventListener('click', function () { toggle(!sidebar.classList.contains('open')); });
    overlay.addEventListener('click', function () { toggle(false); });
    document.getElementById('logoutBtn').addEventListener('click', logout);
    return user;
  }

  /* Stat card markup */
  function statCard(icon, label, value, variant, id) {
    return '<div class="card stat' + (variant ? ' stat--' + variant : '') + '">' +
      '<div class="stat__icon" aria-hidden="true">' + icon + '</div>' +
      '<div><div class="stat__label">' + esc(label) + '</div>' +
      '<div class="stat__value"' + (id ? ' id="' + id + '"' : '') + '>' + esc(value) + '</div></div></div>';
  }

  global.TM = {
    CONFIG: CONFIG, api: api, esc: esc, money: money, fmtDate: fmtDate, badge: badge,
    getUser: getUser, logout: logout, toast: toast,
    showLoading: showLoading, showEmpty: showEmpty, showError: showError,
    mockBanner: mockBanner, renderShell: renderShell, statCard: statCard
  };
})(window);
