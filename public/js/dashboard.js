/* LocalTrails dashboards: real session-authenticated APIs, no mock data. */
(() => {
  'use strict';

  const role = document.body.dataset.role;
  const provider = role === 'provider';
  const superAdmin = role === 'super_admin';
  const apiRoot = provider ? '/api/provider' : '/api/admin';

  const sections = provider
    ? [
        ['overview', 'Overview'],
        ['packages', 'My packages'],
        ['availability', 'Availability'],
        ['bookings', 'Bookings'],
        ['reviews', 'Reviews'],
        ['earnings', 'Earnings']
      ]
    : [
        ['overview', 'Overview'],
        ['providers', 'Provider approvals'],
        ['packages', 'Package approvals'],
        ['customers', 'Customers'],
        ['destinations', 'Manage Destinations'],
        ['categories', 'Manage Categories'],
        ['bookings', 'All bookings'],
        ['reports', 'Reports & Analytics'],
        ['logs', 'System Activity'],
        ...(superAdmin ? [['admins', 'Administrators']] : [])
      ];

  const navIcons = {
    overview: '▦',
    packages: '▤',
    availability: '▣',
    bookings: '▥',
    reviews: '✧',
    earnings: '↗',
    providers: '♧',
    customers: '♙',
    admins: '♜',
    destinations: '⌖',
    categories: '▦',
    reports: '▥',
    logs: '▤'
  };

  let section = 'overview';
  let cache = {};
  let catalog = null;
  let account = null;

  const app = document.getElementById('app');

  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);

  const date = value => value
    ? new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '—';

  const iso = value => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);

    const valueString = String(value);

    if (/^\d{4}-\d{2}-\d{2}/.test(valueString)) {
      return valueString.slice(0, 10);
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? ''
      : parsed.toISOString().slice(0, 10);
  };

  const money = value =>
    '₹' + Number(value || 0).toLocaleString('en-IN');

  const formatStatus = status =>
    `<span class="status status-${e(status)}">${e(status || '—')}</span>`;

  async function request(path, method = 'GET', body) {
    const response = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(json.message || `Request failed (${response.status})`);
    }

    return json.data ?? json;
  }

  const api = (path = '', method = 'GET', body) =>
    request(
      apiRoot + path + (
        provider ? '' : '?role=' + encodeURIComponent(role)
      ),
      method,
      body
    );

  const cell = value => `<td>${e(value ?? '—')}</td>`;

  function table(headers, rows) {
    return `
      <div class="panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>${headers.map(x => `<th>${e(x)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${rows.length
                ? rows.join('')
                : `<tr><td colspan="${headers.length}" class="empty">No records found</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  const btn = (name, id, label, cls = '') =>
    `<button type="button" class="table-btn ${cls}"
      data-task="${e(name)}" data-id="${e(id)}">${e(label)}</button>`;

  const stat = (label, value) =>
    `<article class="stat-card">
      <div class="stat-head">${e(label)}</div>
      <strong>${e(value)}</strong>
    </article>`;

  const stats = items =>
    `<div class="stats-grid">
      ${items.map(([label, value]) => stat(label, value)).join('')}
    </div>`;

  function flash(message, error = false) {
    const node = document.getElementById('message');

    if (!node) return;

    node.textContent = message;
    node.className = 'message ' + (error ? 'error' : 'success');
  }

  function shell() {
    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar" id="sidebar">
          <a class="brand" href="/">
            <span class="brand-icon">L</span>
            <span>
              <strong>LocalTrails</strong>
              <small>TOURISM PLATFORM</small>
            </span>
          </a>

          <div class="work-label">
            ${provider ? 'PROVIDER' : superAdmin ? 'SUPER ADMIN' : 'ADMIN'}
            WORKSPACE
          </div>

          <nav class="nav">
            ${sections.map(([key, label]) => `
              <a href="#${key}" data-nav="${key}">
                <span class="nav-symbol" aria-hidden="true">
                  ${navIcons[key] || '•'}
                </span>
                ${e(label)}
              </a>
            `).join('')}
          </nav>

          <div class="sidebar-bottom">
            <a href="/">Website</a>
            <button class="btn" id="sign-out">Sign out</button>
          </div>
        </aside>

        <div class="main-shell">
          <header class="topbar">
            <button class="menu-toggle" id="toggle-menu">☰</button>

            <span class="breadcrumb">
              LocalTrails / <strong id="crumb">Overview</strong>
            </span>

            <div class="topbar-right">
              <span class="account-name">${e(account.name)}</span>
              <span class="avatar">
                ${e((account.name || 'U').slice(0, 2).toUpperCase())}
              </span>
            </div>
          </header>

          <main class="content">
            <div class="page-heading">
              <div>
                <span class="eyebrow">OPERATIONS</span>
                <h1 id="heading">Overview</h1>
                <p id="summary">Current information from LocalTrails</p>
              </div>
              <div id="page-action"></div>
            </div>

            <p id="message" class="message" role="status"></p>

            <section id="body">
              <div class="loading">Loading…</div>
            </section>
          </main>
        </div>
      </div>

      <dialog id="editor" class="lt-dialog">
        <form id="editor-form" method="dialog">
          <header>
            <h2 id="editor-title"></h2>
          </header>

          <div id="editor-fields"></div>

          <footer>
            <button class="btn" type="button" id="cancel-dialog">
              Cancel
            </button>

            <button class="btn primary" type="submit">
              Save
            </button>
          </footer>
        </form>
      </dialog>`;

    document.getElementById('sign-out').onclick = async () => {
      try {
        await request(
          '/api/auth/logout?role=' + encodeURIComponent(role),
          'POST'
        );

        location.href = provider
          ? '/login.html'
          : superAdmin
            ? '/superadmin/login.html'
            : '/admin/login.html';

      } catch (err) {
        flash(err.message, true);
      }
    };

    document.getElementById('toggle-menu').onclick = () =>
      document.getElementById('sidebar').classList.toggle('open');

    document.getElementById('cancel-dialog').onclick = () =>
      document.getElementById('editor').close();
  }

  function setAction(label, fn) {
    const parent = document.getElementById('page-action');

    parent.replaceChildren();

    if (label) {
      const button = document.createElement('button');

      button.className = 'btn primary';
      button.textContent = label;
      button.onclick = fn;

      parent.append(button);
    }
  }

  function showError(err) {
    document.getElementById('body').innerHTML = `
      <div class="error-panel">
        <h2>Unable to load ${e(section)}</h2>
        <p>${e(err.message)}</p>
        <button class="btn" id="retry">Retry</button>
      </div>`;

    document.getElementById('retry').onclick = load;
  }

  async function load() {
    section = location.hash.slice(1);

    if (!sections.some(([key]) => key === section)) {
      section = 'overview';
    }

    document.querySelectorAll('[data-nav]').forEach(node => {
      node.classList.toggle('active', node.dataset.nav === section);
    });

    const label = sections.find(([key]) => key === section)[1];

    document.getElementById('heading').textContent = label;
    document.getElementById('crumb').textContent = label;

    document.getElementById('body').innerHTML =
      '<div class="loading">Loading live records…</div>';

    document.getElementById('message').textContent = '';

    setAction();

    try {
      await render();
    } catch (err) {
      showError(err);
    }
  }

  async function render() {
    let rows;
    const body = document.getElementById('body');

    // OVERVIEW
    if (section === 'overview') {
      const overview = await api(
        provider ? '/dashboard' : '/overview'
      );

      body.innerHTML = provider
        ? stats([
            ['Packages', overview.total_packages],
            ['Active packages', overview.active_packages],
            ['Bookings', overview.total_bookings],
            ['Booking value', money(overview.revenue)]
          ])
        : stats([
            ['Providers', overview.providers],
            ['Pending providers', overview.pending_providers],
            ['Packages', overview.packages],
            ['Pending packages', overview.pending_packages],
            ['Total bookings', overview.bookings],
            ['Active bookings', overview.active_bookings],
            ['Completed bookings', overview.completed_bookings],
            ['Cancelled bookings', overview.cancelled_bookings],
            ['Customers', overview.customers],
            ['Booking value', money(overview.booked_value)]
          ]);

      body.innerHTML += `
        <div class="panel padded">
          <h2>Manage operations</h2>
          <p class="muted">
            Use the navigation to review live records, manage approvals,
            and follow up on outstanding tasks.
          </p>
        </div>`;

      return;
    }

    // PROVIDER EARNINGS
    if (section === 'earnings') {
      const earnings = await api('/earnings');

      body.innerHTML = stats([
        ['Paid bookings', earnings.paid_bookings],
        ['Total earnings', money(earnings.total_earnings)]
      ]);

      return;
    }

    // PACKAGES
    if (section === 'packages') {
      rows = await api('/packages');
      cache.packages = rows;

      body.innerHTML = table(
        provider
          ? ['Package', 'Destination', 'Price', 'Capacity', 'Status', 'Actions']
          : ['Package', 'Provider', 'Price', 'Status', 'Actions'],

        rows.map(p => `
          <tr>
            ${cell(p.title)}
            ${cell(
              provider
                ? (p.destination_name || p.destination)
                : p.provider
            )}
            ${cell(money(p.price))}
            ${provider ? cell(p.capacity) : ''}
            <td>${formatStatus(p.status)}</td>
            <td>
              ${
                provider
                  ? btn('package-edit', p.package_id, 'Edit') +
                    btn('package-delete', p.package_id, 'Delete', 'danger')
                  : p.status === 'pending'
                    ? btn('package-status', p.package_id ?? p.id, 'Approve') +
                      btn('package-reject', p.package_id ?? p.id, 'Reject', 'danger')
                    : p.status === 'active'
                      ? btn('package-disable', p.package_id ?? p.id, 'Disable', 'danger')
                      : btn('package-status', p.package_id ?? p.id, 'Activate')
              }
            </td>
          </tr>
        `)
      );

      if (provider) {
        setAction('+ Add package', () => packageEditor());
      }

      return;
    }

    // AVAILABILITY
    if (section === 'availability') {
      rows = await api('/availability');
      cache.availability = rows;
      cache.packages = cache.packages ?? await api('/packages');

      body.innerHTML = table(
        ['Package', 'Date', 'Capacity', 'Booked', 'Status', 'Actions'],

        rows.map(a => `
          <tr>
            ${cell(a.title)}
            ${cell(date(a.available_date))}
            ${cell(a.total_capacity)}
            ${cell(a.booked_seats)}
            <td>${formatStatus(a.status)}</td>
            <td>${btn('availability-edit', a.availability_id, 'Edit')}</td>
          </tr>
        `)
      );

      setAction('+ Add departure', () => availabilityEditor());

      return;
    }

    // BOOKINGS
    if (section === 'bookings') {
      rows = await api('/bookings');
      cache.bookings = rows;

      body.innerHTML = table(
        ['Booking', 'Package', 'Customer', 'Guests', 'Total', 'Status', 'Actions'],

        rows.map(b => `
          <tr>
            ${cell('#' + (b.booking_id ?? b.id))}
            ${cell(b.title ?? b.package_title)}
            ${cell(b.customer_name ?? b.customer)}
            ${cell(b.number_of_people)}
            ${cell(money(b.total_amount))}
            <td>${formatStatus(b.booking_status ?? b.status)}</td>
            <td>${btn('booking-update', b.booking_id ?? b.id, 'Update')}</td>
          </tr>
        `)
      );

      return;
    }

    // REVIEWS
    if (section === 'reviews') {
      rows = await api('/reviews');

      body.innerHTML = table(
        ['Package', 'Customer', 'Rating', 'Comment', 'Date'],

        rows.map(r => `
          <tr>
            ${cell(r.title)}
            ${cell(r.customer_name)}
            ${cell('★ ' + r.rating)}
            ${cell(r.comment)}
            ${cell(date(r.review_date))}
          </tr>
        `)
      );

      return;
    }

    // PROVIDERS, CUSTOMERS AND ADMINS
    if (['providers', 'customers', 'admins'].includes(section)) {
      rows = await api('/' + section);
      cache[section] = rows;

      body.innerHTML = table(
        ['Name', 'Email', 'Joined', 'Status', 'Actions'],

        rows.map(u => `
          <tr>
            ${cell(u.name)}
            ${cell(u.email)}
            ${cell(date(u.created_at))}
            <td>${formatStatus(u.status)}</td>
            <td>
              ${
                section === 'customers'
                  ? btn(
                      'customer-status',
                      u.id,
                      u.status === 'active' ? 'Block' : 'Activate'
                    )
                  : section === 'admins'
                    ? btn(
                        'admin-status',
                        u.id,
                        u.status === 'active' ? 'Block' : 'Activate'
                      )
                    : btn(
                        'provider-status',
                        u.id,
                        u.status === 'active' ? 'Block' : 'Activate'
                      ) +
                      (u.status === 'pending'
                        ? btn('provider-reject', u.id, 'Reject', 'danger')
                        : '')
              }
            </td>
          </tr>
        `)
      );

      return;
    }

    // DESTINATIONS
    if (section === 'destinations') {
      rows = await api('/destinations');
      cache.destinations = rows;

      body.innerHTML = table(
        ['Destination', 'City', 'State', 'Country', 'Status', 'Actions'],

        rows.map(d => `
          <tr>
            ${cell(d.name)}
            ${cell(d.city)}
            ${cell(d.state)}
            ${cell(d.country)}
            <td>${formatStatus(d.status)}</td>
            <td>
              ${btn('destination-edit', d.destination_id, 'Edit')}
            </td>
          </tr>
        `)
      );

      setAction('+ Add destination', () => destinationEditor());

      return;
    }

    // CATEGORIES
    if (section === 'categories') {
      rows = await api('/categories');
      cache.categories = rows;

      body.innerHTML = table(
        ['Category', 'Description', 'Status', 'Actions'],

        rows.map(c => `
          <tr>
            ${cell(c.name)}
            ${cell(c.description)}
            <td>${formatStatus(c.status)}</td>
            <td>
              ${btn('category-edit', c.category_id, 'Edit')}
            </td>
          </tr>
        `)
      );

      setAction('+ Add category', () => categoryEditor());

      return;
    }

    // REPORTS
    if (section === 'reports') {
      const report = await api('/reports');
      const summary = report.summary || {};

      body.innerHTML = stats([
        ['Total bookings', summary.total_bookings],
        ['Active bookings', summary.active_bookings],
        ['Completed bookings', summary.completed_bookings],
        ['Cancelled bookings', summary.cancelled_bookings],
        ['Booking value', money(summary.total_booking_value)]
      ]) +
        `<div class="panel padded">
          <h2>Monthly booking and revenue report</h2>
        </div>` +
        table(
          ['Month', 'Bookings', 'Booking value'],

          (report.monthly || []).map(m => `
            <tr>
              ${cell(m.month)}
              ${cell(m.bookings)}
              ${cell(money(m.revenue))}
            </tr>
          `)
        );

      return;
    }

    // SYSTEM LOGS
    if (section === 'logs') {
      rows = await api('/logs');

      body.innerHTML = table(
        ['User', 'Action', 'Description', 'IP Address', 'Date'],

        rows.map(log => `
          <tr>
            ${cell(log.user_name || 'System')}
            ${cell(log.action)}
            ${cell(log.description)}
            ${cell(log.ip_address)}
            ${cell(date(log.created_at))}
          </tr>
        `)
      );

      return;
    }
  }

  // FORM HELPERS
  const input = (label, name, value = '', type = 'text', extra = '') => `
    <label class="form-field">
      <span>${e(label)}</span>
      <input
        name="${e(name)}"
        type="${e(type)}"
        value="${e(value)}"
        ${extra}
      >
    </label>`;

  const select = (label, name, options, value) => `
    <label class="form-field">
      <span>${e(label)}</span>
      <select name="${e(name)}" required>
        ${options.map(([v, text]) => `
          <option
            value="${e(v)}"
            ${String(v) === String(value) ? 'selected' : ''}
          >${e(text)}</option>
        `).join('')}
      </select>
    </label>`;

  const text = (label, name, value = '') => `
    <label class="form-field full">
      <span>${e(label)}</span>
      <textarea name="${e(name)}">${e(value)}</textarea>
    </label>`;

  async function catalogOptions() {
    if (!catalog) {
      catalog = await request('/api/catalog/options');
    }

    return catalog;
  }

  async function editor(title, fields, save) {
    document.getElementById('editor-title').textContent = title;

    document.getElementById('editor-fields').innerHTML =
      `<div class="form-grid">${fields}</div>`;

    const form = document.getElementById('editor-form');

    form.onsubmit = async event => {
      event.preventDefault();

      const button = form.querySelector('[type=submit]');
      button.disabled = true;

      try {
        await save(Object.fromEntries(new FormData(form)));

        document.getElementById('editor').close();

        flash('Saved successfully');

        await load();

      } catch (err) {
        alert(err.message);

      } finally {
        button.disabled = false;
      }
    };

    document.getElementById('editor').showModal();
  }

  // PACKAGE FORM
  async function packageEditor(p) {
    try {
      const options = await catalogOptions();

      if (!options.destinations?.length || !options.categories?.length) {
        throw new Error(
          'Add destinations and categories before creating packages.'
        );
      }

      const fields =
        input('Title', 'title', p?.title || '', 'text', 'required') +

        select(
          'Destination',
          'destination_id',
          options.destinations.map(x => [x.id, x.name]),
          p?.destination_id
        ) +

        select(
          'Category',
          'category_id',
          options.categories.map(x => [x.id, x.name]),
          p?.category_id
        ) +

        input(
          'Duration (days)',
          'duration',
          p?.duration || 1,
          'number',
          'min="1" required'
        ) +

        input(
          'Price (₹)',
          'price',
          p?.price || '',
          'number',
          'min="1" step="0.01" required'
        ) +

        input(
          'Capacity',
          'capacity',
          p?.capacity || 1,
          'number',
          'min="1" required'
        ) +

        input(
          'Available from',
          'available_from',
          iso(p?.available_from),
          'date'
        ) +

        input(
          'Image URL',
          'image_url',
          p?.image_url || '',
          'url'
        ) +

        text('Description', 'description', p?.description || '');

      await editor(
        p ? 'Edit package' : 'Create package',
        fields,
        async data => {
          for (const key of [
            'destination_id',
            'category_id',
            'duration',
            'price',
            'capacity'
          ]) {
            data[key] = Number(data[key]);
          }

          await api(
            '/packages' + (p ? '/' + p.package_id : ''),
            p ? 'PUT' : 'POST',
            data
          );
        }
      );

    } catch (err) {
      flash(err.message, true);
    }
  }

  // AVAILABILITY FORM
  async function availabilityEditor(a) {
    try {
      const packages = cache.packages ?? await api('/packages');

      if (!packages.length) {
        throw new Error('Create a package first.');
      }

      const fields =
        select(
          'Package',
          'package_id',
          packages.map(p => [p.package_id, p.title]),
          a?.package_id
        ) +

        input(
          'Departure date',
          'available_date',
          iso(a?.available_date),
          'date',
          'required'
        ) +

        input(
          'Total capacity',
          'total_capacity',
          a?.total_capacity || 1,
          'number',
          'min="1" required'
        ) +

        (
          a
            ? select(
                'Status',
                'status',
                [
                  ['available', 'Available'],
                  ['closed', 'Closed']
                ],
                a.status
              )
            : ''
        );

      await editor(
        a ? 'Edit departure' : 'Add departure',
        fields,
        async data => {
          data.package_id = Number(data.package_id);
          data.total_capacity = Number(data.total_capacity);

          await api(
            '/availability' + (a ? '/' + a.availability_id : ''),
            a ? 'PUT' : 'POST',
            data
          );
        }
      );

    } catch (err) {
      flash(err.message, true);
    }
  }

  // DESTINATION FORM
  async function destinationEditor(destination) {
    const fields =
      input(
        'Destination name',
        'name',
        destination?.name || '',
        'text',
        'required'
      ) +

      input(
        'City',
        'city',
        destination?.city || '',
        'text',
        'required'
      ) +

      input(
        'State',
        'state',
        destination?.state || '',
        'text',
        'required'
      ) +

      input(
        'Country',
        'country',
        destination?.country || '',
        'text',
        'required'
      ) +

      (
        destination
          ? select(
              'Status',
              'status',
              [
                ['active', 'Active'],
                ['inactive', 'Inactive']
              ],
              destination.status
            )
          : ''
      );

    await editor(
      destination ? 'Edit destination' : 'Add destination',
      fields,
      async data => {
        await api(
          '/destinations' +
            (destination ? '/' + destination.destination_id : ''),
          destination ? 'PUT' : 'POST',
          data
        );

        catalog = null;
      }
    );
  }

  // CATEGORY FORM
  async function categoryEditor(category) {
    const fields =
      input(
        'Category name',
        'name',
        category?.name || '',
        'text',
        'required'
      ) +

      text(
        'Description',
        'description',
        category?.description || ''
      ) +

      (
        category
          ? select(
              'Status',
              'status',
              [
                ['active', 'Active'],
                ['inactive', 'Inactive']
              ],
              category.status
            )
          : ''
      );

    await editor(
      category ? 'Edit category' : 'Add category',
      fields,
      async data => {
        await api(
          '/categories' +
            (category ? '/' + category.category_id : ''),
          category ? 'PUT' : 'POST',
          data
        );
      }
    );
  }

  // BUTTON ACTIONS
  app.addEventListener('click', async event => {
    const button = event.target.closest('[data-task]');

    if (!button) return;

    const task = button.dataset.task;
    const id = Number(button.dataset.id);

    try {
      if (task === 'package-edit') {
        const pkg = cache.packages.find(
          x => Number(x.package_id) === id
        );

        return packageEditor(pkg);
      }

      if (task === 'availability-edit') {
        const item = cache.availability.find(
          x => Number(x.availability_id) === id
        );

        return availabilityEditor(item);
      }

      if (task === 'destination-edit') {
        const item = cache.destinations.find(
          x => Number(x.destination_id) === id
        );

        return destinationEditor(item);
      }

      if (task === 'category-edit') {
        const item = cache.categories.find(
          x => Number(x.category_id) === id
        );

        return categoryEditor(item);
      }

      if (task === 'package-delete') {
        if (!confirm('Delete this package? This cannot be undone.')) {
          return;
        }

        await api('/packages/' + id, 'DELETE');
        await load();

        return;
      }

      if (task === 'booking-update') {
        const booking = cache.bookings.find(
          x => Number(x.booking_id ?? x.id) === id
        );

        const currentStatus =
          booking?.booking_status ?? booking?.status ?? 'pending';

        await editor(
          'Update booking',

          select(
            'Status',
            'status',
            [
              ['pending', 'Pending'],
              ['confirmed', 'Confirmed'],
              ['completed', 'Completed'],
              ['cancelled', 'Cancelled']
            ],
            currentStatus
          ),

          data => api(
            '/bookings/' + id,
            'PATCH',
            provider
              ? { booking_status: data.status }
              : data
          )
        );

        return;
      }

      if (task === 'customer-status') {
        const customer = cache.customers.find(
          x => Number(x.id) === id
        );

        const status =
          customer.status === 'active' ? 'blocked' : 'active';

        if (!confirm(`Set ${customer.name} to ${status}?`)) {
          return;
        }

        await api(
          '/customers/' + id + '/status',
          'PATCH',
          { status }
        );

        await load();

        return;
      }

      if (
        task === 'provider-status' ||
        task === 'provider-reject' ||
        task === 'admin-status'
      ) {
        const key = task === 'admin-status'
          ? 'admins'
          : 'providers';

        const user = cache[key].find(
          x => Number(x.id) === id
        );

        const status = task === 'provider-reject'
          ? 'rejected'
          : user.status === 'active'
            ? 'blocked'
            : 'active';

        if (!confirm(`Set ${user.name} to ${status}?`)) {
          return;
        }

        await api(
          '/' + key + '/' + id,
          'PATCH',
          { status }
        );

        await load();

        return;
      }

      if (
        task === 'package-status' ||
        task === 'package-reject' ||
        task === 'package-disable'
      ) {
        const status = task === 'package-reject'
          ? 'rejected'
          : task === 'package-disable'
            ? 'disabled'
            : 'active';

        if (!confirm(`Change package status to ${status}?`)) {
          return;
        }

        await api(
          '/packages/' + id,
          'PATCH',
          { status }
        );

        await load();
      }

    } catch (err) {
      flash(err.message, true);
    }
  });

  window.addEventListener('hashchange', load);

  // INITIALIZE DASHBOARD
  (async () => {
    try {
      const session = await request(
        '/api/auth/me?role=' + encodeURIComponent(role)
      );

      account = session.user;

      if (!account || account.role !== role) {
        throw new Error(
          'This dashboard requires a ' +
          role.replace('_', ' ') +
          ' account.'
        );
      }

      shell();
      await load();

    } catch (err) {
      app.innerHTML = `
        <main class="access-gate">
          <h1>Sign in required</h1>
          <p>${e(err.message)}</p>
          <a class="btn primary" href="${
            provider
              ? '/login.html'
              : superAdmin
                ? '/superadmin/login.html'
                : '/admin/login.html'
          }">Go to login</a>
        </main>`;
    }
  })();

})();