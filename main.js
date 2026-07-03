/* ==========================================================================
   FrigidFlow Logistics Dashboard - Core Application JS (Vanilla)
   ========================================================================== */

let allWarehouses = [];
let filteredWarehouses = [];
let chartInstance = null;
let currentLayout = 'grid'; // 'grid' or 'list'

// SVG Map Dimensions
const MAP_WIDTH = 800;
const MAP_HEIGHT = 450;

// Coordinate Mapping for India Bounding Box: Latitude [8, 36], Longitude [68, 97]
const CITY_COORDINATES = {
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'kochi': { lat: 9.9312, lng: 76.2673 },
    'nashik': { lat: 19.9975, lng: 73.7898 },
    'sangli': { lat: 16.8524, lng: 74.5815 },
    'nagpur': { lat: 21.1458, lng: 79.0882 },
    'surat': { lat: 21.1702, lng: 72.8311 },
    'anand': { lat: 22.5645, lng: 72.9289 },
    'ludhiana': { lat: 30.9010, lng: 75.8573 },
    'karnal': { lat: 29.6857, lng: 76.9905 },
    'alwar': { lat: 27.5530, lng: 76.6089 },
    'guntur': { lat: 16.3067, lng: 80.4365 },
    'vijayawada': { lat: 16.5062, lng: 80.6480 },
    'indore': { lat: 22.7196, lng: 75.8577 },
    'muzaffarpur': { lat: 26.1209, lng: 85.3647 },
    'shimla': { lat: 31.1048, lng: 77.1734 },
    'agra': { lat: 27.1767, lng: 78.0081 },
    'ratnagiri': { lat: 16.9902, lng: 73.3120 }
};

function projectCoordinates(lat, lng) {
    const x = ((lng - 68) / (97 - 68)) * MAP_WIDTH;
    // Invert Y axis because SVG coordinates increase downwards
    const y = ((36 - lat) / (36 - 8)) * MAP_HEIGHT;
    return { x, y };
}

// Logistics Hub Connections to draw (futuristic grid overlay)
const HUB_CONNECTIONS = [
    { from: 'mumbai', to: 'pune' },
    { from: 'mumbai', to: 'ahmedabad' },
    { from: 'mumbai', to: 'delhi' },
    { from: 'mumbai', to: 'bengaluru' },
    { from: 'pune', to: 'bengaluru' },
    { from: 'bengaluru', to: 'kochi' },
    { from: 'bengaluru', to: 'chennai' },
    { from: 'chennai', to: 'hyderabad' },
    { from: 'hyderabad', to: 'mumbai' },
    { from: 'hyderabad', to: 'bengaluru' },
    { from: 'kolkata', to: 'delhi' },
    { from: 'kolkata', to: 'chennai' },
    { from: 'delhi', to: 'jaipur' },
    { from: 'delhi', to: 'ahmedabad' },
    { from: 'nashik', to: 'mumbai' },
    { from: 'sangli', to: 'pune' },
    { from: 'nagpur', to: 'mumbai' },
    { from: 'guntur', to: 'vijayawada' },
    { from: 'indore', to: 'ahmedabad' },
    { from: 'karnal', to: 'delhi' },
    { from: 'shimla', to: 'delhi' }
];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    setupNavigation();
    setupSimulation();
    await loadData();
    updateDashboard();
}

