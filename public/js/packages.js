/* ============================================================
   LOCAL TRAILS — packages.js
   Dedicated script for packages.html

   Responsibilities:
     1. Fetch destinations + categories from /api/catalog/options
        to populate the filter dropdowns dynamically.
     2. Fetch packages from GET /api/packages (with query params)
        whenever any filter changes.
     3. Render package cards into #package-grid via DOM methods.
     4. Handle booking modal: show package details + availability,
        create booking via POST /api/bookings, payment via
        POST /api/payments.
     5. Auth awareness: show/hide Login/Register/Logout/My Bookings.
   ============================================================ */

'use strict';

/* ── State ──────────────────────────────────────────────────── */
let allPackages      = [];    // last fetched from API
let currentPackageId = null;
let currentBookingId = null;

/* ── DOM refs ───────────────────────────────────────────────── */
const packageGrid      = document.getElementById('package-grid');
const loadingState     = document.getElementById('loading-state');
const emptyState       = document.getElementById('empty-state');
const errorState       = document.getElementById('error-state');
const errorMsg         = document.getElementById('error-message');
const resultsCount     = document.getElementById('resultsCount');
const activeFiltersEl  = document.getElementById('active-filters');

const searchInput      = document.getElementById('searchInput');
const filterDest       = document.getElementById('filterDestination');
const filterCat        = document.getElementById('filterCategory');
const filterDur        = document.getElementById('filterDuration');
const filterPrice      = document.getElementById('filterPrice');
const filterDate       = document.getElementById('filterDate');
const priceDisplay     = document.getElementById('priceDisplay');
const sortSelect       = document.getElementById('sortPackages');
const resetBtn         = document.getElementById('resetFilters');
const emptyReset       = document.getElementById('emptyReset');
const retryBtn         = document.getElementById('retryBtn');

const modeTribe        = document.getElementById('modeTribe');
const modeLegends      = document.getElementById('modeLegends');
const modeEco          = document.getElementById('modeEco');

const filterSidebar    = document.getElementById('filterSidebar');
const filterToggleBtn  = document.getElementById('filterToggleBtn');
const filterMobileClose= document.getElementById('filterMobileClose');

/* ── Helpers ─────────────────────────────────────────────────── */
function starString(rating) {
    const r    = Number(rating) || 0;
    const full = Math.floor(r);
    const half = r % 1 >= 0.5 ? 1 : 0;
    const empty= 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

function badgeClass(badge) {
    if (badge === 'Bestseller') return 'badge badge-bestseller';
    if (badge === 'Eco')        return 'badge badge-eco';
    if (badge === 'New')        return 'badge badge-new';
    return '';
}

function formatPrice(n) {
    return Number(n).toLocaleString('en-IN');
}

function showState(state) {
    // state: 'loading' | 'results' | 'empty' | 'error'
    loadingState.style.display = state === 'loading' ? 'grid'  : 'none';
    packageGrid.style.display  = state === 'results' ? 'grid'  : 'none';
    emptyState.style.display   = state === 'empty'   ? 'block' : 'none';
    errorState.style.display   = state === 'error'   ? 'block' : 'none';
}

/* ── Populate dropdowns from API ─────────────────────────────── */
async function loadCatalogOptions() {
    try {
        const res  = await fetch('/api/catalog/options');
        const data = await res.json();
        if (!res.ok || !data.success) return;

        const { destinations, categories } = data.data;

        destinations.forEach(d => {
            const opt = document.createElement('option');
            opt.value       = d.name;
            opt.textContent = d.name;
            filterDest.appendChild(opt);
        });

        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value       = c.name;
            opt.textContent = c.name;
            filterCat.appendChild(opt);
        });
    } catch (e) {
        // Non-critical — dropdowns fall back to empty
        console.warn('Could not load catalog options:', e);
    }
}

/* ── Build query params from current filter state ────────────── */
function buildParams() {
    const params = new URLSearchParams();

    const q    = searchInput.value.trim();
    const dest = filterDest.value;
    const cat  = filterCat.value;
    const max  = Number(filterPrice.value);
    const dur  = filterDur.value;
    const date = filterDate.value;

    if (q)    params.set('search',      q);
    if (dest) params.set('destination', dest);
    if (cat)  params.set('category',    cat);
    if (dur)  params.set('duration',    dur);
    if (date) params.set('date',        date);
    if (max && max < Number(filterPrice.max)) params.set('maxPrice', max);

    return params;
}

