document.addEventListener("DOMContentLoaded", () => {
    fetchItems(); // Load lost & found items when page loads
});

// Function to fetch and display lost & found items as cards
function fetchItems() {
    fetch("/items")
        .then(response => response.json())
        .then(data => {
            const itemsContainer = document.getElementById("items-container");
            itemsContainer.innerHTML = ""; // Clear previous items

            // Separate lost and found items
            const lostItems = data.filter(item => item.type === "Lost");
            const foundItems = data.filter(item => item.type === "Found");

            // Display Lost Items
            if (lostItems.length > 0) {
                const lostGroup = document.createElement("div");
                lostGroup.classList.add("items-group");

                const lostTitle = document.createElement("h2");
                lostTitle.textContent = "Lost Items";
                lostGroup.appendChild(lostTitle);

                const lostContainer = document.createElement("div");
                lostContainer.classList.add("items-container");

                lostItems.forEach(item => {
                    const card = createItemCard(item);
                    lostContainer.appendChild(card);
                });

                lostGroup.appendChild(lostContainer);
                itemsContainer.appendChild(lostGroup);
            }

            // Display Found Items
            if (foundItems.length > 0) {
                const foundGroup = document.createElement("div");
                foundGroup.classList.add("items-group");

                const foundTitle = document.createElement("h2");
                foundTitle.textContent = "Found Items";
                foundGroup.appendChild(foundTitle);

                const foundContainer = document.createElement("div");
                foundContainer.classList.add("items-container");

                foundItems.forEach(item => {
                    const card = createItemCard(item);
                    foundContainer.appendChild(card);
                });

                foundGroup.appendChild(foundContainer);
                itemsContainer.appendChild(foundGroup);
            }
        })
        .catch(error => console.error("Error fetching items:", error));
}

// Function to create an item card
function createItemCard(item) {
    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
        <strong>${item.item_name}</strong> <br>
        <img src="${item.image ? item.image : 'default-image.png'}" alt="Item Image">
        <p>${item.description}</p>
        <p>Location: ${item.location}</p>
        <p>Date: ${item.date_reported}</p>
    `;

    // Add claim button for found items
    if (item.type === "Found") {
        const claimButton = document.createElement("button");
        claimButton.textContent = "Claim";
        claimButton.classList.add("claim-btn");

        // Redirect to claim form when clicked
        claimButton.onclick = () => {
            window.location.href = `claim-form.html?id=${item.id}&item_name=${encodeURIComponent(item.item_name)}`;
        };

        card.appendChild(claimButton);
    }

    return card;
}
// Handle form submission for lost/found item reporting
document.getElementById("reportForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("item_name", document.getElementById("item_name").value);
    formData.append("description", document.getElementById("description").value);
    formData.append("location", document.getElementById("location").value);
    formData.append(
        document.getElementById("status").value === "Lost" ? "date_lost" : "date_found",
        document.getElementById("date_reported").value
    );
    const fileInput = document.getElementById("item_image");
    if (fileInput.files.length > 0) {
        formData.append("item_image", fileInput.files[0]); // Append image file
    }

    const apiEndpoint = document.getElementById("status").value === "Lost" ? "/report/lost" : "/report/found";

    fetch(apiEndpoint, {
        method: "POST",
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            window.location.href = "index.html"; // Redirect to home page
        })
        .catch(error => console.error("Error reporting item:", error));
});

// Image Preview Functionality
document.getElementById("item_image")?.addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImage = document.getElementById("previewImage");
            previewImage.src = e.target.result;
            previewImage.style.display = "block";
        };
        reader.readAsDataURL(file);
    }
});

// Function to claim an item
function claimItem(id, type, listItem) {
    const apiEndpoint = type === "found" ? "/claim/found" : "/claim/lost";

    fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            listItem.remove(); // Remove the claimed item from the list
        })
        .catch(error => console.error("Error claiming item:", error));
}
