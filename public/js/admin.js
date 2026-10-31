/* admin.js (Member 3) - Admin dashboard logic. Milestone 1: overview page. */
(function () {
  'use strict';

  /* ---------- MOCK DATA (used ONLY if the API is unavailable) ---------- */
  const MOCK_STATS = {
    pendingPackages: 4, totalUsers: 128, totalProviders: 14, totalBookings: 311,
    totalRevenue: 1245000
  };
  const MOCK_PENDING = [
    { packageId: 21, name: 'Coorg Coffee Escape', providerName: 'GreenTrail Tours', destination: 'Coorg', price: 12000, submittedAt: '2026-10-29' },
    { packageId: 22, name: 'Jaisalmer Desert Camp', providerName: 'Thar Voyages', destination: 'Jaisalmer', price: 18500, submittedAt: '2026-10-30' }
  ];

  async function loadOverview() {
    const statsEl = document.getElementById('statsGrid');
    const pendingEl = document.getElementById('pendingList');
    TM.showLoading(statsEl, 'Loading statistics…');
    TM.showLoading(pendingEl, 'Loading pending packages…');

    let usedMock = false;
    try {
      const r = await Promise.all([
        TM.api('/admin/stats', { mock: MOCK_STATS }),
        TM.api('/admin/packages?status=pending&limit=5', { mock: { packages: MOCK_PENDING } })
      ]);
      usedMock = r[0].mock || r[1].mock;
      renderStats(statsEl, r[0].data);
      renderPending(pendingEl, (r[1].data && r[1].data.packages) || []);
    } catch (err) {
      TM.showError(statsEl, err.message);
      TM.showError(pendingEl, 'Could not load packages: ' + err.message);
    }
    TM.mockBanner(usedMock);
  }

  function renderStats(el, s) {
    el.className = 'grid grid--stats';
    el.innerHTML =
      TM.statCard('⏳', 'Pending Approvals', s.pendingPackages, 'warn') +
      TM.statCard('👥', 'Customers & Users', s.totalUsers, '') +
      TM.statCard('🏢', 'Providers', s.totalProviders, 'info') +
      TM.statCard('🎫', 'Total Bookings', s.totalBookings, 'info') +
      TM.statCard('💰', 'Platform Revenue', TM.money(s.totalRevenue), 'ok');
  }

  function renderPending(el, rows) {
    if (!rows.length) { TM.showEmpty(el, '🎉 No packages are waiting for approval.'); return; }
    el.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>ID</th><th>Package</th><th>Provider</th><th>Destination</th><th>Price</th><th>Submitted</th><th>Action</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (p) {
        return '<tr><td>#' + TM.esc(p.packageId) + '</td><td>' + TM.esc(p.name) + '</td><td>' + TM.esc(p.providerName) +
          '</td><td>' + TM.esc(p.destination) + '</td><td>' + TM.money(p.price) + '</td><td>' + TM.fmtDate(p.submittedAt) +
          '</td><td><a class="btn btn--sm" href="../admin/approvals.html">Review</a></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!TM.renderShell()) return;
    if (document.getElementById('statsGrid')) loadOverview();
  });
})();
