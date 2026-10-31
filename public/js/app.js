/* ============================================================
   LOCAL TRAILS — app.js
   Static package data + card renderer
   (Tomorrow: replace `packages` array with fetch('/api/packages'))
   ============================================================ */

// ── Static Package Data ──────────────────────────────────────
// Schema matches the planned DB model — API-ready shape.
const packages = [
    {
        id: 1,
        title: "Madurai Heritage Walk",
        destination: "Madurai",
        category: "Heritage",
        duration: 1,
        price: 999,
        rating: 4.7,
        reviews: 214,
        available_from: "2026-11-01",
        badge: "Bestseller",
        mode: ["legends"],
        image: "https://images.unsplash.com/photo-1602643163983-ed0babc39797?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 2,
        title: "Meenakshi Temple Deep Dive",
        destination: "Madurai",
        category: "Culture",
        duration: 2,
        price: 2499,
        rating: 4.9,
        reviews: 88,
        available_from: "2026-11-05",
        badge: "New",
        mode: ["legends", "tribe"],
        image: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 3,
        title: "Ooty Hills Escape",
        destination: "Ooty",
        category: "Nature",
        duration: 3,
        price: 3499,
        rating: 4.6,
        reviews: 176,
        available_from: "2026-11-03",
        badge: null,
        mode: ["tribe"],
        image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 4,
        title: "Nilgiri Eco Trek",
        destination: "Ooty",
        category: "Eco",
        duration: 2,
        price: 2799,
        rating: 4.8,
        reviews: 103,
        available_from: "2026-11-07",
        badge: "Eco",
        mode: ["eco"],
        image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 5,
        title: "Pondicherry Coastal Tour",
        destination: "Pondicherry",
        category: "Beach",
        duration: 2,
        price: 2499,
        rating: 4.5,
        reviews: 142,
        available_from: "2026-11-02",
        badge: null,
        mode: ["tribe", "eco"],
        image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=700&q=80"
    },
    {
        id: 6,
        title: "French Quarter Cultural Walk",
        destination: "Pondicherry",
        category: "Culture",
        duration: 1,
        price: 799,
        rating: 4.4,
        reviews: 59,
        available_from: "2026-11-01",
        badge: null,
        mode: ["legends"],
        image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=700&q=80"
    }
];

// ── DOM refs ─────────────────────────────────────────────────
const packageList  = document.getElementById("package-list");
const emptyMessage = document.getElementById("empty-message");

// ── Helpers ──────────────────────────────────────────────────
function starString(rating) {
    const full  = Math.floor(rating);
    const half  = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

function badgeClass(badge) {
    if (badge === "Bestseller") return "badge badge-bestseller";
    if (badge === "Eco")        return "badge badge-eco";
    if (badge === "New")        return "badge badge-new";
    return "";
}

// ── Card Renderer ─────────────────────────────────────────────
function renderPackages(items) {
    packageList.replaceChildren();
    emptyMessage.style.display = items.length === 0 ? "block" : "none";

    items.forEach((tour) => {
        const card = document.createElement("article");
        card.className = "package-card";
        card.setAttribute("data-id", tour.id);

        // ── Image wrapper
        const imgWrap = document.createElement("div");
        imgWrap.className = "package-card-img";

        const img = document.createElement("img");
        img.src    = tour.image;
        img.alt    = tour.title;
        img.loading = "lazy";
        imgWrap.appendChild(img);

        // Badge overlay
        if (tour.badge) {
            const badgeEl = document.createElement("span");
            badgeEl.className = `package-badge ${badgeClass(tour.badge)}`;
            badgeEl.textContent = tour.badge;
            imgWrap.appendChild(badgeEl);
        }

        // Mode tags overlay
        if (tour.mode && tour.mode.length > 0) {
            const modeTags = document.createElement("div");
            modeTags.className = "package-mode-tags";
            const modeLabels = { tribe: "🤝 Tribe", legends: "🏺 Legends", eco: "🌿 Eco" };
            tour.mode.forEach(m => {
                const t = document.createElement("span");
                t.className = `mode-tag ${m}`;
                t.textContent = modeLabels[m] || m;
                modeTags.appendChild(t);
            });
            imgWrap.appendChild(modeTags);
        }

        // ── Info block
        const info = document.createElement("div");
        info.className = "package-info";

        // Meta row (tags)
        const meta = document.createElement("div");
        meta.className = "package-meta";
        const catTag = document.createElement("span");
        catTag.className = "tag";
        catTag.textContent = tour.category;
        const durTag = document.createElement("span");
        durTag.className = "tag";
        durTag.textContent = `⏱ ${tour.duration} day${tour.duration > 1 ? "s" : ""}`;
        meta.append(catTag, durTag);

        // Title
        const title = document.createElement("h3");
        title.textContent = tour.title;

        // Destination
        const desc = document.createElement("p");
        desc.className = "package-desc";
        desc.textContent = `📍 ${tour.destination}`;

        // Rating
        const ratingRow = document.createElement("div");
        ratingRow.className = "package-rating";
        ratingRow.innerHTML = `
            <span class="stars">${starString(tour.rating)}</span>
            <strong>${tour.rating}</strong>
            <span>(${tour.reviews} reviews)</span>
        `;

        // Footer row
        const footer = document.createElement("div");
        footer.className = "package-footer";

        const priceBlock = document.createElement("div");
        priceBlock.innerHTML = `
            <div class="package-price">₹${tour.price.toLocaleString("en-IN")}</div>
            <div class="package-price-label">per person</div>
        `;

        const bookBtn = document.createElement("button");
        bookBtn.className = "package-book-btn";
        bookBtn.textContent = "Book Now";
        bookBtn.setAttribute("data-id", tour.id);
        bookBtn.addEventListener("click", () => {
            // Tomorrow: link to booking page / API
            alert(`Booking for "${tour.title}" coming soon! 🚀`);
        });

        footer.append(priceBlock, bookBtn);
        info.append(meta, title, desc, ratingRow, footer);
        card.append(imgWrap, info);
        packageList.appendChild(card);
    });
}

// ── Navbar scroll shadow ──────────────────────────────────────
const navbar = document.getElementById("navbar");
window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 10);
});

// ── Hamburger toggle ──────────────────────────────────────────
const hamburger = document.getElementById("hamburger");
const navLinks  = document.getElementById("navLinks");

hamburger.addEventListener("click", () => {
    navLinks.classList.toggle("open");
});

// Close menu on link click
navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
});

// ── Initial render ────────────────────────────────────────────
renderPackages(packages);