/* ── Active filter pill UI ───────────────────────────────────── */
function updateActivePills() {
    activeFiltersEl.innerHTML = '';

    const labels = {
        search:      `"${searchInput.value.trim()}"`,
        destination: filterDest.value,
        category:    filterCat.value,
        duration:    { '1':'1 Day','2-3':'2–3 Days','4-7':'4–7 Days','7+':'7+ Days' }[filterDur.value] || '',
        maxPrice:    Number(filterPrice.value) < Number(filterPrice.max)
                         ? `Under ₹${formatPrice(filterPrice.value)}`
                         : '',
        date:        filterDate.value ? `From ${filterDate.value}` : '',
    };

    Object.entries(labels).forEach(([key, val]) => {
        if (!val) return;
        const pill = document.createElement('span');
        pill.className = 'filter-pill';
        pill.innerHTML = `${val} <button class="filter-pill-remove" data-key="${key}" aria-label="Remove ${val} filter">×</button>`;
        activeFiltersEl.appendChild(pill);
    });

    // Mode pills
    [modeTribe, modeLegends, modeEco].forEach(cb => {
        if (!cb.checked) return;
        const modeNames = { tribe:'Group travel', legends:'Local culture', eco:'Responsible travel' };
        const pill = document.createElement('span');
        pill.className = 'filter-pill';
        pill.innerHTML = `${modeNames[cb.value]} <button class="filter-pill-remove" data-mode="${cb.value}" aria-label="Remove ${modeNames[cb.value]} filter">×</button>`;
        activeFiltersEl.appendChild(pill);
    });

    // Remove pill event delegation
    activeFiltersEl.querySelectorAll('.filter-pill-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const key  = btn.dataset.key;
            const mode = btn.dataset.mode;
            if (key === 'search')      searchInput.value = '';
            if (key === 'destination') filterDest.value  = '';
            if (key === 'category')    filterCat.value   = '';
            if (key === 'duration')    filterDur.value   = '';
            if (key === 'date')        filterDate.value  = '';
            if (key === 'maxPrice') {
                filterPrice.value = filterPrice.max;
                updatePriceDisplay();
            }
            if (mode === 'tribe')   modeTribe.checked   = false;
            if (mode === 'legends') modeLegends.checked = false;
            if (mode === 'eco')     modeEco.checked     = false;
            fetchAndRender();
        });
    });
}

/* ── Price display ───────────────────────────────────────────── */
function updatePriceDisplay() {
    const val = Number(filterPrice.value);
    priceDisplay.textContent = val >= Number(filterPrice.max)
        ? 'Any'
        : `₹${formatPrice(val)}`;
}

/* ── Sorting ─────────────────────────────────────────────────── */
function sortPackages(list) {
    const order = sortSelect.value;
    const copy  = [...list];
    if (order === 'price-asc')    copy.sort((a,b) => a.price   - b.price);
    if (order === 'price-desc')   copy.sort((a,b) => b.price   - a.price);
    if (order === 'rating-desc')  copy.sort((a,b) => b.rating  - a.rating);
    if (order === 'duration-asc') copy.sort((a,b) => a.duration- b.duration);
    return copy;
}

/* ── Client-side experience focus filter ─────────────────────── */
function applyModeFilter(list) {
    const selected = [modeTribe, modeLegends, modeEco]
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    if (selected.length === 0) return list;
    return list.filter(p =>
        Array.isArray(p.mode) && selected.some(m => p.mode.includes(m))
    );
}