// 1. Load data from static JSON
async function loadData() {
    try {
        const response = await fetch('/data/warehouses.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allWarehouses = await response.json();
        filteredWarehouses = [...allWarehouses];
    } catch (error) {
        console.error('Failed to load warehouse vacancy index:', error);
        // Display user error notice
        document.getElementById('inventory-grid').innerHTML = `
            <div class="card p-20 col-span-2 text-center">
                <i class="fa-solid fa-triangle-exclamation text-danger" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <h4>Failed to Load Storage Index</h4>
                <p class="text-secondary">Please check that the JSON static index has been compiled correctly. Run <code>npm run update-index</code> locally.</p>
            </div>
        `;
    }
}

// 2. Set up event listeners
function setupEventListeners() {
    // Search Bar input
    document.getElementById('search-input').addEventListener('input', filterData);

    // Toggle Filters Drawer
    const btnToggleFilters = document.getElementById('btn-toggle-filters');
    const filtersDrawer = document.getElementById('filters-drawer');
    btnToggleFilters.addEventListener('click', () => {
        filtersDrawer.classList.toggle('closed');
        const isOpen = !filtersDrawer.classList.contains('closed');
        btnToggleFilters.innerHTML = isOpen 
            ? '<i class="fa-solid fa-xmark"></i> Hide Filters' 
            : '<i class="fa-solid fa-sliders"></i> Filters';
    });

    // Toggle Layout View (Grid/List)
    const btnToggleView = document.getElementById('btn-toggle-view');
    btnToggleView.addEventListener('click', () => {
        const grid = document.getElementById('inventory-grid');
        if (currentLayout === 'grid') {
            currentLayout = 'list';
            grid.classList.add('list-view');
            btnToggleView.innerHTML = '<i class="fa-solid fa-grip"></i>';
            btnToggleView.title = 'Switch to Grid View';
        } else {
            currentLayout = 'grid';
            grid.classList.remove('list-view');
            btnToggleView.innerHTML = '<i class="fa-solid fa-list-ul"></i>';
            btnToggleView.title = 'Switch to List View';
        }
        renderInventoryList();
    });

    // Slider range indicators
    const priceRange = document.getElementById('price-range');
    const priceVal = document.getElementById('price-val');
    priceRange.addEventListener('input', () => {
        const val = parseFloat(priceRange.value);
        priceVal.textContent = val === 300 ? 'Any' : `₹${val}/day`;
        filterData();
    });

    const capRange = document.getElementById('capacity-range');
    const capVal = document.getElementById('capacity-val');
    capRange.addEventListener('input', () => {
        const val = parseInt(capRange.value, 10);
        capVal.textContent = val === 0 ? 'Any' : `${val.toLocaleString()} Pallets`;
        filterData();
    });

    // Source Filter Change
    document.querySelectorAll('input[name="source-type"]').forEach(cb => {
        cb.addEventListener('change', filterData);
    });

    // Sort select list
    document.getElementById('sort-select').addEventListener('change', sortAndRender);

    // Apply & Reset Filters Buttons
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
        filtersDrawer.classList.add('closed');
        btnToggleFilters.innerHTML = '<i class="fa-solid fa-sliders"></i> Filters';
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.querySelectorAll('input[name="temp-zone"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="amenity"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('input[name="source-type"]').forEach(cb => cb.checked = false);
        priceRange.value = 300;
        priceVal.textContent = 'Any';
        capRange.value = 0;
        capVal.textContent = 'Any';
        document.getElementById('search-input').value = '';
        filterData();
    });

    // Close Modal overlay
    document.getElementById('btn-close-modal').addEventListener('click', closeModal);
    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') closeModal();
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Simulated Form Toggle
    document.getElementById('btn-open-form-modal').addEventListener('click', () => {
        document.getElementById('form-modal').classList.add('open');
    });
    document.getElementById('btn-close-form-modal').addEventListener('click', () => {
        document.getElementById('form-modal').classList.remove('open');
    });

    // Google Analytics booking inquiry form tracking
    const bookingForm = document.getElementById('booking-inquiry-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', () => {
            const whName = document.getElementById('modal-warehouse-name').textContent;
            const pallets = parseInt(document.getElementById('booking-pallets').value, 10);
            trackGAEvent('generate_lead', 'Conversion', whName, pallets);
        });
    }
}

// 3. Navigation Controls
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const targetView = item.getAttribute('data-view');
            document.querySelectorAll('.view-pane').forEach(pane => {
                pane.classList.add('hidden');
            });
            document.getElementById(`view-${targetView}`).classList.remove('hidden');
        });
    });
}

