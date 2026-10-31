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
async function applyFilters() {
    const params = new URLSearchParams();

    const query = searchInput.value.trim();
    const dest = filterDestination.value;
    const cat = filterCategory.value;
    const maxPrice = Number(filterPrice.value);
    const dur = filterDuration.value;
    const date = filterDate.value;

    if (query) params.append("search", query);
    if (dest) params.append("destination", dest);
    if (cat) params.append("category", cat);
    if (maxPrice && maxPrice < Number(filterPrice.max)) {
        params.append("maxPrice", maxPrice);
    }
    if (dur) params.append("duration", dur);
    if (date) params.append("date", date);

    try {
        const response = await fetch(
            `/api/packages?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to filter packages");
        }

        packages = Array.isArray(data)
            ? data
            : data.packages;

        renderPackages(packages);

    } catch (error) {
        console.error("Filter error:", error);
        packageList.replaceChildren();
        emptyMessage.textContent = "Unable to load packages.";
        emptyMessage.style.display = "block";
    }
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
    applyFilters();
}

resetBtn.addEventListener("click", resetFilters);

// ── Attach listeners ──────────────────────────────────────────
// Search and date
[searchInput, filterDate].forEach(el =>
    el.addEventListener("input", applyFilters)
);

// Dropdown filters
[filterDestination, filterCategory, filterDuration].forEach(el =>
    el.addEventListener("change", applyFilters)
);

// ── Initialise display ────────────────────────────────────────
updatePriceDisplay();
