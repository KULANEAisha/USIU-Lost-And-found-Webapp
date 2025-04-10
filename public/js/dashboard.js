// ========================
// DEBUGGING CONFIGURATION
// ========================
console.log("[DASHBOARD] Script loaded successfully");

// Clear any invalid token on load
if (localStorage.getItem('token')) {
  const tokenParts = localStorage.getItem('token').split('.');
  if (tokenParts.length !== 3) {
    console.warn("[AUTH] Invalid token format - clearing");
    localStorage.removeItem('token');
    window.location.href = 'login.html';
  }
}

// ========================
// AUTH UTILITIES
// ========================
const attachToken = (options = {}) => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error("[AUTH] No token found");
    window.location.href = 'login.html';
    return options;
  }

  // Basic JWT format validation
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    console.error("[AUTH] Malformed token");
    localStorage.removeItem('token');
    window.location.href = 'login.html';
    return options;
  }

  console.log("[AUTH] Attaching valid token");
  return {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  };
};

async function fetchWithAuth(url, options = {}) {
  try {
    const response = await fetch(url, attachToken(options));
    
    if (response.status === 401 || response.status === 403) {
      console.warn("[AUTH] Token rejected - redirecting to login");
      localStorage.removeItem('token');
      window.location.href = 'login.html';
      return Promise.reject('Authentication required');
    }
    
    return response;
  } catch (error) {
    console.error("[AUTH] Network error:", error);
    throw error;
  }
}

// ========================
// FIELD MAPPING UTILITY
// ========================
function mapItemFields(item) {
  const mappedItem = {
    id: item.id,
    name: item.item_name || item.name,
    description: item.description || 'No description',
    date: item.date_lost || item.date_found || item.date,
    image: item.image_path || item.image,
    status: item.status || 'Unknown',
    type: item.type || 'Unknown',
    location: item.location || 'Unknown location'
  };
  return mappedItem;
}

// ========================
// CARD CREATION
// ========================
function createDashboardItemCard(item) {
  try {
    const mappedItem = mapItemFields(item);
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.dataset.reportId = mappedItem.id.toString();
    
    card.innerHTML = `
      <div class="card-header">
        <span class="item-status ${mappedItem.status.toLowerCase()}">${mappedItem.status}</span>
        <span class="item-date">${new Date(mappedItem.date).toLocaleDateString()}</span>
      </div>
      <div class="card-body">
        <h4>${mappedItem.name}</h4>
        <p>${mappedItem.description}</p>
        ${mappedItem.location ? `<p class="location">Location: ${mappedItem.location}</p>` : ''}
        ${mappedItem.image ? `<img src="${mappedItem.image}" alt="${mappedItem.name}" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="card-footer">
        ${mappedItem.type === 'Found' ? `<button class="btn small-btn claim-btn" data-item-id="${mappedItem.id}">View Claim</button>` : ''}
      </div>
    `;
    return card;
  } catch (error) {
    console.error("[UI] Card creation failed:", error);
    const errorCard = document.createElement('div');
    errorCard.className = 'error-card';
    errorCard.textContent = `Error displaying item`;
    return errorCard;
  }
}

// ========================
// DATA LOADING FUNCTIONS
// ========================
async function loadUserData() {
  const userNameEl = document.getElementById('userName');
  if (!userNameEl) return;

  try {
    userNameEl.textContent = "Loading...";
    const response = await fetchWithAuth('/api/user');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const user = await response.json();
    
    document.getElementById('userName').textContent = user.username || user.fullName || "User";
    document.getElementById('userEmail').textContent = user.email || "No email";
    document.getElementById('lostCount').textContent = user.lostItems ?? 0;
    document.getElementById('foundCount').textContent = user.foundItems ?? 0;
    document.getElementById('claimedCount').textContent = user.claimedItems ?? 0;

  } catch (error) {
    console.error("[USER] Load failed:", error);
    document.getElementById('userName').textContent = "Error loading profile";
  }
}

async function loadReportedItems() {
  const container = document.getElementById('reported-items');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">Loading items...</div>';
    const response = await fetchWithAuth('/api/user/items');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json(); // Get the full response object
    const items = data.items; // Extract the items array from the response
    
    container.innerHTML = '';
    
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-message">No reported items</p>';
      return;
    }

    items.forEach(item => {
      container.appendChild(createDashboardItemCard(item));
    });

    // Add claim button handlers
    document.querySelectorAll('.claim-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = btn.dataset.itemId;
        window.location.href = `claim.html?itemId=${itemId}`;
      });
    });

  } catch (error) {
    console.error("[ITEMS] Load failed:", error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load items</p>
        <button onclick="loadReportedItems()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

async function loadClaimedItems() {
  const container = document.getElementById('claimed-items');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">Loading claims...</div>';
    const response = await fetchWithAuth('/api/user/claims');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json(); // Get the full response
    const items = data.items || data; // Use data.items if paginated, or fallback to direct array
    
    container.innerHTML = '';
    
    if (items.length === 0) {
      container.innerHTML = '<p class="empty-message">No claims found</p>';
      return;
    }

    items.forEach(item => {
      container.appendChild(createDashboardItemCard(item));
    });

  } catch (error) {
    console.error("[CLAIMS] Load failed:", error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load claims</p>
        <button onclick="loadClaimedItems()" class="retry-btn">Retry</button>
      </div>
    `;
  }
}

// ========================
// INITIALIZATION
// ========================
document.addEventListener("DOMContentLoaded", () => {
  // Verify authentication
  if (!localStorage.getItem('token')) {
    window.location.href = 'login.html';
    return;
  }

  // Load all data
  Promise.allSettled([
    loadUserData(),
    loadReportedItems(),
    loadClaimedItems()
  ]).then(results => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Load failed for ${['User', 'Items', 'Claims'][index]}:`, result.reason);
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

  // Logout button
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  });
});