/* ── Card Builder ────────────────────────────────────────────── */
function buildCard(tour) {
    // Map API field names → display-ready values
    const id          = tour.id || tour.package_id;
    const title       = tour.title      || 'Untitled Package';
    const destination = tour.destination|| '';
    const category    = tour.category   || '';
    const duration    = Number(tour.duration) || 0;
    const price       = Number(tour.price)    || 0;
    const rating      = Number(tour.rating)   || 0;
    const reviews     = Number(tour.reviews)  || 0;
    const badge       = tour.badge      || null;
    const image       = tour.image      || tour.image_url || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80';
    const modes       = Array.isArray(tour.mode) ? tour.mode : [];

    const modeLabels  = { tribe:'🤝 Group travel', legends:'🏺 Local culture', eco:'🌿 Responsible travel' };

    // Build card via innerHTML template for readability
    const card = document.createElement('article');
    card.className = 'package-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-id', id);

    card.innerHTML = `
        <div class="package-card-img">
            <img src="${image}"
                 alt="${title}"
                 loading="lazy"
                 onerror="this.src='https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80'">
            ${badge ? `<span class="package-badge ${badgeClass(badge)}">${badge}</span>` : ''}
            ${modes.length ? `<div class="package-mode-tags">
                ${modes.map(m => `<span class="mode-tag ${m}">${modeLabels[m] || m}</span>`).join('')}
            </div>` : ''}
        </div>

        <div class="package-info">
            <div class="package-meta">
                <span class="tag">${category}</span>
                <span class="tag">⏱ ${duration} day${duration !== 1 ? 's' : ''}</span>
            </div>

            <h3>${title}</h3>
            <p class="package-desc">📍 ${destination}</p>

            <div class="package-rating">
                <span class="stars">${starString(rating)}</span>
                <strong>${rating > 0 ? rating.toFixed(1) : '—'}</strong>
                <span>(${reviews} review${reviews !== 1 ? 's' : ''})</span>
            </div>

            <div class="package-footer">
                <div>
                    <div class="package-price">₹${formatPrice(price)}</div>
                    <div class="package-price-label">per person</div>
                </div>
                <button class="package-book-btn"
                        data-id="${id}"
                        type="button"
                        aria-label="View and book ${title}">
                    Book Now
                </button>
            </div>
        </div>
    `;

    // "Book Now" → open booking modal
    card.querySelector('.package-book-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openBookingModal(id);
    });

    // Clicking the card image area also opens the modal
    card.querySelector('.package-card-img').addEventListener('click', () => {
        openBookingModal(id);
    });

    return card;
}

/* ── Render ──────────────────────────────────────────────────── */
function renderPackages(list) {
    packageGrid.replaceChildren();

    const sorted   = sortPackages(list);
    const filtered = applyModeFilter(sorted);

    if (filtered.length === 0) {
        showState('empty');
        resultsCount.innerHTML = 'No packages found';
        return;
    }

    showState('results');
    resultsCount.innerHTML = `Showing <strong>${filtered.length}</strong> package${filtered.length !== 1 ? 's' : ''}`;

    filtered.forEach(tour => packageGrid.appendChild(buildCard(tour)));
}

/* ── Fetch from API ──────────────────────────────────────────── */
async function fetchAndRender() {
    showState('loading');
    updateActivePills();

    const params  = buildParams();
    const url     = `/api/packages${params.toString() ? '?' + params : ''}`;

    try {
        const res  = await fetch(url);
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Server error');

        // API returns { success, count, packages: [...] }
        allPackages = Array.isArray(data) ? data
                    : Array.isArray(data.packages) ? data.packages
                    : [];

        renderPackages(allPackages);

    } catch (err) {
        console.error('Package fetch error:', err);
        errorMsg.textContent = err.message || 'Unable to load packages. Please try again.';
        showState('error');
        resultsCount.innerHTML = '';
    }
}

/* ═══════════════════════════════════════════════════════════════
   BOOKING MODAL
═══════════════════════════════════════════════════════════════ */
const modal            = document.getElementById('package-modal');
const modalDetails     = document.getElementById('package-details');
const bookingFormSec   = document.getElementById('booking-form-section');
const paymentSec       = document.getElementById('payment-section');
const dateSelect       = document.getElementById('availability-date');
const continueBtn      = document.getElementById('continue-booking');
const payNowBtn        = document.getElementById('pay-now');
const paymentAmountEl  = document.getElementById('payment-amount');
const closeModalBtn    = document.getElementById('close-package-modal');

