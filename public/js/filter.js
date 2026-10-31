/* ============================================================
   LOCAL TRAILS — filter.js
   Search + multi-filter logic (AND-combined)
   Runs after app.js (which exposes `packages` + `renderPackages`)
   ============================================================ */

// ── DOM refs ─────────────────────────────────────────────────
const searchInput       = document.getElementById("searchInput");
const filterDestination = document.getElementById("filterDestination");
const filterCategory    = document.getElementById("filterCategory");
const filterDuration    = document.getElementById("filterDuration");
const filterPrice       = document.getElementById("filterPrice");
const filterDate        = document.getElementById("filterDate");
const priceDisplay      = document.getElementById("priceDisplay");
const resetBtn          = document.getElementById("resetFilters");

// ── Duration matcher ──────────────────────────────────────────
function matchDuration(days, value) {
    if (!value) return true;
    if (value === "1")   return days === 1;
    if (value === "2-3") return days >= 2 && days <= 3;
    if (value === "4-7") return days >= 4 && days <= 7;
    if (value === "7+")  return days > 7;
    return true;
}

// ── Main filter function ──────────────────────────────────────
function applyFilters() {
    const query    = searchInput.value.trim().toLowerCase();
    const dest     = filterDestination.value;
    const cat      = filterCategory.value;
    const maxPrice = Number(filterPrice.value);
    const dur      = filterDuration.value;
    const date     = filterDate.value; // "YYYY-MM-DD" or ""

    const filtered = packages.filter(p => {
        const matchQuery = !query ||
            p.title.toLowerCase().includes(query) ||
            p.destination.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query);

        const matchDest  = !dest || p.destination === dest;
        const matchCat   = !cat  || p.category === cat;
        const matchPrice = !maxPrice || p.price <= maxPrice;
        const matchDur   = matchDuration(p.duration, dur);
        const matchDate  = !date || p.available_from <= date || !p.available_from;

        return matchQuery && matchDest && matchCat && matchPrice && matchDur && matchDate;
    });

    renderPackages(filtered);
}

// ── Price slider live display ──────────────────────────────────
function updatePriceDisplay() {
    const val = Number(filterPrice.value);
    priceDisplay.textContent = val >= 10000
        ? "Any"
        : `₹${val.toLocaleString("en-IN")}`;
}

filterPrice.addEventListener("input", () => {
    updatePriceDisplay();
    applyFilters();
});

// ── Reset ─────────────────────────────────────────────────────
function resetFilters() {
    searchInput.value       = "";
    filterDestination.value = "";
    filterCategory.value    = "";
    filterDuration.value    = "";
    filterPrice.value       = filterPrice.max;
    filterDate.value        = "";
    updatePriceDisplay();
    renderPackages(packages);
}

resetBtn.addEventListener("click", resetFilters);

// ── Attach listeners ──────────────────────────────────────────
[searchInput, filterDestination, filterCategory, filterDuration, filterDate]
    .forEach(el => el.addEventListener("input",  applyFilters));

[filterDestination, filterCategory, filterDuration]
    .forEach(el => el.addEventListener("change", applyFilters));

// ── Initialise display ────────────────────────────────────────
updatePriceDisplay();