// 4. Filter data based on form controls
function filterData() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    
    // Checked temperature zones
    const selectedTemps = Array.from(document.querySelectorAll('input[name="temp-zone"]:checked')).map(cb => cb.value);
    
    // Checked amenities/certifications
    const selectedAmenities = Array.from(document.querySelectorAll('input[name="amenity"]:checked')).map(cb => cb.value);

    // Checked source filters
    const selectedSources = Array.from(document.querySelectorAll('input[name="source-type"]:checked')).map(cb => cb.value);
    
    // Sliders
    const maxPrice = parseFloat(document.getElementById('price-range').value);
    const minVacant = parseInt(document.getElementById('capacity-range').value, 10);

    // Track analytics events
    if (query) {
        trackGAEvent('search', 'Engagement', query);
    }
    if (selectedTemps.length > 0) {
        trackGAEvent('filter_temperature', 'Engagement', selectedTemps.join(','));
    }
    if (selectedAmenities.length > 0) {
        trackGAEvent('filter_amenities', 'Engagement', selectedAmenities.join(','));
    }

    filteredWarehouses = allWarehouses.filter(wh => {
        // Query match
        const matchesQuery = !query || 
            wh.name.toLowerCase().includes(query) ||
            wh.owner_name.toLowerCase().includes(query) ||
            wh.location.city.toLowerCase().includes(query) ||
            wh.location.state.toLowerCase().includes(query);

        // Temp match
        const matchesTemp = selectedTemps.length === 0 || selectedTemps.includes(wh.temperature_type);

        // Amenities match
        const matchesAmenities = selectedAmenities.length === 0 || 
            selectedAmenities.every(amenity => wh.amenities.includes(amenity));

        // Source match
        let isGov = wh.source !== 'Crowdsourced';
        const matchesSource = selectedSources.length === 0 || 
            (selectedSources.includes('Government Verified') && isGov) ||
            (selectedSources.includes('Crowdsourced') && !isGov);

        // Pricing match (slider at 300 counts as "Any")
        const matchesPrice = maxPrice === 300 || wh.price_per_pallet_day <= maxPrice;

        // Capacity match
        const matchesCapacity = wh.vacant_capacity >= minVacant;

        return matchesQuery && matchesTemp && matchesAmenities && matchesSource && matchesPrice && matchesCapacity;
    });

    sortAndRender();
}

// 5. Sort and render results
function sortAndRender() {
    const sortBy = document.getElementById('sort-select').value;

    filteredWarehouses.sort((a, b) => {
        if (sortBy === 'vacancy-desc') {
            return b.vacant_capacity - a.vacant_capacity;
        } else if (sortBy === 'vacancy-asc') {
            return a.vacant_capacity - b.vacant_capacity;
        } else if (sortBy === 'price-asc') {
            return a.price_per_pallet_day - b.price_per_pallet_day;
        } else if (sortBy === 'price-desc') {
            return b.price_per_pallet_day - a.price_per_pallet_day;
        } else if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        }
        return 0;
    });

    updateDashboard();
}

// 6. Main dashboard update coordinator
function updateDashboard() {
    renderKPIs();
    renderInventoryList();
    renderInteractiveMap();
    updateAnalyticsCharts();
}

// 7. Calculate & render KPI boxes
function renderKPIs() {
    const count = filteredWarehouses.length;
    
    let totalVacant = 0;
    let totalCapacity = 0;
    let totalPrice = 0.0;
    
    filteredWarehouses.forEach(wh => {
        totalVacant += wh.vacant_capacity;
        totalCapacity += wh.total_capacity;
        totalPrice += wh.price_per_pallet_day;
    });

    const averagePrice = count > 0 ? (totalPrice / count) : 0.0;
    const vacancyRate = totalCapacity > 0 ? (totalVacant / totalCapacity) * 100 : 0.0;

    // Set UI values with animations
    document.getElementById('val-vacant-pallets').textContent = totalVacant.toLocaleString();
    document.getElementById('val-vacancy-rate').textContent = `${vacancyRate.toFixed(1)}%`;
    document.getElementById('val-avg-price').textContent = `₹${averagePrice.toFixed(2)}`;
    document.getElementById('val-active-count').textContent = count.toLocaleString();
}

