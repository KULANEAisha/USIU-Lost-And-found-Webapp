console.log("[1] Script loaded - starting execution");

document.addEventListener('DOMContentLoaded', () => {
  console.log("[2] DOM fully loaded - initializing");
  
  try {
    // Element detection
    const itemsGrid = document.getElementById('itemsGrid');
    const filterType = document.getElementById('filterType');
    const searchInput = document.getElementById('searchInput');
    
    console.log("[3] Elements detected:", {
      itemsGrid: !!itemsGrid,
      filterType: !!filterType,
      searchInput: !!searchInput
    });

    if (!itemsGrid || !filterType || !searchInput) {
      throw new Error("Critical elements missing from DOM");
    }

    let allItems = [];
    let currentPage = 1;
    const itemsPerPage = 12;

    function loadItems(page = 1) {
      console.log(`[4] loadItems() called for page ${page}`);
      currentPage = page;
      
      try {
        itemsGrid.innerHTML = '<div class="loading">Loading items...</div>';
        console.log(`[5] Attempting fetch: /api/items?page=${page}&limit=${itemsPerPage}`);
        
        fetch(`/api/items?page=${page}&limit=${itemsPerPage}`)
          .then(response => {
            console.log("[6] Fetch response received", {
              status: response.status,
              ok: response.ok,
              url: response.url
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            console.log("[7] API response data:", {
              itemCount: data.items?.length || 0,
              pagination: data.pagination
            });
            
            allItems = data.items || [];
            displayItems(allItems);
            setupFiltering(data);
            setupPagination(data.pagination);
          })
          .catch(error => {
            console.error("[8] Fetch chain error:", error);
            itemsGrid.innerHTML = '<div class="error">Failed to load items. Please try again.</div>';
          });
      } catch (err) {
        console.error("[9] loadItems() execution error:", err);
      }
    }

    function displayItems(items) {
      console.log(`[10] displayItems() called with ${items.length} items`);
      
      if (items.length === 0) {
        console.log("[11] No items to display");
        itemsGrid.innerHTML = '<div class="no-items">No items found</div>';
        return;
      }

      itemsGrid.innerHTML = '';
      console.log("[12] Creating item cards...");
      
      items.forEach((item, index) => {
        console.log(`[13] Rendering item ${index + 1}:`, {
          id: item.id,
          name: item.name,
          type: item.type
        });
        
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
          ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image">` : ''}
          <div class="item-details">
            <h3>${item.name}</h3>
            <div class="item-meta">
              <span>${new Date(item.date).toLocaleDateString()}</span>
              <span class="item-type ${item.type.toLowerCase()}">${item.type}</span>
              <span class="item-status ${item.status.toLowerCase()}">${item.status}</span>
            </div>
            <p>${item.description || 'No description available'}</p>
            <p><strong>Location:</strong> ${item.location || 'Unknown'}</p>
            ${item.type === 'Found' && item.status === 'Approved' ? 
              `<a href="claim-form.html?id=${item.id}" class="btn claim-btn">Claim This Item</a>` : ''}
          </div>
        `;
        
        itemsGrid.appendChild(itemCard);
      });
    }

    function setupFiltering(data) {
      console.log("[14] Setting up filters");
      
      function applyFilters() {
        const typeFilter = filterType.value;
        const searchTerm = searchInput.value.toLowerCase();
        console.log("[15] Applying filters:", { typeFilter, searchTerm });
        
        const filtered = data.items.filter(item => {
          const matchesType = typeFilter === 'all' || item.type === typeFilter;
          const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                              (item.description && item.description.toLowerCase().includes(searchTerm));
          return matchesType && matchesSearch;
        });
        
        console.log(`[16] Filtered ${data.items.length} items down to ${filtered.length}`);
        displayItems(filtered);
      }
      
      filterType.addEventListener('change', applyFilters);
      searchInput.addEventListener('input', applyFilters);
    }

    function setupPagination(pagination) {
      console.log("[17] Setting up pagination:", pagination);
      
      const paginationContainer = document.createElement('div');
      paginationContainer.className = 'pagination';
      
      if (pagination.totalPages > 1) {
        console.log(`[18] Creating ${pagination.totalPages} page buttons`);
        // ... (keep existing pagination logic)
      }
    }

    console.log("[19] Starting initial load...");
    loadItems();
    
  } catch (err) {
    console.error("[20] Top-level initialization error:", err);
  }
});

console.log("[21] Main execution complete (waiting for DOM)");