function openModal()  { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
function closeModal() { modal.style.display = 'none'; document.body.style.overflow = '';
    // Reset
    bookingFormSec.style.display = 'none';
    paymentSec.style.display     = 'none';
    continueBtn.style.display    = 'inline-flex';
    currentPackageId = null;
    currentBookingId = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

async function openBookingModal(packageId) {
    currentPackageId = packageId;
    modalDetails.innerHTML  = '<div class="modal-loading">Loading package details…</div>';
    bookingFormSec.style.display = 'none';
    paymentSec.style.display     = 'none';
    openModal();

    try {
        // Parallel fetch: package detail + availability dates
        const [pkgRes, availRes] = await Promise.all([
            fetch(`/api/packages/${packageId}`),
            fetch(`/api/packages/${packageId}/availability`)
        ]);

        const pkgData   = await pkgRes.json();
        const availData = await availRes.json();

        if (!pkgRes.ok)   throw new Error(pkgData.message  || 'Package not found');
        if (!availRes.ok) throw new Error(availData.message || 'Availability not found');

        // API: { success, package: {...} }
        const pkg   = pkgData.package || pkgData;
        // API: { success, availability: [...] }
        const dates = Array.isArray(availData)
            ? availData
            : availData.availability || [];

        // ── Render package info inside modal
        modalDetails.innerHTML = `
            <img class="modal-package-image"
                 src="${pkg.image || pkg.image_url || ''}"
                 alt="${pkg.title}"
                 onerror="this.style.display='none'">

            <h2 class="modal-package-title">${pkg.title}</h2>

            <div class="modal-package-meta">
                <span class="tag">${pkg.category || ''}</span>
                <span class="tag">📍 ${pkg.destination || ''}</span>
                <span class="tag">⏱ ${pkg.duration} day${pkg.duration !== 1 ? 's' : ''}</span>
            </div>

            <p class="modal-package-desc">
                ${pkg.description || 'Discover this unique local experience with a verified Local Trails guide.'}
            </p>

            <div class="modal-price-row">
                <div>
                    <div class="package-price">₹${formatPrice(pkg.price)}</div>
                    <div class="package-price-label">per person</div>
                </div>
                <div style="text-align:right;">
                    <div class="stars" style="font-size:14px;">${starString(pkg.rating)}</div>
                    <div style="font-size:12px;color:var(--muted);">${pkg.reviews} reviews</div>
                </div>
            </div>
        `;

        // ── Populate availability dates
        dateSelect.innerHTML = '<option value="">Choose an available date…</option>';
        const available = dates.filter(d => d.is_available);

        available.forEach(d => {
            const opt = document.createElement('option');
            opt.value       = d.availability_id;
            opt.textContent = `${new Date(d.available_date).toLocaleDateString('en-IN', { dateStyle:'medium' })} — ${d.remaining_seats} seats left`;
            dateSelect.appendChild(opt);
        });

        if (available.length === 0) {
            dateSelect.innerHTML = '<option value="">No dates available right now</option>';
            continueBtn.disabled = true;
        } else {
            continueBtn.disabled = false;
        }

        bookingFormSec.style.display = 'block';

    } catch (err) {
        console.error('Modal error:', err);
        modalDetails.innerHTML = `
            <div class="modal-loading" style="color:#ef4444;">
                ⚠ ${err.message || 'Unable to load package details.'}
            </div>`;
    }
}

/* ── Create Booking ──────────────────────────────────────────── */
continueBtn.addEventListener('click', async () => {
    const availabilityId = dateSelect.value;
    const numPeople      = Number(document.getElementById('number-of-people').value);

    if (!availabilityId) {
        alert('Please select an available travel date.');
        return;
    }
    if (!Number.isInteger(numPeople) || numPeople < 1) {
        alert('Please enter a valid number of people (minimum 1).');
        return;
    }

    continueBtn.textContent = 'Creating booking…';
    continueBtn.disabled    = true;

    try {
        const res  = await fetch('/api/bookings', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                package_id:      currentPackageId,
                availability_id: Number(availabilityId),
                number_of_people: numPeople
            })
        });

        const data = await res.json();

        if (res.status === 401) {
            alert('Please log in to book a package.');
            window.location.href = 'login.html';
            return;
        }
        if (!res.ok) throw new Error(data.message || 'Booking failed.');

        currentBookingId = data.booking.booking_id;
        const total      = data.booking.total_amount;

        paymentAmountEl.textContent = `Total amount: ₹${formatPrice(total)}`;
        bookingFormSec.style.display = 'none';
        paymentSec.style.display     = 'block';

    } catch (err) {
        console.error('Booking error:', err);
        alert(err.message || 'Unable to create booking. Please try again.');
    } finally {
        continueBtn.textContent = 'Continue to Payment →';
        continueBtn.disabled    = false;
    }
});

