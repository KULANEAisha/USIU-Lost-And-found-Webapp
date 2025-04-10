// ========================
// DEBUGGING CONFIGURATION
// ========================
console.log("[ADMIN] Script loaded successfully");

// ========================
// API CONFIGURATION
// ========================
const API_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000' 
  : window.location.origin;

console.log("API Base URL:", API_BASE_URL);

// ========================
// CARD CREATION (MOVED TO TOP)
// ========================
function createAdminItemCard(item) {
  try {
    const card = document.createElement('div');
    card.className = 'admin-card';
    
    card.innerHTML = `
      <div class="card-header">
        <span class="item-status ${item.status.toLowerCase()}">${item.status}</span>
        <span class="item-date">${new Date(item.date).toLocaleDateString()}</span>
      </div>
      <div class="card-body">
        <h4>${item.name || item.item_name}</h4>
        <p>${item.description}</p>
        ${item.location ? `<p class="location">Location: ${item.location}</p>` : ''}
        ${item.image ? `<img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="card-footer">
        <button class="btn small-btn view-btn" data-item-id="${item.id}">View Details</button>
      </div>
    `;
    return card;
  } catch (error) {
    console.error("[ADMIN] Card creation failed:", error);
    const errorCard = document.createElement('div');
    errorCard.className = 'error-card';
    errorCard.textContent = `Error displaying item`;
    return errorCard;
  }
}

// ========================
// API FETCH FUNCTION
// ========================
async function fetchAdminData(endpoint) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`[DEBUG] Fetching: ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
  
    } catch (error) {
      console.error(`[ERROR] Fetch failed for ${url}:`, error);
      
      const errorContainer = document.getElementById('error-container');
      if (errorContainer) {
        errorContainer.innerHTML = `
          <div class="error-alert">
            Failed to load data from server. 
            <br>Technical details: ${error.message}
          </div>
        `;
      }
      
      throw error;
    }
}

// ========================
// DATA LOADING FUNCTIONS
// ========================
async function loadAdminStats() {
  try {
    const stats = await fetchAdminData('/api/admin/stats');
    console.log('[DEBUG] Stats data:', stats);
    
    document.getElementById('pendingCount').textContent = stats.pendingItems || 0;
    document.getElementById('verifiedCount').textContent = stats.verifiedClaims || 0;
    document.getElementById('flaggedCount').textContent = stats.flaggedItems || 0;
  } catch (error) {
    console.error("[ADMIN] Stats load failed:", error);
  }
}

async function loadLostItems() {
  const container = document.getElementById('lost-items');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">Loading lost items...</div>';
    const items = await fetchAdminData('/api/admin/items/lost');
    console.log('[DEBUG] Lost items data:', items);
    
    container.innerHTML = '';
    
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-message">No lost items found</p>';
      return;
    }

    items.forEach(item => {
      container.appendChild(createAdminItemCard(item));
    });
  } catch (error) {
    console.error("[ADMIN] Lost items load failed:", error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load lost items</p>
        <button onclick="loadLostItems()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

async function loadFoundItems() {
  const container = document.getElementById('found-items');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">Loading found items...</div>';
    const items = await fetchAdminData('/api/admin/items/found');
    console.log('[DEBUG] Found items data:', items);
    
    container.innerHTML = '';
    
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-message">No found items found</p>';
      return;
    }

    items.forEach(item => {
      container.appendChild(createAdminItemCard(item));
    });
  } catch (error) {
    console.error("[ADMIN] Found items load failed:", error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load found items</p>
        <button onclick="loadFoundItems()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

async function loadClaims() {
  const container = document.getElementById('claimed-items');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">Loading claims...</div>';
    const claims = await fetchAdminData('/api/admin/claims');
    console.log('[DEBUG] Claims data:', claims);
    
    container.innerHTML = '';
    
    if (claims.length === 0) {
      container.innerHTML = '<p class="empty-message">No claims found</p>';
      return;
    }

    claims.forEach(claim => {
      container.appendChild(createAdminItemCard(claim));
    });
  } catch (error) {
    console.error("[ADMIN] Claims load failed:", error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load claims</p>
        <button onclick="loadClaims()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

// ========================
// INITIALIZATION
// ========================
document.addEventListener("DOMContentLoaded", () => {
  // Load all data
  Promise.allSettled([
    loadAdminStats(),
    loadLostItems(),
    loadFoundItems(),
    loadClaims()
  ]).then(results => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Load failed for ${['Stats', 'Lost Items', 'Found Items', 'Claims'][index]}:`, result.reason);
      }
    });
  });

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${tab}-tab`).classList.add('active');
    });
  });
});