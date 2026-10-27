
const packages = [
    {
        title: "Madurai Heritage Walk",
        destination: "Madurai",
        category: "Heritage",
        duration: 1,
        price: 999,
        image: "https://images.unsplash.com/photo-1600100397608-f010a7c7a3b4?auto=format&fit=crop&w=600&q=80"
    },
    {
        title: "Ooty Hills Escape",
        destination: "Ooty",
        category: "Nature",
        duration: 2,
        price: 3499,
        image: "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=600&q=80"
    },
    {
        title: "Pondicherry Coastal Tour",
        destination: "Pondicherry",
        category: "Beach",
        duration: 2,
        price: 2499,
        image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=600&q=80"
    }
];

const packageList = document.getElementById("package-list");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const emptyMessage = document.getElementById("empty-message");

function renderPackages(items) {
    packageList.replaceChildren();

    emptyMessage.hidden = items.length !== 0;

    items.forEach((tour) => {
        const card = document.createElement("article");
        card.className = "package-card";

        const image = document.createElement("img");
        image.src = tour.image;
        image.alt = tour.title;
        image.loading = "lazy";

        const info = document.createElement("div");
        info.className = "package-info";

        const title = document.createElement("h3");
        title.textContent = tour.title;

        const description = document.createElement("p");
        description.textContent =
            `${tour.destination} · ${tour.duration} day(s) · ${tour.category}`;

        const price = document.createElement("p");
        price.className = "package-price";
        price.textContent = `₹${tour.price.toLocaleString("en-IN")} / person`;

        info.append(title, description, price);
        card.append(image, info);
        packageList.appendChild(card);
    });
}

function searchPackages() {
    const query = searchInput.value.trim().toLowerCase();

    const filteredPackages = packages.filter((tour) =>
        tour.title.toLowerCase().includes(query) ||
        tour.destination.toLowerCase().includes(query) ||
        tour.category.toLowerCase().includes(query)
    );

    renderPackages(filteredPackages);
}

searchButton.addEventListener("click", searchPackages);

searchInput.addEventListener("input", searchPackages);

renderPackages(packages);