// 8. Inject facility list cards
function renderInventoryList() {
    const grid = document.getElementById('inventory-grid');
    const countLabel = document.getElementById('inventory-count');
    
    countLabel.textContent = `Showing ${filteredWarehouses.length} of ${allWarehouses.length} facilities`;
    
    if (filteredWarehouses.length === 0) {
        grid.innerHTML = `
            <div class="card p-20 col-span-2 text-center" style="grid-column: 1 / -1; padding: 40px 20px;">
                <i class="fa-solid fa-box-open text-muted" style="font-size: 3rem; margin-bottom: 15px;"></i>
                <h4>No Matching Warehouses Found</h4>
                <p class="text-secondary">Try adjusting your filters, expanding your search query, or resetting search sliders.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredWarehouses.map(wh => {
        const vacancyPct = wh.total_capacity > 0 ? (wh.vacant_capacity / wh.total_capacity) * 100 : 0.0;
        const typeClass = wh.temperature_type.replace(' ', '-');
        const chipsHtml = wh.amenities.slice(0, 3).map(a => `<span class="amenity-chip">${a}</span>`).join('');
        const extraCount = wh.amenities.length - 3;
        const extraHtml = extraCount > 0 ? `<span class="amenity-chip">+${extraCount} more</span>` : '';

        // Source badge
        const isGov = wh.source !== 'Crowdsourced';
        const sourceBadge = isGov 
            ? `<span class="badge badge-gov" title="Official Government Registered Node"><i class="fa-solid fa-circle-check"></i> ${wh.source}</span>`
            : `<span class="badge badge-crowd" title="User Crowdsourced Node"><i class="fa-solid fa-users"></i> Crowdsourced</span>`;

        return `
            <div class="facility-card ${typeClass}" id="card-${wh.id}">
                <div class="card-top">
                    <div class="card-meta">
                        <span class="temp-badge">${wh.temperature_type}</span>
                        <span class="price-tag">₹${wh.price_per_pallet_day}<span>/day</span></span>
                    </div>
                    <h3 onclick="openWarehouseDetails('${wh.id}')">${wh.name}</h3>
                    <div class="location-info">
                        <i class="fa-solid fa-location-dot"></i> ${wh.location.formatted}
                    </div>

                    <div class="vacancy-tracker">
                        <div class="tracker-labels">
                            <span>Vacancy: <strong>${wh.vacant_capacity.toLocaleString()}</strong></span>
                            <span>${vacancyPct.toFixed(0)}% Available</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${vacancyPct}%"></div>
                        </div>
                    </div>

                    <div class="amenities-preview">
                        ${chipsHtml}
                        ${extraHtml}
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary btn-sm" onclick="openWarehouseDetails('${wh.id}')">
                        Inquire & Details <i class="fa-solid fa-arrow-right"></i>
                    </button>
                    ${sourceBadge}
                </div>
            </div>
        `;
    }).join('');
}

// 9. Custom interactive logistics map
function renderInteractiveMap() {
    const wrapper = document.getElementById('map-wrapper');
    wrapper.innerHTML = ''; // Clear loaded status

    // Create Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'map-tooltip';
    tooltip.id = 'map-tooltip';
    wrapper.appendChild(tooltip);

    // Create SVG Canvas
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
    svg.setAttribute('class', 'map-svg');

    // Add coordinate grid lines (premium high-tech look)
    const gridSpacing = 40;
    for (let x = gridSpacing; x < MAP_WIDTH; x += gridSpacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', MAP_HEIGHT);
        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.015)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    }
    for (let y = gridSpacing; y < MAP_HEIGHT; y += gridSpacing) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', y);
        line.setAttribute('x2', MAP_WIDTH);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', 'rgba(255, 255, 255, 0.015)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
    }

    // Add India Border Outline Backdrop (Futuristic low-poly representation)
    const indiaBorder = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    indiaBorder.setAttribute('d', 'M 193,0 L 290,24 L 331,88 L 552,153 L 566,137 L 607,137 L 800,128 L 690,225 L 580,225 L 563,217 L 497,257 L 428,297 L 339,370 L 262,450 L 229,418 L 160,333 L 132,273 L 124,241 L 55,241 L 14,201 L 55,145 L 179,80 L 166,48 L 152,24 Z');
    indiaBorder.setAttribute('class', 'map-path-india');
    svg.appendChild(indiaBorder);

    // Map the coordinate dictionary keys to check if they have active warehouses
    const cityNodes = {};
    allWarehouses.forEach(wh => {
        const cityKey = wh.location.city.toLowerCase().trim();
        const coords = CITY_COORDINATES[cityKey] || wh.coordinates;
        
        if (!cityNodes[cityKey]) {
            cityNodes[cityKey] = {
                name: wh.location.city,
                state: wh.location.state,
                coords: coords,
                total_vacant: 0,
                warehouses: []
            };
        }
        // Check if warehouse is currently filtered out
        const isFiltered = filteredWarehouses.some(f => f.id === wh.id);
        if (isFiltered) {
            cityNodes[cityKey].total_vacant += wh.vacant_capacity;
            cityNodes[cityKey].warehouses.push(wh);
        }
    });

    // Draw Faint Logistics Connections
    HUB_CONNECTIONS.forEach(conn => {
        const p1 = CITY_COORDINATES[conn.from];
        const p2 = CITY_COORDINATES[conn.to];
        if (p1 && p2) {
            const pos1 = projectCoordinates(p1.lat, p1.lng);
            const pos2 = projectCoordinates(p2.lat, p2.lng);
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', pos1.x);
            line.setAttribute('y1', pos1.y);
            line.setAttribute('x2', pos2.x);
            line.setAttribute('y2', pos2.y);
            line.setAttribute('stroke', 'rgba(79, 172, 254, 0.05)');
            line.setAttribute('stroke-dasharray', '3,3');
            line.setAttribute('stroke-width', '1');
            svg.appendChild(line);
        }
    });

    // Draw active glowing pins for cities
    Object.keys(cityNodes).forEach(key => {
        const node = cityNodes[key];
        const hasActiveNode = node.warehouses.length > 0;
        const pos = projectCoordinates(node.coords.lat, node.coords.lng);
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'map-pin');
        
        // Add animated pulse ring for active nodes
        if (hasActiveNode && node.total_vacant > 0) {
            const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pulse.setAttribute('cx', pos.x);
            pulse.setAttribute('cy', pos.y);
            pulse.setAttribute('r', '8');
            pulse.setAttribute('class', 'pulse');
            
            let color = 'var(--color-primary)';
            if (node.warehouses.some(w => w.temperature_type === 'Deep Freeze')) {
                color = 'var(--color-primary)';
            } else if (node.warehouses.some(w => w.temperature_type === 'Chilled')) {
                color = 'var(--color-success)';
            } else {
                color = 'var(--color-warning)';
            }
            pulse.setAttribute('stroke', color);
            pulse.setAttribute('fill', 'none');
            g.appendChild(pulse);
        }

        // Inner solid dot
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', pos.x);
        dot.setAttribute('cy', pos.y);
        dot.setAttribute('r', hasActiveNode ? '5' : '3');
        dot.setAttribute('fill', hasActiveNode ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)');
        if (hasActiveNode) {
            dot.setAttribute('style', 'filter: drop-shadow(0 0 4px var(--color-primary));');
        }
        g.appendChild(dot);

        // Tooltip listeners
        g.addEventListener('mouseenter', (e) => {
            const activeWhText = node.warehouses.map(w => `• ${w.name} (${w.vacant_capacity.toLocaleString()} vacant)`).join('<br>');
            tooltip.innerHTML = `
                <strong>${node.name}, ${node.state}</strong><br>
                ${hasActiveNode 
                    ? `<span style="color:var(--color-primary)">${node.warehouses.length} Active Nodes</span><br>${activeWhText}`
                    : '<span style="color:var(--text-muted)">0 Active Nodes (Filtered)</span>'
                }
            `;
            tooltip.style.opacity = '1';
            tooltip.style.left = `${pos.x}px`;
            tooltip.style.top = `${pos.y}px`;
        });

        g.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });

        // Click on node filters by that city
        g.addEventListener('click', () => {
            if (hasActiveNode) {
                document.getElementById('search-input').value = node.name;
                filterData();
            }
        });

        svg.appendChild(g);
    });

    wrapper.appendChild(svg);
}

// 10. Update ChartJS analytics
function updateAnalyticsCharts() {
    const ctx = document.getElementById('vacancyChart').getContext('2d');
    
    let freezeVacant = 0;
    let chilledVacant = 0;
    let ambientVacant = 0;

    filteredWarehouses.forEach(wh => {
        if (wh.temperature_type === 'Deep Freeze') {
            freezeVacant += wh.vacant_capacity;
        } else if (wh.temperature_type === 'Chilled') {
            chilledVacant += wh.vacant_capacity;
        } else if (wh.temperature_type === 'Ambient') {
            ambientVacant += wh.vacant_capacity;
        }
    });

    const chartData = [freezeVacant, chilledVacant, ambientVacant];

    if (chartInstance) {
        chartInstance.data.datasets[0].data = chartData;
        chartInstance.update();
        return;
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Deep Freeze', 'Chilled', 'Ambient'],
            datasets: [{
                data: chartData,
                backgroundColor: [
                    'rgba(0, 242, 254, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)'
                ],
                borderColor: [
                    '#00f2fe',
                    '#10b981',
                    '#f59e0b'
                ],
                borderWidth: 1.5,
                hoverOffset: 12
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#151b2d',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            return ` Vacancy: ${value.toLocaleString()} Pallets`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// 11. Modal Window Handlers
function openWarehouseDetails(id) {
    const wh = allWarehouses.find(w => w.id === id);
    if (!wh) return;

    document.getElementById('modal-warehouse-name').textContent = wh.name;
    document.getElementById('modal-location').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${wh.location.formatted}`;
    document.getElementById('modal-vacant-num').textContent = wh.vacant_capacity.toLocaleString();
    document.getElementById('modal-total-num').textContent = wh.total_capacity.toLocaleString();
    
    const vacancyPct = wh.total_capacity > 0 ? (wh.vacant_capacity / wh.total_capacity) * 100 : 0.0;
    const progressBar = document.getElementById('modal-progress-bar');
    progressBar.style.width = `${vacancyPct}%`;
    
    progressBar.className = 'progress-bar'; // reset
    if (wh.temperature_type === 'Deep Freeze') {
        progressBar.style.backgroundColor = 'var(--color-primary)';
    } else if (wh.temperature_type === 'Chilled') {
        progressBar.style.backgroundColor = 'var(--color-success)';
    } else {
        progressBar.style.backgroundColor = 'var(--color-warning)';
    }

    document.getElementById('modal-vacancy-pct').textContent = `${vacancyPct.toFixed(0)}% vacant capacity available`;
    document.getElementById('modal-price').textContent = `₹${wh.price_per_pallet_day}`;
    document.getElementById('modal-temp-range').textContent = wh.temperature_range;
    document.getElementById('modal-updated').textContent = wh.last_updated.split(' ')[0];
    
    const modalTempBadge = document.getElementById('modal-temp-badge');
    modalTempBadge.textContent = wh.temperature_type;
    modalTempBadge.className = 'temp-badge'; // reset
    
    document.getElementById('modal-owner-name').textContent = wh.owner_name;
    document.getElementById('modal-owner-email').textContent = wh.email;
    document.getElementById('modal-owner-email').href = `mailto:${wh.email}`;
    document.getElementById('modal-owner-phone').textContent = wh.phone;

    const featuresList = document.getElementById('modal-features-list');
    featuresList.innerHTML = wh.amenities.map(a => `
        <li><i class="fa-solid fa-circle-check"></i> ${a}</li>
    `).join('');

    document.getElementById('booking-pallets').max = wh.vacant_capacity;
    document.getElementById('booking-pallets').value = Math.min(100, wh.vacant_capacity);
    document.getElementById('booking-date').value = new Date().toISOString().split('T')[0];

    trackGAEvent('view_item', 'Inventory', wh.name);
    document.getElementById('detail-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('detail-modal').classList.remove('open');
}

// 12. Simulation Controller
function setupSimulation() {
    const term = document.getElementById('terminal-log');
    
    function logToTerminal(message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        let colorClass = 'text-primary';
        let prefix = '[INFO]';
        
        if (type === 'success') {
            colorClass = 'text-success';
            prefix = '[SUCCESS]';
        } else if (type === 'error') {
            colorClass = 'text-danger';
            prefix = '[CRITICAL]';
        } else if (type === 'warn') {
            colorClass = 'text-warning';
            prefix = '[WARNING]';
        }
        
        const line = document.createElement('div');
        line.className = `terminal-line ${colorClass}`;
        line.innerHTML = `<span class="term-time">${time}</span> <span class="term-prefix">${prefix}</span> ${message}`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    }

    // Google Form Submission Simulation
    const submissionForm = document.getElementById('owner-update-form');
    submissionForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('form-wh-name').value;
        const owner = document.getElementById('form-owner-name').value;
        const email = document.getElementById('form-email').value;
        const phone = document.getElementById('form-phone').value;
        const city = document.getElementById('form-city').value;
        const state = document.getElementById('form-state').value;
        const storageType = document.getElementById('form-storage-type').value;
        const total = parseInt(document.getElementById('form-total-cap').value, 10);
        const vacant = parseInt(document.getElementById('form-vacant-cap').value, 10);
        const price = parseFloat(document.getElementById('form-price').value);
        
        const amenities = Array.from(document.querySelectorAll('input[name="form-amenities"]:checked')).map(cb => cb.value);

        logToTerminal(`Received form submission for "${name}" in ${city}, ${state}.`, 'info');
        
        // Simulate local write & github rebuild delay
        document.getElementById('form-modal').classList.remove('open');
        logToTerminal(`Appended row to Google Sheet response tab.`, 'info');
        logToTerminal(`Triggering GitHub workflow: "Update Warehouse Vacancy Index"...`, 'warn');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 25;
            if (progress === 25) {
                logToTerminal(`GitHub Action runner initialized on ubuntu-latest.`, 'info');
            } else if (progress === 50) {
                logToTerminal(`Running Python compilation task: scripts/update_index.py`, 'info');
            } else if (progress === 75) {
                logToTerminal(`Parsed 15 government entries and 15 crowdsourced entries. Merged!`, 'info');
            } else if (progress === 100) {
                clearInterval(interval);
                
                // Inject item
                const id = `wh-sim-${allWarehouses.length + 1}`;
                let tempRange = '15°C to 25°C';
                if (storageType === 'Deep Freeze') tempRange = '-18°C to -25°C';
                else if (storageType === 'Chilled') tempRange = '0°C to 4°C';

                const newFacility = {
                    id,
                    name,
                    owner_name: owner,
                    email,
                    phone,
                    location: { city, state, formatted: `${city}, ${state}` },
                    coordinates: CITY_COORDINATES[city.toLowerCase().trim()] || { lat: 20.5937, lng: 78.9629 },
                    total_capacity: total,
                    vacant_capacity: vacant,
                    temperature_type: storageType,
                    temperature_range: tempRange,
                    price_per_pallet_day: price,
                    amenities,
                    last_updated: new Date().toISOString().replace('T', ' ').split('.')[0],
                    source: 'Crowdsourced (Simulated)'
                };

                allWarehouses.unshift(newFacility); // add to top
                filterData();
                
                logToTerminal(`Static JSON search index rebuilt successfully. Committed to repo.`, 'success');
                alert(`Success! "${name}" has been published to the directory in real-time.`);
            }
        }, 1000);
    });

    // Government Data Sync Simulation
    document.getElementById('btn-sync-gov').addEventListener('click', () => {
        const portal = document.getElementById('gov-source-select').value;
        logToTerminal(`Connecting to official APIs for: ${portal}...`, 'info');
        
        let step = 0;
        const interval = setInterval(() => {
            step++;
            if (step === 1) {
                logToTerminal(`Authenticating API token credentials for Data.gov.in portal.`, 'info');
            } else if (step === 2) {
                logToTerminal(`Scraping latest registered directories for Cold Storage nodes...`, 'warn');
            } else if (step === 3) {
                logToTerminal(`Downloaded gov_cold_storages.csv containing approved items.`, 'info');
                logToTerminal(`Merging government registered directories into local storage state...`, 'info');
            } else if (step === 4) {
                clearInterval(interval);
                
                // We'll re-fetch the official data index, which already contains the 15 preloaded gov items.
                // We can demonstrate the reload of data.
                loadData().then(() => {
                    filterData();
                    logToTerminal(`Static compiled database updated! 15 official government verified nodes synced.`, 'success');
                    alert(`Success! Imported official data nodes from ${portal}.`);
                });
            }
        }, 800);
    });
}

// Google Analytics Event Tracking Helper
function trackGAEvent(action, category, label = null, value = null) {
    if (typeof gtag === 'function') {
        const eventParams = {
            event_category: category
        };
        if (label !== null) eventParams.event_label = label;
        if (value !== null) eventParams.value = value;
        
        gtag('event', action, eventParams);
    }
}

// Attach functions to window scope to allow inline HTML onclick calls
window.openWarehouseDetails = openWarehouseDetails;
window.closeWarehouseDetails = closeModal;
