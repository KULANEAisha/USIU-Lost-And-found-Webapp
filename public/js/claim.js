document.addEventListener("DOMContentLoaded", () => {
    const claimForm = document.getElementById("claimForm");
    const urlParams = new URLSearchParams(window.location.search);
    
    // Set item name from URL
    document.getElementById("item_name").value = 
        decodeURIComponent(urlParams.get("item_name") || "Unknown Item");

    // Form submission
    claimForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const submitBtn = claimForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const claimData = {
            item_id: urlParams.get("id"),
            item_type: urlParams.get("type") === "lost" ? "Lost" : "Found",
            full_name: document.getElementById("full_name").value,
            contact: document.getElementById("contact").value,
            reason: document.getElementById("reason").value
        };

        try {
            const response = await fetch("/claim-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(claimData)
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            alert("Claim submitted successfully!");
            window.location.href = "index.html";
        } catch (error) {
            console.error("Error:", error);
            alert(`Error: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Claim";
        }
    });
});