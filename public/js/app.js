/* ============================================================
   LOCAL TRAILS — app.js
   Static package data + card renderer
   (Tomorrow: replace `packages` array with fetch('/api/packages'))
   ============================================================ */

let packages = [];

let currentPackageId = null;
let currentBookingId = null;


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
    openPackageDetails(tour.id);
});

        footer.append(priceBlock, bookBtn);
        info.append(meta, title, desc, ratingRow, footer);
        card.append(imgWrap, info);
        packageList.appendChild(card);
    });
}

async function openPackageDetails(packageId) {
    currentPackageId = packageId;
    const modal = document.getElementById("package-modal");
    const details = document.getElementById("package-details");
    const dateSelect = document.getElementById("availability-date");

    modal.style.display = "flex";
    details.textContent = "Loading package details...";
    dateSelect.innerHTML = '<option value="">Select a date</option>';

    try {
        const [packageResponse, availabilityResponse] = await Promise.all([
            fetch(`/api/packages/${packageId}`),
            fetch(`/api/packages/${packageId}/availability`)
        ]);

        const packageData = await packageResponse.json();
        const availabilityData = await availabilityResponse.json();

        if (!packageResponse.ok || !availabilityResponse.ok) {
            throw new Error("Unable to load package information.");
        }

        const tour = packageData.package || packageData;
        const dates = Array.isArray(availabilityData)
            ? availabilityData
            : availabilityData.availability || [];

        details.innerHTML = `
            <h2>${tour.title}</h2>
            <p>${tour.description || "Explore this local experience."}</p>
            <p>📍 ${tour.destination}</p>
            <p>Category: ${tour.category}</p>
            <p>Duration: ${tour.duration} days</p>
            <p>Price: ₹${Number(tour.price).toLocaleString("en-IN")} per person</p>
            <p>Rating: ${tour.rating || 0} (${tour.reviews || 0} reviews)</p>
        `;

        dates.forEach(date => {
            if (date.is_available) {
                const option = document.createElement("option");
                option.value = date.availability_id;
                option.textContent =
                    `${new Date(date.available_date).toLocaleDateString("en-IN")} — ${date.remaining_seats} seats left`;
                dateSelect.appendChild(option);
            }
        });

        if (dateSelect.options.length === 1) {
            dateSelect.innerHTML = '<option value="">No available dates</option>';
        }

    } catch (error) {
        console.error("Package details error:", error);
        details.textContent = "Unable to load package details. Please try again.";
    }
}
async function makePayment() {
    const paymentMethod =
        document.getElementById("payment-method").value;
    console.log("Payment booking ID:", currentBookingId);

    try {
        const response = await fetch("/api/payments", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
            booking_id: currentBookingId,
            payment_method: paymentMethod
        })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Payment failed.");
        }

        alert("Payment successful! Your booking is confirmed.");

        document.getElementById("package-modal").style.display = "none";

    } catch (error) {
        console.error("Payment error:", error);
        alert(error.message || "Unable to process payment.");
    }
}

async function continueToBooking() {
    const availabilityId = document.getElementById("availability-date").value;
    const numberOfPeople = Number(
        document.getElementById("number-of-people").value
    );

    if (!availabilityId) {
        alert("Please select an available travel date.");
        return;
    }

    if (!Number.isInteger(numberOfPeople) || numberOfPeople < 1) {
        alert("Please enter a valid number of people.");
        return;
    }

    try {
        const response = await fetch("/api/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                package_id: currentPackageId,
                availability_id: Number(availabilityId),
                number_of_people: numberOfPeople
            })
        });

        const data = await response.json();
        console.log("Booking response:", data);

        if (response.status === 401) {
            alert("Please login before booking.");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || "Booking failed.");
        }

        currentBookingId = data.booking.booking_id;

        if (!currentBookingId) {
            throw new Error("Booking ID was not returned by the server.");
        }

        document.getElementById("continue-booking").style.display = "none";
        document.getElementById("payment-section").style.display = "block";

        document.getElementById("payment-amount").textContent =
            "Booking created! Total: ₹" +
            Number(data.total_amount || data.booking?.total_amount || 0)
                .toLocaleString("en-IN");

            } catch (error) {
                console.error("Booking error:", error);
                alert(error.message || "Unable to complete booking.");
            }
        }
// ── Authentication status ─────────────────────────────

async function checkLoginStatus() {
    const loginBtn = document.getElementById("nav-login");
    const registerBtn = document.getElementById("nav-register");
    const userDisplay = document.getElementById("nav-user");
    const logoutBtn = document.getElementById("nav-logout");
    const bookingsLink = document.getElementById("nav-bookings");

    if (!loginBtn || !registerBtn || !userDisplay ||
    !logoutBtn || !bookingsLink) {
    return;
}
    // Handle logout
logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
        const response = await fetch("/api/auth/logout", {
            method: "POST"
        });

        const data = await response.json();

        if (response.ok && data.success) {
            window.location.reload();
        } else {
            alert("Logout failed. Please try again.");
        }

    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to connect to the server.");
    }
});

    try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();

        if (response.ok && data.success) {
            loginBtn.style.display = "none";
            registerBtn.style.display = "none";

            userDisplay.textContent = `Welcome, ${data.user.name}`;
            userDisplay.style.display = "inline";

            logoutBtn.style.display = "inline-block";

            // Show My Bookings only for customers
            if (data.user.role === "customer") {
                bookingsLink.style.display = "inline-block";
            } else {
                bookingsLink.style.display = "none";
            }
        } else {
            loginBtn.style.display = "inline";
            registerBtn.style.display = "inline";

            userDisplay.style.display = "none";
            logoutBtn.style.display = "none";
        }

    } catch (error) {
        console.error("Authentication check failed:", error);
    }
}

document.addEventListener("DOMContentLoaded", checkLoginStatus);
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



// ── Fetch packages from backend ──

async function loadPackages() {
    try {
        const response = await fetch("/api/packages");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to load packages");
        }

        packages = Array.isArray(data) ? data : data.packages;

        if (!Array.isArray(packages)) {
            throw new Error("Invalid package data received");
        }

        renderPackages(packages);

    } catch (error) {
        console.error("Package loading error:", error);
        packageList.replaceChildren();
        emptyMessage.textContent = "Unable to load packages. Please try again.";
        emptyMessage.style.display = "block";
    }
}
document.getElementById("close-package-modal").addEventListener("click", () => {
    document.getElementById("package-modal").style.display = "none";
});
document.getElementById("continue-booking")
    .addEventListener("click", continueToBooking);
document.getElementById("pay-now")
    .addEventListener("click", makePayment);
loadPackages();
