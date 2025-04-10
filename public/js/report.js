document.addEventListener("DOMContentLoaded", () => {
    // Check authentication
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const reportForm = document.getElementById("reportForm");
    const statusSelect = document.getElementById("status");
    const dateLabel = document.getElementById("dateLabel");
    const itemImage = document.getElementById("item_image");
    const previewImage = document.getElementById("previewImage");

    // Dynamic date label
    statusSelect.addEventListener("change", () => {
        const isLost = statusSelect.value === "Lost";
        dateLabel.textContent = isLost ? "Date Lost:" : "Date Found:";
        document.getElementById("date_input").name = isLost ? "date_lost" : "date_found";
    });

    // Image preview
    itemImage.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = "block";
        };
        reader.readAsDataURL(file);
    });

    // Form submission
    reportForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error("No token found");
    
            if (!statusSelect.value) {
                throw new Error("No status selected for reporting!");
            }
    
            const formData = new FormData(reportForm);
            const endpoint = `http://localhost:3000/report/${statusSelect.value.toLowerCase()}`;
    
            console.log("🚀 Sending request to:", endpoint);
            console.log("📝 Form Data:", [...formData.entries()]);
    
            const response = await fetch(endpoint, {
                signal: controller.signal,
                method: "POST",
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
    
            console.log("🔍 Response Status:", response.status);
    
            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = 'login.html?error=expired';
                return;
            }
    
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Request failed");
            }
    
            const data = await response.json();
            console.log("✅ Success:", data);
            alert(`Report submitted successfully! ID: ${data.id || ''}`);
            window.location.href = `dashboard.html?report_id=${data.id}`;
        } catch (error) {
            console.error("❌ Fetch error:", error);
            
            if (error.name === 'AbortError') {
                alert("Request timed out. Please try again.");
            } else {
                alert(`Error: ${error.message || "Submission failed"}`);
            }
        } finally {
            clearTimeout(timeoutId);
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit";
        }
    });
});