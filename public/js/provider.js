/* provider.js (Member 3) - Provider dashboard logic. Milestone 1: overview page. */
(function () {
  'use strict';

  /* ---------- MOCK DATA (used ONLY if GET /api/provider/stats etc. are unavailable) ---------- */
  const MOCK_STATS = { totalPackages: 6, totalBookings: 42, pendingBookings: 5, totalRevenue: 186500 };
  const MOCK_RECENT = [
    { bookingId: 101, customerName: 'Anita Rao', packageName: 'Munnar Tea Trails', travelDate: '2026-11-20', travelers: 2, totalAmount: 15000, status: 'pending', paymentStatus: 'pending' },
    { bookingId: 100, customerName: 'Rahul Verma', packageName: 'Kerala Backwaters', travelDate: '2026-11-25', travelers: 4, totalAmount: 38000, status: 'confirmed', paymentStatus: 'paid' },
    { bookingId: 99, customerName: 'Sneha Iyer', packageName: 'Hampi Heritage Walk', travelDate: '2026-12-02', travelers: 3, totalAmount: 21000, status: 'cancelled', paymentStatus: 'refunded' }
  ];

  async function loadOverview() {
    const statsEl = document.getElementById('statsGrid');
    const tableEl = document.getElementById('recentBookings');
    TM.showLoading(statsEl, 'Loading statistics…');
    TM.showLoading(tableEl, 'Loading recent bookings…');

    let usedMock = false;
    try {
      const results = await Promise.all([
        TM.api('/provider/stats', { mock: MOCK_STATS }),
        TM.api('/provider/bookings?limit=5&sort=recent', { mock: { bookings: MOCK_RECENT } })
      ]);
      usedMock = results[0].mock || results[1].mock;
      renderStats(statsEl, results[0].data);
      renderRecent(tableEl, (results[1].data && results[1].data.bookings) || []);
    } catch (err) {
      TM.showError(statsEl, err.message);
      TM.showError(tableEl, 'Could not load bookings: ' + err.message);
    }
    TM.mockBanner(usedMock);
  }

  function renderStats(el, s) {
    el.className = 'grid grid--stats';
    el.innerHTML =
      TM.statCard('🧳', 'Total Packages', s.totalPackages, '') +
      TM.statCard('🎫', 'Total Bookings', s.totalBookings, 'info') +
      TM.statCard('⏳', 'Pending Bookings', s.pendingBookings, 'warn') +
      TM.statCard('💰', 'Total Revenue', TM.money(s.totalRevenue), 'ok');
  }

  function renderRecent(el, rows) {
    if (!rows.length) { TM.showEmpty(el, 'No bookings yet. They will appear here once customers book your packages.'); return; }
    el.innerHTML =
      '<div class="table-wrap"><table><thead><tr>' +
      '<th>Booking</th><th>Customer</th><th>Package</th><th>Travel Date</th><th>Travelers</th><th>Amount</th><th>Booking</th><th>Payment</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (b) {
        return '<tr><td>#' + TM.esc(b.bookingId) + '</td><td>' + TM.esc(b.customerName) + '</td><td>' + TM.esc(b.packageName) +
          '</td><td>' + TM.fmtDate(b.travelDate) + '</td><td>' + TM.esc(b.travelers) + '</td><td>' + TM.money(b.totalAmount) +
          '</td><td>' + TM.badge(b.status) + '</td><td>' + TM.badge(b.paymentStatus) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!TM.renderShell()) return;
    if (document.getElementById('statsGrid')) loadOverview();
  });
})();