/* ── Make Payment ────────────────────────────────────────────── */
payNowBtn.addEventListener('click', async () => {
    const method = document.getElementById('payment-method').value;

    payNowBtn.textContent = 'Processing…';
    payNowBtn.disabled    = true;

    try {
        const res  = await fetch('/api/payments', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ booking_id: currentBookingId, payment_method: method })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Payment failed.');

        closeModal();
        alert(`✅ Payment successful! Your booking is confirmed.\nTransaction ID: ${data.payment?.transaction_id || 'N/A'}`);

    } catch (err) {
        console.error('Payment error:', err);
        alert(err.message || 'Unable to process payment. Please try again.');
    } finally {
        payNowBtn.textContent = 'Pay Now ✓';
        payNowBtn.disabled    = false;
    }
});

/* ═══════════════════════════════════════════════════════════════
   AUTH STATUS (navbar)
═══════════════════════════════════════════════════════════════ */
async function checkLoginStatus() {
    const loginBtn    = document.getElementById('nav-login');
    const registerBtn = document.getElementById('nav-register');
    const userDisplay = document.getElementById('nav-user');
    const logoutBtn   = document.getElementById('nav-logout');
    const bookingsLink= document.getElementById('nav-bookings');

    if (!loginBtn) return;

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.reload();
        } catch (err) {
            alert('Logout failed. Please try again.');
        }
    });

    try {
        const res  = await fetch('/api/auth/me');
        const data = await res.json();

        if (res.ok && data.success) {
            loginBtn.style.display    = 'none';
            registerBtn.style.display = 'none';
            userDisplay.textContent   = `Welcome, ${data.user.name}`;
            userDisplay.style.display = 'inline';
            logoutBtn.style.display   = 'inline-block';
            bookingsLink.style.display= data.user.role === 'customer' ? 'inline-block' : 'none';
        } else {
            loginBtn.style.display    = 'inline';
            registerBtn.style.display = 'inline';
            userDisplay.style.display = 'none';
            logoutBtn.style.display   = 'none';
        }
    } catch (err) {
        console.warn('Auth check failed:', err);
    }
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE FILTER DRAWER
═══════════════════════════════════════════════════════════════ */
filterToggleBtn.addEventListener('click', () => {
    filterSidebar.classList.add('open');
});
filterMobileClose.addEventListener('click', () => {
    filterSidebar.classList.remove('open');
});

/* ═══════════════════════════════════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════════════════════════════════ */
// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
});

// Hamburger
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// Price slider
filterPrice.addEventListener('input', () => {
    updatePriceDisplay();
    fetchAndRender();
});

// Text + date inputs (debounced)
let debounceTimer;
function debounce(fn, delay = 350) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
}
[searchInput, filterDate].forEach(el =>
    el.addEventListener('input', () => debounce(fetchAndRender))
);

// Dropdowns & checkboxes → immediate
[filterDest, filterCat, filterDur, sortSelect].forEach(el =>
    el.addEventListener('change', fetchAndRender)
);
[modeTribe, modeLegends, modeEco].forEach(cb =>
    cb.addEventListener('change', () => renderPackages(allPackages))
);

// Reset
function resetAllFilters() {
    searchInput.value  = '';
    filterDest.value   = '';
    filterCat.value    = '';
    filterDur.value    = '';
    filterDate.value   = '';
    filterPrice.value  = filterPrice.max;
    sortSelect.value   = 'default';
    modeTribe.checked  = false;
    modeLegends.checked= false;
    modeEco.checked    = false;
    updatePriceDisplay();
    fetchAndRender();
}
resetBtn.addEventListener('click', resetAllFilters);
emptyReset?.addEventListener('click', resetAllFilters);
retryBtn.addEventListener('click', fetchAndRender);

/* ═══════════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
    await loadCatalogOptions();   // populate destination + category dropdowns
    checkLoginStatus();           // auth-aware navbar
    fetchAndRender();             // initial package load
});
