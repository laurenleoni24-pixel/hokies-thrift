// Worker URL — kept for eBay proxy only
const WORKER_URL = 'https://hokies-thrift-ebay.laurenleoni24.workers.dev';

// Navigation and page switching
document.addEventListener('DOMContentLoaded', function() {
    initNavigation();
    initCountdown();
    initShopTabs();
    initNavigationCards();
    initSellerForm();
    initMobileMenu();
    updateCartCount();
    loadHokiesEvents();
});

// Navigate to a page by ID and update the URL hash
function navigateToPage(targetId) {
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(l => l.classList.remove('active'));
    const targetNav = document.querySelector(`.nav-links a[href="#${targetId}"]`);
    if (targetNav) targetNav.classList.add('active');

    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(targetId);
    if (targetPage) targetPage.classList.add('active');

    if (targetId === 'browse') {
        loadEbayListings();
    }

    // Update URL hash without triggering hashchange
    history.replaceState(null, '', '#' + targetId);

    document.getElementById('navLinks').classList.remove('active');
    window.scrollTo(0, 0);
}

// Navigation between pages
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateToPage(targetId);
        });
    });

    const quickLinks = document.querySelectorAll('.quick-link');
    quickLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateToPage(targetId);
        });
    });

    // Handle direct URL with hash (e.g. hokiesthrift.com/#shop)
    handleHashNavigation();

    // Handle browser back/forward buttons
    window.addEventListener('hashchange', handleHashNavigation);
}

function handleHashNavigation() {
    const hash = window.location.hash.substring(1);
    const validPages = ['home', 'shop', 'sell', 'browse', 'checkout'];
    if (hash && validPages.includes(hash)) {
        navigateToPage(hash);
    }
}

// Mobile menu toggle
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');

    menuToggle.addEventListener('click', function() {
        navLinks.classList.toggle('active');
    });
}

// Countdown Timer
// Multi-Drop Countdown System
let cachedDrops = null;
let cachedDropsTimestamp = 0;
const DROPS_CACHE_DURATION = 60000; // Refresh from Supabase every 60 seconds

function initCountdown() {
    updateUpcomingDrops();
    setInterval(updateUpcomingDrops, 1000);
}

async function updateUpcomingDrops() {
    // Refresh drops from Supabase every 60 seconds (not every tick)
    const now = Date.now();
    if (!cachedDrops || (now - cachedDropsTimestamp) > DROPS_CACHE_DURATION) {
        try {
            const { data, error } = await supabase
                .from('drops')
                .select('*')
                .in('status', ['scheduled', 'live']);
            if (!error && data) {
                cachedDrops = data;
            }
        } catch (e) {
            console.warn('Failed to fetch drops from Supabase:', e);
        }
        if (!cachedDrops) cachedDrops = [];
        cachedDropsTimestamp = now;
    }
    const drops = cachedDrops;
    const scheduledDrops = drops
        .filter(d => d.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
        .slice(0, 3);

    const container = document.getElementById('upcomingDropsCountdowns');

    if (!container) return;

    if (scheduledDrops.length === 0) {
        container.innerHTML = `
            <div class="no-upcoming-drops">
                <p>No upcoming drops scheduled</p>
                <p>Check back soon or follow us on Instagram for updates!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = scheduledDrops.map(drop => {
        const now = new Date().getTime();
        const target = new Date(drop.scheduled_date).getTime();
        const distance = target - now;

        if (distance <= 0) {
            return `<div class="drop-live-now">
                <h3>${drop.name}</h3>
                <p class="live-badge">🔴 LIVE NOW - Shop Now!</p>
            </div>`;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        return `
            <div class="upcoming-drop-card">
                <h3>${drop.name}</h3>
                ${drop.description ? `<p class="drop-desc">${drop.description}</p>` : ''}
                <div class="countdown">
                    <div class="time-box">
                        <span class="time">${String(days).padStart(2, '0')}</span>
                        <span class="label">Days</span>
                    </div>
                    <div class="time-box">
                        <span class="time">${String(hours).padStart(2, '0')}</span>
                        <span class="label">Hours</span>
                    </div>
                    <div class="time-box">
                        <span class="time">${String(minutes).padStart(2, '0')}</span>
                        <span class="label">Minutes</span>
                    </div>
                    <div class="time-box">
                        <span class="time">${String(seconds).padStart(2, '0')}</span>
                        <span class="label">Seconds</span>
                    </div>
                </div>
                <p class="drop-date">${new Date(drop.scheduled_date).toLocaleString()}</p>
            </div>
        `;
    }).join('');
}

// Load and display Hokies Events on home page
async function loadHokiesEvents() {
    const container = document.getElementById('hokiesEventsContainer');
    if (!container) return;

    try {
        const { data: events, error } = await supabase
            .from('hokies_events')
            .select('*')
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })
            .limit(6);

        if (error) throw error;

        if (!events || events.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <p>No upcoming Hokies events scheduled</p>
                    <p style="opacity: 0.8;">Check back soon for event updates!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(event => {
            const eventDate = new Date(event.event_date);
            const dateString = eventDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });
            const timeString = eventDate.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit'
            });

            return `
                <div class="event-card">
                    <div class="event-date-badge">
                        <div class="event-month">${eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</div>
                        <div class="event-day">${eventDate.getDate()}</div>
                    </div>
                    <div class="event-details">
                        <h3>${event.name}</h3>
                        <p class="event-time">🕐 ${timeString}</p>
                        ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
                        ${event.description ? `<p class="event-description">${event.description}</p>` : ''}
                        ${event.link ? `<a href="${event.link}" target="_blank" class="event-link">Event Details →</a>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load events:', err);
    }
}

// Shop Tabs
function initShopTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    loadShopInventory();

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');

            if (targetTab === 'upcoming') {
                loadUpcomingDropsPreview();
            } else if (targetTab === 'available-now') {
                loadShopInventory();
            }
        });
    });
}

// Handle navigation cards with shop tab switching
function initNavigationCards() {
    const navCards = document.querySelectorAll('.nav-card');

    navCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const shopTab = this.getAttribute('data-shop-tab');

            navigateToPage(targetId);

            if (targetId === 'shop' && shopTab) {
                const tabBtns = document.querySelectorAll('.tab-btn');
                const tabContents = document.querySelectorAll('.tab-content');

                tabBtns.forEach(b => b.classList.remove('active'));
                const targetTabBtn = document.querySelector(`.tab-btn[data-tab="${shopTab}"]`);
                if (targetTabBtn) {
                    targetTabBtn.classList.add('active');
                }

                tabContents.forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(shopTab);
                if (targetContent) {
                    targetContent.classList.add('active');
                }

                if (shopTab === 'upcoming') {
                    loadUpcomingDropsPreview();
                } else if (shopTab === 'available') {
                    loadShopInventory();
                }
            }
        });
    });
}

// Load upcoming drops preview for the "Upcoming Drops" tab
async function loadUpcomingDropsPreview() {
    const container = document.getElementById('upcomingDropsPreview');
    if (!container) return;

    try {
        // Fetch scheduled drops with their product items + images
        const { data: drops, error } = await supabase
            .from('drops')
            .select('*, drop_items(product_id)')
            .eq('status', 'scheduled')
            .order('scheduled_date', { ascending: true });

        if (error) throw error;

        if (!drops || drops.length === 0) {
            container.innerHTML = `
                <div class="upcoming-info" style="text-align: center; padding: 3rem;">
                    <h2>No upcoming drops scheduled yet</h2>
                    <p>Follow us on Instagram to get notified when we announce new drops!</p>
                    <a href="https://www.instagram.com/hokiesthrift/?hl=en" target="_blank" class="btn-primary">Follow on Instagram</a>
                </div>
            `;
            return;
        }

        // Gather all product IDs across all drops
        const allProductIds = drops.flatMap(d => (d.drop_items || []).map(di => di.product_id));

        // Fetch products with images for preview
        let productsMap = {};
        if (allProductIds.length > 0) {
            const { data: products } = await supabase
                .from('products')
                .select('id, product_images(storage_path)')
                .in('id', allProductIds);
            if (products) {
                products.forEach(p => { productsMap[p.id] = p; });
            }
        }

        container.innerHTML = drops.map(drop => {
            const dropProductIds = (drop.drop_items || []).map(di => di.product_id);
            const sampleImages = dropProductIds.slice(0, 4).map(pid => {
                const product = productsMap[pid];
                if (product && product.product_images && product.product_images.length > 0) {
                    return product.product_images[0].storage_path;
                }
                return null;
            }).filter(img => img !== null);

            const now = new Date().getTime();
            const target = new Date(drop.scheduled_date).getTime();
            const distance = target - now;
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            return `
                <div class="upcoming-drop-preview">
                    ${sampleImages.length > 0 ? `
                        <div class="drop-preview-images">
                            ${sampleImages.slice(0, 4).map(img =>
                                `<img src="${img}" alt="Preview">`
                            ).join('')}
                        </div>
                    ` : ''}
                    <div class="drop-preview-info">
                        <h3>${drop.name}</h3>
                        ${drop.description ? `<p>${drop.description}</p>` : ''}
                        <p class="drop-stats">${dropProductIds.length} items dropping in ${days > 0 ? days + ' days' : hours + ' hours'}</p>
                        <p class="drop-schedule"><strong>Drops:</strong> ${new Date(drop.scheduled_date).toLocaleString()}</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Failed to load upcoming drops preview:', err);
    }
}

// Seller Form with Price Estimation
function initSellerForm() {
    const form = document.getElementById('sellerForm');
    const itemType = document.getElementById('itemType');
    const itemCondition = document.getElementById('itemCondition');
    const itemEra = document.getElementById('itemEra');
    const estimateAmount = document.getElementById('estimateAmount');
    const itemPhotos = document.getElementById('itemPhotos');

    if (!form || !itemType || !itemCondition || !itemEra || !estimateAmount || !itemPhotos) {
        console.error('Seller form elements not found');
        return;
    }

    // Handle photo preview — store File objects for Supabase upload
    let sellerPhotoFiles = [];
    itemPhotos.addEventListener('change', function(e) {
        const files = e.target.files;
        const preview = document.getElementById('sellerPhotoPreview');
        if (!preview) {
            console.error('Photo preview element not found');
            return;
        }
        preview.innerHTML = '';
        sellerPhotoFiles = [];

        if (files.length > 5) {
            alert('Maximum 5 photos allowed. Only first 5 will be used.');
        }

        const fileArray = Array.from(files).slice(0, 5);

        fileArray.forEach((file) => {
            sellerPhotoFiles.push(file);

            const reader = new FileReader();
            reader.onload = function(event) {
                const imgContainer = document.createElement('div');
                imgContainer.style.cssText = 'position: relative; display: inline-block;';

                const previewImg = document.createElement('img');
                previewImg.src = event.target.result;
                previewImg.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid var(--gray-300);';

                imgContainer.appendChild(previewImg);
                preview.appendChild(imgContainer);
            };
            reader.readAsDataURL(file);
        });
    });

    // Update estimate when inputs change
    [itemType, itemCondition, itemEra].forEach(input => {
        input.addEventListener('change', updateEstimate);
    });

    function updateEstimate() {
        const type = itemType.value;
        const condition = itemCondition.value;
        const era = itemEra.value;

        if (!type || !condition) {
            estimateAmount.textContent = '$0 - $0';
            return;
        }

        const basePrices = {
            'hoodie': { min: 25, max: 45 },
            'jacket': { min: 40, max: 90 },
            'tshirt': { min: 15, max: 35 },
            'jersey': { min: 30, max: 70 },
            'hat': { min: 10, max: 25 },
            'other': { min: 15, max: 40 }
        };

        const conditionMultipliers = {
            'excellent': 1.0,
            'good': 0.8,
            'fair': 0.6,
            'poor': 0.4
        };

        const eraBonus = {
            '2020s': 0,
            '2010s': 5,
            '2000s': 10,
            '1990s': 15,
            '1980s': 20,
            'older': 25
        };

        let base = basePrices[type] || basePrices['other'];
        let multiplier = conditionMultipliers[condition] || 0.8;
        let bonus = era ? (eraBonus[era] || 0) : 0;

        let minPrice = Math.round((base.min * multiplier + bonus) * 0.6);
        let maxPrice = Math.round((base.max * multiplier + bonus) * 0.6);

        estimateAmount.textContent = `$${minPrice} - $${maxPrice}`;
    }

    // Form submission — save to Supabase + upload images to Storage
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        try {
            if (sellerPhotoFiles.length === 0) {
                alert('Please upload at least one photo of your item');
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
            }

            const estimateText = document.getElementById('estimateAmount').textContent;
            const submissionId = Date.now().toString();

            // Insert submission into Supabase
            const { error: insertError } = await supabase
                .from('seller_submissions')
                .insert({
                    id: submissionId,
                    name: document.getElementById('sellerName').value,
                    email: document.getElementById('sellerEmail').value,
                    phone: document.getElementById('sellerPhone').value || null,
                    item_type: itemType.value,
                    description: document.getElementById('itemDescription').value,
                    condition: itemCondition.value,
                    era: itemEra.value || null,
                    estimate: estimateText,
                    status: 'pending_admin'
                });

            if (insertError) throw insertError;

            // Upload photos to Supabase Storage
            for (let i = 0; i < sellerPhotoFiles.length; i++) {
                const file = sellerPhotoFiles[i];
                const compressed = await compressImage(file, 1200, 0.7);
                const url = await uploadImageFile('submission-images', compressed, `submissions/${submissionId}`);

                await supabase
                    .from('submission_images')
                    .insert({
                        submission_id: submissionId,
                        storage_path: url,
                        display_order: i
                    });
            }

            // Show success message
            form.style.display = 'none';
            document.getElementById('estimateResult').style.display = 'none';
            document.getElementById('submissionSuccess').style.display = 'block';

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Item';
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred while submitting your item. Please try again.');
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Item';
            }
        }
    });
}

// Reset form function
function resetForm() {
    document.getElementById('sellerForm').reset();
    document.getElementById('sellerForm').style.display = 'block';
    document.getElementById('estimateResult').style.display = 'block';
    document.getElementById('submissionSuccess').style.display = 'none';
    document.getElementById('estimateAmount').textContent = '$0 - $0';
}

// ==============================
// EBAY INTEGRATION
// ==============================

let ebayListingsCache = {
    data: null,
    timestamp: null,
    cacheDuration: 15 * 60 * 1000
};

async function loadEbayListings() {
    const grid = document.getElementById('ebayListingsGrid');

    // Fetch eBay settings from Supabase settings table
    let settings = null;
    try {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'ebay')
            .single();
        if (data) settings = data.value;
    } catch (e) {
        console.warn('Could not fetch eBay settings from Supabase:', e);
    }

    if (!settings || !settings.proxyUrl || !settings.ebaySellerUsername) {
        grid.innerHTML = `
            <div class="ebay-error">
                <h3>⚙️ eBay Integration Not Configured</h3>
                <p>The eBay integration needs to be set up in the admin panel.</p>
                <a href="admin.html" class="btn-primary" style="margin-top: 1rem; display: inline-block;">Go to Admin Settings</a>
            </div>
        `;
        return;
    }

    // Check cache first
    if (ebayListingsCache.data && ebayListingsCache.timestamp &&
        (Date.now() - ebayListingsCache.timestamp) < ebayListingsCache.cacheDuration) {
        renderEbayListings(ebayListingsCache.data);
        return;
    }

    grid.innerHTML = '<div class="ebay-loading">⏳ Loading eBay listings...</div>';

    try {
        const listingsUrl = `${settings.proxyUrl.replace(/\/$/, '')}/listings?seller=${encodeURIComponent(settings.ebaySellerUsername)}&limit=200`;
        const response = await fetch(listingsUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch listings: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        ebayListingsCache.data = data;
        ebayListingsCache.timestamp = Date.now();

        renderEbayListings(data);
    } catch (error) {
        console.error('Failed to load eBay listings:', error);
        grid.innerHTML = `
            <div class="ebay-error">
                <h3>✗ Failed to Load Listings</h3>
                <p>Error: ${error.message}</p>
                <p style="font-size: 0.9rem; margin-top: 1rem;">Check your proxy URL and ensure the Cloudflare Worker is deployed correctly.</p>
                <button class="btn-primary" onclick="refreshEbayListings()" style="margin-top: 1rem;">
                    Try Again
                </button>
            </div>
        `;
    }
}

async function renderEbayListings(data) {
    const grid = document.getElementById('ebayListingsGrid');

    if (!data.items || data.items.length === 0) {
        grid.innerHTML = `
            <div class="info-box">
                <h3>📦 No Items Listed</h3>
                <p>Check back soon for new vintage VT gear!</p>
            </div>
        `;
        return;
    }

    // Fetch settings and approved items from Supabase
    let settings = {}, approvedItems = [];
    try {
        const { data: rows } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['ebay', 'ebay_approved_items']);
        if (rows) {
            rows.forEach(r => {
                if (r.key === 'ebay') settings = r.value;
                if (r.key === 'ebay_approved_items') approvedItems = r.value || [];
            });
        }
    } catch (e) {
        console.warn('Could not fetch eBay settings from Supabase:', e);
    }

    let itemsToDisplay = data.items;

    if (approvedItems.length > 0) {
        itemsToDisplay = data.items.filter(item => approvedItems.includes(item.itemId));
    }

    if (itemsToDisplay.length === 0) {
        grid.innerHTML = `
            <div class="info-box">
                <h3>📦 No Approved Items</h3>
                <p>No items have been approved for display yet. Visit the admin panel to curate your eBay listings.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = itemsToDisplay.map(item => {
        const affiliateLink = buildAffiliateLink(item.itemWebUrl, settings.epnCampaignId);
        const price = parseFloat(item.price.value);
        const priceDisplay = `$${price.toFixed(2)}`;

        return `
            <div class="ebay-listing-card">
                <img src="${item.image || 'https://via.placeholder.com/300x300?text=No+Image'}"
                     alt="${escapeHtml(item.title)}"
                     onerror="this.src='https://via.placeholder.com/300x300?text=No+Image'">
                <h3>${escapeHtml(item.title)}</h3>
                <p class="price">${priceDisplay}</p>
                <p class="condition">${escapeHtml(item.condition)}</p>
                <a href="${affiliateLink}" target="_blank" rel="noopener noreferrer" class="btn-primary">
                    View on eBay →
                </a>
            </div>
        `;
    }).join('');
}

function buildAffiliateLink(itemUrl, campaignId) {
    if (!itemUrl || !campaignId) {
        return itemUrl;
    }

    const params = new URLSearchParams({
        mkevt: '1',
        mkcid: '1',
        mkrid: '711-53200-19255-0',
        campid: campaignId,
        toolid: '10001'
    });

    return `${itemUrl}&${params.toString()}`;
}

function refreshEbayListings() {
    ebayListingsCache.data = null;
    ebayListingsCache.timestamp = null;
    loadEbayListings();
}

function sortEbayListings(sortBy) {
    const data = ebayListingsCache.data;

    if (!data || !data.items) {
        return;
    }

    const items = [...data.items];

    switch (sortBy) {
        case 'price-low':
            items.sort((a, b) => parseFloat(a.price.value) - parseFloat(b.price.value));
            break;
        case 'price-high':
            items.sort((a, b) => parseFloat(b.price.value) - parseFloat(a.price.value));
            break;
        case 'recent':
        default:
            break;
    }

    renderEbayListings({ ...data, items });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==============================
// SHIPPO SHIPPING INTEGRATION
// ==============================

async function createShippingLabel(order) {
    // Fetch Shippo settings from Supabase
    let shippoSettings = {};
    try {
        const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'shippo')
            .single();
        if (data) shippoSettings = data.value;
    } catch (e) {
        console.warn('Could not fetch Shippo settings:', e);
    }

    if (!shippoSettings.shippoApiKey) {
        console.error('Shippo API key not configured');
        return null;
    }

    try {
        const address = order.shippingAddress;
        const street1 = address.street;
        const street2 = address.apt || '';
        const city = address.city;
        const state = address.state;
        const zip = address.zip;

        const shipmentData = {
            address_from: {
                name: "Hokies Thrift",
                street1: shippoSettings.shipFromStreet,
                city: shippoSettings.shipFromCity,
                state: shippoSettings.shipFromState,
                zip: shippoSettings.shipFromZip,
                country: "US",
                email: shippoSettings.shipFromEmail || "",
                phone: shippoSettings.shipFromPhone || ""
            },
            address_to: {
                name: order.customerName,
                street1: street1,
                street2: street2,
                city: city,
                state: state,
                zip: zip,
                country: "US",
                email: order.customerEmail
            },
            parcels: [{
                length: shippoSettings.shippoDefaultLength || "12",
                width: shippoSettings.shippoDefaultWidth || "10",
                height: shippoSettings.shippoDefaultHeight || "3",
                distance_unit: "in",
                weight: shippoSettings.shippoDefaultWeight || "1",
                mass_unit: "lb"
            }],
            async: false
        };

        const shipmentResponse = await fetch('https://api.goshippo.com/shipments/', {
            method: 'POST',
            headers: {
                'Authorization': `ShippoToken ${shippoSettings.shippoApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(shipmentData)
        });

        if (!shipmentResponse.ok) {
            const errorData = await shipmentResponse.json();
            throw new Error(JSON.stringify(errorData));
        }

        const shipment = await shipmentResponse.json();

        const rates = shipment.rates || [];

        if (rates.length === 0) {
            throw new Error('No shipping rates available');
        }

        let selectedRate = null;
        const preferredService = shippoSettings.shippoDefaultService || 'usps_first';

        if (preferredService === 'usps_first') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.token === 'usps_first');
        } else if (preferredService === 'usps_priority') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.token === 'usps_priority');
        } else if (preferredService === 'usps_ground_advantage') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.name && r.servicelevel.name.toLowerCase().includes('ground'));
        }

        if (!selectedRate) {
            selectedRate = rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0];
        }

        const transactionData = {
            rate: selectedRate.object_id,
            label_file_type: "PDF",
            async: false
        };

        const transactionResponse = await fetch('https://api.goshippo.com/transactions/', {
            method: 'POST',
            headers: {
                'Authorization': `ShippoToken ${shippoSettings.shippoApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(transactionData)
        });

        if (!transactionResponse.ok) {
            const errorData = await transactionResponse.json();
            throw new Error(JSON.stringify(errorData));
        }

        const transaction = await transactionResponse.json();

        if (transaction.status !== 'SUCCESS') {
            const errorMsg = transaction.messages ? JSON.stringify(transaction.messages, null, 2) : 'Unknown error';
            throw new Error(`Label creation failed: ${errorMsg}`);
        }

        return {
            label_url: transaction.label_url,
            tracking_number: transaction.tracking_number,
            tracking_url: transaction.tracking_url_provider,
            carrier: selectedRate.provider,
            service: selectedRate.servicelevel.name,
            cost: selectedRate.amount,
            transaction_id: transaction.object_id
        };

    } catch (error) {
        console.error('Shippo label creation error:', error);
        return null;
    }
}

// Load inventory from Supabase (filtered by live drops only)
async function loadShopInventory() {
    const itemsGrid = document.getElementById('availableItems');

    try {
        // Fetch live drops with their product IDs
        const { data: liveDrops, error: dropsError } = await supabase
            .from('drops')
            .select('*, drop_items(product_id)')
            .eq('status', 'live');

        console.log('[Shop Debug] Live drops query:', { liveDrops, dropsError });

        if (dropsError) throw dropsError;

        if (!liveDrops || liveDrops.length === 0) {
            itemsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h3>No items available right now</h3>
                    <p>Check the upcoming drops below!</p>
                </div>
            `;
            return;
        }

        // Gather all product IDs from live drops
        const liveDropItemIds = liveDrops.flatMap(d => (d.drop_items || []).map(di => di.product_id));
        console.log('[Shop Debug] Product IDs from live drops:', liveDropItemIds);

        if (liveDropItemIds.length === 0) {
            itemsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h3>No items available right now</h3>
                    <p>Check the upcoming drops below!</p>
                </div>
            `;
            return;
        }

        // Fetch available products in live drops with images
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*, product_images(storage_path, display_order)')
            .in('id', liveDropItemIds)
            .eq('available', true)
            .order('created_at', { ascending: false });

        console.log('[Shop Debug] Products query:', { products, productsError });

        if (productsError) throw productsError;

        if (!products || products.length === 0) {
            itemsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <h3>No items available right now</h3>
                    <p>Check the upcoming drops below!</p>
                </div>
            `;
            return;
        }

        // Group items by drop for better display
        const groupedByDrop = {};
        products.forEach(product => {
            // Find which drop this product belongs to
            const drop = liveDrops.find(d =>
                (d.drop_items || []).some(di => di.product_id === product.id)
            );
            if (drop) {
                if (!groupedByDrop[drop.id]) {
                    groupedByDrop[drop.id] = { drop, items: [] };
                }
                groupedByDrop[drop.id].items.push(product);
            }
        });

        itemsGrid.innerHTML = '';

        Object.values(groupedByDrop).forEach(({ drop, items }) => {
            const dropHeader = document.createElement('div');
            dropHeader.className = 'drop-header';
            dropHeader.style.gridColumn = '1 / -1';
            dropHeader.innerHTML = `
                <h2 class="drop-name">${drop.name}</h2>
                ${drop.description ? `<p class="drop-description">${drop.description}</p>` : ''}
                <span class="live-badge">🔴 LIVE NOW</span>
            `;
            itemsGrid.appendChild(dropHeader);

            items.forEach(item => {
                const itemCard = document.createElement('div');
                itemCard.className = 'item-card';
                itemCard.dataset.itemId = item.id;

                itemCard.innerHTML = createItemCardHTML(item);
                itemsGrid.appendChild(itemCard);
            });
        });

        // Also update cachedDrops for countdown
        cachedDrops = liveDrops;
        cachedDropsTimestamp = Date.now();
    } catch (err) {
        console.error('Failed to load shop inventory:', err);
        itemsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3>Error loading inventory</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Helper function to create item card HTML
function createItemCardHTML(item) {
    // Images come from product_images table (Supabase Storage URLs)
    const images = (item.product_images || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(img => img.storage_path);
    const hasImages = images.length > 0;
    const price = parseFloat(item.price) || 0;

    return `
        <div class="item-image" style="position: relative;">
            ${hasImages ?
                `<div class="image-carousel" data-item-id="${item.id}">
                    ${images.map((img, idx) => `
                        <img src="${img}"
                             alt="${item.name}"
                             class="carousel-image ${idx === 0 ? 'active' : ''}"
                             style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;opacity:${idx === 0 ? 1 : 0};transition:opacity 0.3s;">
                    `).join('')}
                    ${images.length > 1 ? `
                        <button class="carousel-btn prev" onclick="prevImage(event, '${item.id}')" style="position:absolute;left:5px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;padding:0.5rem;cursor:pointer;border-radius:3px;">‹</button>
                        <button class="carousel-btn next" onclick="nextImage(event, '${item.id}')" style="position:absolute;right:5px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);color:white;border:none;padding:0.5rem;cursor:pointer;border-radius:3px;">›</button>
                        <div class="carousel-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:5px;">
                            ${images.map((_, idx) => `<span class="dot ${idx === 0 ? 'active' : ''}" style="width:8px;height:8px;background:${idx === 0 ? 'var(--orange)' : 'rgba(255,255,255,0.5)'};border-radius:50%;display:inline-block;"></span>`).join('')}
                        </div>
                    ` : ''}
                </div>` :
              `<span class="placeholder">${item.category || 'item'}</span>`}
        </div>
        <div class="item-details">
            <h3>${item.name}</h3>
            <p class="item-description">${(item.description || '').substring(0, 100)}${(item.description || '').length > 100 ? '...' : ''}</p>
            <p><small>Size: ${item.size || 'N/A'} | Condition: ${item.condition || 'N/A'}</small></p>
            <p class="item-price">$${price.toFixed(2)}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn-secondary" onclick="addToCart('${item.id}')" style="flex: 1;">Add to Cart</button>
                <button class="btn-primary" onclick="buyNow('${item.id}')" style="flex: 1;">Buy Now</button>
            </div>
        </div>
    `;
}

// Shopping Cart (stays in localStorage)
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

async function addToCart(itemId) {
    // Fetch product from Supabase to verify availability
    const { data: item, error } = await supabase
        .from('products')
        .select('*, product_images(storage_path, display_order)')
        .eq('id', itemId)
        .single();

    if (error || !item || !item.available) {
        alert('Sorry, this item is no longer available.');
        return;
    }

    if (cart.find(i => i.id === itemId)) {
        alert('This item is already in your cart!');
        return;
    }

    // Store a simplified version in cart
    const images = (item.product_images || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(img => img.storage_path);

    cart.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price) || 0,
        size: item.size,
        condition: item.condition,
        category: item.category,
        images: images
    });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    alert(`✓ "${item.name}" added to cart!`);
}

async function buyNow(itemId) {
    const { data: item, error } = await supabase
        .from('products')
        .select('*, product_images(storage_path, display_order)')
        .eq('id', itemId)
        .single();

    if (error || !item || !item.available) {
        alert('Sorry, this item is no longer available.');
        return;
    }

    if (!cart.find(i => i.id === itemId)) {
        const images = (item.product_images || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map(img => img.storage_path);

        cart.push({
            id: item.id,
            name: item.name,
            description: item.description,
            price: parseFloat(item.price) || 0,
            size: item.size,
            condition: item.condition,
            category: item.category,
            images: images
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
    }

    goToCheckout();
}

function removeFromCart(itemId) {
    cart = cart.filter(i => i.id !== itemId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    // Refresh the cart sidebar if it's open
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar) {
        closeCartModal();
        if (cart.length > 0) {
            setTimeout(() => showCartModal(), 310);
        }
    }
}

function viewCart() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    showCartModal();
}

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        const count = cart.length;
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

function showCartModal() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    const overlay = document.createElement('div');
    overlay.id = 'cartOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; opacity: 0; transition: opacity 0.3s;';
    overlay.onclick = closeCartModal;

    const sidebar = document.createElement('div');
    sidebar.id = 'cartSidebar';
    sidebar.style.cssText = `
        position: fixed;
        top: 0;
        right: -400px;
        width: 400px;
        max-width: 90vw;
        height: 100%;
        background: white;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
        z-index: 1000;
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
    `;

    sidebar.innerHTML = `
        <div style="padding: 1.5rem; border-bottom: 2px solid var(--light-beige); display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-family: 'Bebas Neue', cursive; color: var(--maroon); margin: 0; font-size: 2rem;">Your Cart</h2>
            <button onclick="closeCartModal()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: var(--maroon); line-height: 1;">&times;</button>
        </div>

        <div style="flex: 1; overflow-y: auto; padding: 1rem;">
            ${cart.length === 0 ? `
                <div style="text-align: center; padding: 3rem 1rem; color: #666;">
                    <p style="font-size: 3rem; margin: 0;">🛒</p>
                    <p style="margin: 1rem 0 0 0;">Your cart is empty</p>
                </div>
            ` : `
                ${cart.map(item => {
                    const firstImage = (item.images && item.images.length > 0) ? item.images[0] : null;
                    return `
                    <div style="display: flex; gap: 1rem; padding: 1rem; border-bottom: 1px solid #eee; position: relative;">
                        ${firstImage ? `<img src="${firstImage}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">` : ''}
                        <div style="flex: 1; min-width: 0;">
                            <strong style="display: block; margin-bottom: 0.25rem;">${item.name}</strong>
                            <p style="color: #666; font-size: 0.85rem; margin: 0.25rem 0;">Size: ${item.size || 'N/A'}</p>
                            <p style="color: var(--orange); font-weight: 600; margin: 0.5rem 0 0 0; font-size: 1.1rem;">$${item.price.toFixed(2)}</p>
                        </div>
                        <button onclick="removeFromCart('${item.id}')"
                                style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--danger); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; line-height: 1; display: flex; align-items: center; justify-content: center;"
                                title="Remove from cart">
                            ×
                        </button>
                    </div>
                `}).join('')}
            `}
        </div>

        ${cart.length > 0 ? `
            <div style="padding: 1.5rem; border-top: 2px solid var(--light-beige); background: var(--light-beige);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 1.3rem;">
                    <span style="font-weight: 600; color: var(--maroon);">Total:</span>
                    <span style="font-weight: bold; color: var(--orange);">$${total.toFixed(2)}</span>
                </div>
                <button onclick="goToCheckout();" style="width: 100%; background: var(--orange); color: white; padding: 1rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem; font-family: 'Bebas Neue', cursive; letter-spacing: 0.5px;">
                    Checkout (${cart.length} item${cart.length !== 1 ? 's' : ''})
                </button>
                <button onclick="closeCartModal()" style="width: 100%; background: transparent; color: var(--maroon); padding: 0.75rem; border: 2px solid var(--maroon); border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 0.5rem;">
                    Continue Shopping
                </button>
            </div>
        ` : ''}
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sidebar);

    setTimeout(() => {
        overlay.style.opacity = '1';
        sidebar.style.right = '0';
    }, 10);
}

function closeCartModal() {
    const overlay = document.getElementById('cartOverlay');
    const sidebar = document.getElementById('cartSidebar');

    if (sidebar) {
        sidebar.style.right = '-400px';
    }
    if (overlay) {
        overlay.style.opacity = '0';
    }

    setTimeout(() => {
        if (overlay) overlay.remove();
        if (sidebar) sidebar.remove();
    }, 300);
}

function goToCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    closeCartModal();

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('checkout').classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    loadCheckoutPage();
}

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51SkDyTBFU8xde1kAxw7d1Hc5v1chrPwXk2B0xYjcwRzblX8RpC8jNNzbR43G5NHQwe7UH7iaAJJyr0pDmkbUsA2S00WQc7oldI';
let stripe = null;

function initializeStripe() {
    if (typeof Stripe !== 'undefined' && STRIPE_PUBLISHABLE_KEY !== 'pk_test_YOUR_KEY_HERE') {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    }
}

function loadCheckoutPage() {
    const checkoutContent = document.getElementById('checkoutContent');
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const tax = total * 0.0575;
    const grandTotal = total + tax;

    checkoutContent.innerHTML = `
        <div class="checkout-grid">
            <!-- Order Summary -->
            <div class="checkout-summary">
                <h2>Order Summary</h2>

                ${cart.map(item => {
                    const firstImage = (item.images && item.images.length > 0) ? item.images[0] : null;
                    return `
                    <div class="checkout-item">
                        ${firstImage ? `<img src="${firstImage}" alt="${item.name}">` : ''}
                        <div class="checkout-item-details">
                            <strong style="display: block;">${item.name}</strong>
                            <small style="color: #666;">Size: ${item.size || 'N/A'}</small>
                        </div>
                        <span class="checkout-item-price">$${item.price.toFixed(2)}</span>
                    </div>
                `}).join('')}

                <div class="checkout-totals">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span>Tax (5.75%):</span>
                        <span>$${tax.toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span>Shipping:</span>
                        <span>FREE</span>
                    </div>
                    <div class="grand-total">
                        <span>Total:</span>
                        <span>$${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Payment Form -->
            <div class="checkout-payment">
                <h2>Payment Details</h2>

                <form id="payment-form" class="checkout-form">
                    <div class="checkout-field">
                        <label>Email *</label>
                        <input type="email" id="customer-email" required>
                    </div>

                    <div class="checkout-field">
                        <label>Full Name *</label>
                        <input type="text" id="customer-name" required>
                    </div>

                    <div class="checkout-field">
                        <label>Street Address *</label>
                        <input type="text" id="shipping-street" required autocomplete="off" placeholder="123 Main St">
                        <div id="address-suggestions" style="display: none; position: relative; z-index: 1000;"></div>
                    </div>

                    <div class="checkout-field">
                        <label>Apt, Suite, etc. (optional)</label>
                        <input type="text" id="shipping-apt" autocomplete="address-line2" placeholder="Apt 4, Unit B, etc.">
                    </div>

                    <div class="checkout-address-row">
                        <div class="checkout-field">
                            <label>City *</label>
                            <input type="text" id="shipping-city" required autocomplete="address-level2">
                        </div>
                        <div class="checkout-field">
                            <label>State *</label>
                            <select id="shipping-state" required autocomplete="address-level1">
                                <option value="">Select</option>
                                <option value="AL">AL</option><option value="AK">AK</option><option value="AZ">AZ</option><option value="AR">AR</option>
                                <option value="CA">CA</option><option value="CO">CO</option><option value="CT">CT</option><option value="DE">DE</option>
                                <option value="FL">FL</option><option value="GA">GA</option><option value="HI">HI</option><option value="ID">ID</option>
                                <option value="IL">IL</option><option value="IN">IN</option><option value="IA">IA</option><option value="KS">KS</option>
                                <option value="KY">KY</option><option value="LA">LA</option><option value="ME">ME</option><option value="MD">MD</option>
                                <option value="MA">MA</option><option value="MI">MI</option><option value="MN">MN</option><option value="MS">MS</option>
                                <option value="MO">MO</option><option value="MT">MT</option><option value="NE">NE</option><option value="NV">NV</option>
                                <option value="NH">NH</option><option value="NJ">NJ</option><option value="NM">NM</option><option value="NY">NY</option>
                                <option value="NC">NC</option><option value="ND">ND</option><option value="OH">OH</option><option value="OK">OK</option>
                                <option value="OR">OR</option><option value="PA">PA</option><option value="RI">RI</option><option value="SC">SC</option>
                                <option value="SD">SD</option><option value="TN">TN</option><option value="TX">TX</option><option value="UT">UT</option>
                                <option value="VT">VT</option><option value="VA" selected>VA</option><option value="WA">WA</option><option value="WV">WV</option>
                                <option value="WI">WI</option><option value="WY">WY</option><option value="DC">DC</option>
                            </select>
                        </div>
                        <div class="checkout-field">
                            <label>ZIP *</label>
                            <input type="text" id="shipping-zip" required autocomplete="postal-code" pattern="[0-9]{5}"
                                   maxlength="5" placeholder="22015">
                        </div>
                    </div>

                    <div class="checkout-field">
                        <label>Card Details *</label>
                        <div id="card-element"></div>
                        <div id="card-errors"></div>
                    </div>

                    <button type="submit" id="submit-button" class="checkout-submit">
                        Pay $${grandTotal.toFixed(2)}
                    </button>

                    <div class="checkout-secured">
                        <svg style="width: 16px; height: 16px; vertical-align: middle;" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                        </svg>
                        Secured by Stripe
                    </div>

                    <button type="button" onclick="backToShopping()" class="checkout-back">
                        ← Back to Shopping
                    </button>
                </form>
            </div>
        </div>
    `;

    setupStripeCheckout(grandTotal);

    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        initializeAddressAutocomplete();
    } else {
        const waitForGoogle = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                clearInterval(waitForGoogle);
                initializeAddressAutocomplete();
            }
        }, 100);

        setTimeout(() => {
            clearInterval(waitForGoogle);
            if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
                initializeAddressAutocomplete();
            }
        }, 5000);
    }
}

function setupStripeCheckout(amount) {
    initializeStripe();

    if (!stripe) {
        document.getElementById('card-element').innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #666;">
                <p style="margin-bottom: 1rem;"><strong>Stripe Not Configured</strong></p>
                <p style="font-size: 0.9rem;">To enable card payments, add your Stripe publishable key in script.js</p>
                <p style="font-size: 0.85rem; margin-top: 1rem;">Find your key at: <a href="https://dashboard.stripe.com/apikeys" target="_blank" style="color: var(--orange);">stripe.com/dashboard</a></p>
            </div>
        `;
        document.getElementById('submit-button').disabled = true;
        document.getElementById('submit-button').style.opacity = '0.5';
        document.getElementById('submit-button').textContent = 'Configure Stripe to Accept Payments';
        return;
    }

    const elements = stripe.elements();
    const cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#630031',
                '::placeholder': {
                    color: '#999',
                }
            },
            invalid: {
                color: '#dc3545',
            }
        }
    });

    cardElement.mount('#card-element');

    cardElement.on('change', function(event) {
        const displayError = document.getElementById('card-errors');
        if (event.error) {
            displayError.textContent = event.error.message;
        } else {
            displayError.textContent = '';
        }
    });

    const form = document.getElementById('payment-form');
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        try {
            // Step 1: Tokenize the card
            const {paymentMethod, error} = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement,
                billing_details: {
                    name: document.getElementById('customer-name').value,
                    email: document.getElementById('customer-email').value,
                }
            });

            if (error) {
                document.getElementById('card-errors').textContent = error.message;
                submitButton.disabled = false;
                submitButton.textContent = 'Pay $' + amount.toFixed(2);
                return;
            }

            // Step 2: Create PaymentIntent via worker
            const intentResponse = await fetch(`${WORKER_URL}/create-payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: amount })
            });

            const intentData = await intentResponse.json();

            if (!intentResponse.ok || !intentData.clientSecret) {
                throw new Error(intentData.error || 'Failed to create payment intent');
            }

            // Step 3: Confirm the payment (actually charges the card)
            const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(
                intentData.clientSecret,
                { payment_method: paymentMethod.id }
            );

            if (confirmError) {
                document.getElementById('card-errors').textContent = confirmError.message;
                submitButton.disabled = false;
                submitButton.textContent = 'Pay $' + amount.toFixed(2);
                return;
            }

            if (paymentIntent.status === 'succeeded') {
                // Step 4: Payment confirmed — save order to Supabase
                processPayment(paymentIntent.id, amount);
            } else {
                throw new Error('Payment was not completed. Status: ' + paymentIntent.status);
            }
        } catch (err) {
            document.getElementById('card-errors').textContent = err.message || 'Payment failed. Please try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'Pay $' + amount.toFixed(2);
        }
    });
}

// Google Places Autocomplete for address validation
function initializeAddressAutocomplete() {
    const streetInput = document.getElementById('shipping-street');
    if (!streetInput) return;

    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn('Google Places API not loaded. Address autocomplete disabled.');
        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
        helpText.innerHTML = '⚠️ Address autocomplete not available';
        streetInput.parentElement.appendChild(helpText);
        return;
    }

    try {
        const existingContainers = document.querySelectorAll('.pac-container');
        existingContainers.forEach(container => container.remove());

        const autocomplete = new google.maps.places.Autocomplete(streetInput, {
            types: ['address'],
            componentRestrictions: { country: 'us' },
            fields: ['address_components', 'formatted_address', 'geometry']
        });

        setTimeout(() => {
            const errorOverlay = document.querySelector('.dismissible-error-overlay, .gm-err-container');
            if (errorOverlay) {
                google.maps.event.clearInstanceListeners(streetInput);
                errorOverlay.remove();
                const helpText = document.createElement('small');
                helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
                helpText.innerHTML = '⚠️ Address autocomplete error - please type address manually.';
                streetInput.parentElement.appendChild(helpText);
                return;
            }
        }, 1000);

        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #28a745; font-size: 0.85rem;';
        helpText.innerHTML = '✓ Address suggestions enabled - start typing to see matches';
        streetInput.parentElement.appendChild(helpText);

        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();

            if (!place.address_components) return;

            let streetNumber = '';
            let route = '';
            let city = '';
            let state = '';
            let zip = '';

            for (const component of place.address_components) {
                const types = component.types;
                if (types.includes('street_number')) streetNumber = component.long_name;
                if (types.includes('route')) route = component.long_name;
                if (types.includes('locality')) city = component.long_name;
                if (types.includes('administrative_area_level_1')) state = component.short_name;
                if (types.includes('postal_code')) zip = component.long_name;
            }

            document.getElementById('shipping-street').value = `${streetNumber} ${route}`.trim();
            document.getElementById('shipping-city').value = city;
            document.getElementById('shipping-state').value = state;
            document.getElementById('shipping-zip').value = zip;
        });
    } catch (error) {
        console.error('Error initializing autocomplete:', error);
        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
        helpText.innerHTML = `⚠️ Error: ${error.message}`;
        streetInput.parentElement.appendChild(helpText);
    }
}

async function processPayment(paymentIntentId, amount) {
    const shippingStreet = document.getElementById('shipping-street').value;
    const shippingApt = document.getElementById('shipping-apt').value;
    const shippingCity = document.getElementById('shipping-city').value;
    const shippingState = document.getElementById('shipping-state').value;
    const shippingZip = document.getElementById('shipping-zip').value;

    const orderId = Date.now().toString();
    const customerName = document.getElementById('customer-name').value;
    const customerEmail = document.getElementById('customer-email').value;
    const fullAddress = `${shippingStreet}${shippingApt ? ', ' + shippingApt : ''}, ${shippingCity}, ${shippingState} ${shippingZip}`;

    // Build order for shipping label
    const orderForShipping = {
        customerName,
        customerEmail,
        shippingAddress: {
            street: shippingStreet,
            apt: shippingApt,
            city: shippingCity,
            state: shippingState,
            zip: shippingZip
        }
    };

    // Create shipping label via Shippo
    const shippingLabel = await createShippingLabel(orderForShipping);

    // Insert order into Supabase
    const { error: orderError } = await supabase
        .from('orders')
        .insert({
            id: orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            shipping_street: shippingStreet,
            shipping_apt: shippingApt,
            shipping_city: shippingCity,
            shipping_state: shippingState,
            shipping_zip: shippingZip,
            shipping_full_address: fullAddress,
            payment_method: 'stripe',
            payment_intent_id: paymentIntentId,
            total: amount,
            status: 'paid',
            shipping_label_url: shippingLabel ? shippingLabel.label_url : null,
            shipping_tracking_number: shippingLabel ? shippingLabel.tracking_number : null,
            shipping_tracking_url: shippingLabel ? shippingLabel.tracking_url : null,
            shipping_carrier: shippingLabel ? shippingLabel.carrier : null,
            shipping_service: shippingLabel ? shippingLabel.service : null,
            shipping_cost: shippingLabel ? parseFloat(shippingLabel.cost) : null,
            shipping_transaction_id: shippingLabel ? shippingLabel.transaction_id : null,
            shipping_created_at: shippingLabel ? new Date().toISOString() : null
        });

    if (orderError) {
        console.error('Failed to save order:', orderError);
        alert('Order processing error. Please contact support.');
        return;
    }

    // Insert order items
    const orderItems = cart.map(item => ({
        order_id: orderId,
        product_id: item.id,
        name: item.name,
        price: item.price
    }));

    await supabase.from('order_items').insert(orderItems);

    // Mark products as sold
    const purchasedIds = cart.map(item => item.id);
    await supabase
        .from('products')
        .update({ available: false })
        .in('id', purchasedIds);

    // Clear cart
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // Show success with shipping info
    const order = {
        id: orderId,
        customerEmail,
        shipping: shippingLabel ? {
            tracking_number: shippingLabel.tracking_number,
            tracking_url: shippingLabel.tracking_url,
            carrier: shippingLabel.carrier,
            service: shippingLabel.service
        } : null
    };
    showOrderConfirmation(order);
}

function showOrderConfirmation(order) {
    const checkoutContent = document.getElementById('checkoutContent');
    checkoutContent.innerHTML = `
        <div style="max-width: 600px; margin: 4rem auto; text-align: center;">
            <div style="background: var(--light-beige); padding: 3rem; border-radius: 16px; border: 3px solid var(--success);">
                <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                <h2 style="font-family: 'Bebas Neue', cursive; color: var(--maroon); font-size: 2.5rem; margin-bottom: 1rem;">Order Confirmed!</h2>
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Thank you for your purchase!</p>
                <p style="color: #666; margin-bottom: 2rem;">Order #${order.id.substring(0, 8)}</p>

                <div style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                    <p style="margin-bottom: 0.5rem;"><strong>Confirmation email sent to:</strong></p>
                    <p style="color: var(--orange); font-weight: 600;">${order.customerEmail}</p>
                </div>

                ${order.shipping && order.shipping.tracking_number ? `
                    <div style="background: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; border: 2px solid var(--success);">
                        <p style="font-size: 1.2rem; font-weight: 600; color: var(--maroon); margin-bottom: 1rem;">📦 Shipping Label Created!</p>
                        <div style="background: var(--light-beige); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                            <p style="margin-bottom: 0.5rem; color: #666; font-size: 0.9rem;">Tracking Number:</p>
                            <p style="font-size: 1.2rem; font-weight: 600; color: var(--orange); font-family: monospace;">${order.shipping.tracking_number}</p>
                        </div>
                        <p style="margin-bottom: 0.5rem; color: #666; font-size: 0.9rem;">Carrier: <strong>${order.shipping.carrier.toUpperCase()}</strong> - ${order.shipping.service}</p>
                        ${order.shipping.tracking_url ? `
                            <a href="${order.shipping.tracking_url}" target="_blank"
                               style="display: inline-block; margin-top: 1rem; color: var(--orange); font-weight: 600; text-decoration: none; border-bottom: 2px solid var(--orange);">
                                Track Your Package →
                            </a>
                        ` : ''}
                    </div>
                ` : `
                    <p style="color: #666; margin-bottom: 2rem;">We'll ship your items within 2-3 business days!</p>
                `}

                <button onclick="backToShopping()"
                        style="background: var(--orange); color: white; padding: 1rem 2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem; font-family: 'Bebas Neue', cursive;">
                    Continue Shopping
                </button>
            </div>
        </div>
    `;

    loadShopInventory();
}

function backToShopping() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('shop').classList.add('active');

    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.querySelector('.nav-links a[href="#shop"]').classList.add('active');

    loadShopInventory();
}

function showCheckoutModal() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'checkoutModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="closeCheckout()">&times;</span>
            <h2 style="font-family: 'Bebas Neue', cursive; color: var(--maroon); margin-bottom: 1.5rem;">Checkout</h2>

            <div style="margin-bottom: 2rem;">
                <h3 style="margin-bottom: 1rem;">Your Items:</h3>
                ${cart.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #eee;">
                        <span>${item.name}</span>
                        <span>$${item.price.toFixed(2)}</span>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; padding: 1rem 0; font-weight: bold; font-size: 1.2rem;">
                    <span>Total:</span>
                    <span>$${total.toFixed(2)}</span>
                </div>
            </div>

            <form id="checkoutForm" style="margin-top: 2rem;">
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Full Name *</label>
                    <input type="text" id="customerName" required style="width: 100%; padding: 0.75rem; border: 2px solid #E8D5C4; border-radius: 8px;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Email *</label>
                    <input type="email" id="customerEmail" required style="width: 100%; padding: 0.75rem; border: 2px solid #E8D5C4; border-radius: 8px;">
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Shipping Address *</label>
                    <textarea id="shippingAddress" required rows="3" style="width: 100%; padding: 0.75rem; border: 2px solid #E8D5C4; border-radius: 8px;"></textarea>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Payment Method</label>
                    <select id="paymentMethod" style="width: 100%; padding: 0.75rem; border: 2px solid #E8D5C4; border-radius: 8px;">
                        <option value="venmo">Venmo</option>
                        <option value="cashapp">Cash App</option>
                        <option value="paypal">PayPal</option>
                    </select>
                    <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">After placing your order, we'll send payment instructions via email.</p>
                </div>

                <button type="submit" style="width: 100%; background: #E87722; color: white; padding: 1rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.1rem;">
                    Place Order
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('checkoutForm').addEventListener('submit', function(e) {
        e.preventDefault();
        completeOrder();
    });
}

function closeCheckout() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.remove();
    }
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

async function completeOrder() {
    const orderId = Date.now().toString();
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const shippingAddress = document.getElementById('shippingAddress').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const total = cart.reduce((sum, item) => sum + item.price, 0);

    // Insert order into Supabase
    const { error: orderError } = await supabase
        .from('orders')
        .insert({
            id: orderId,
            customer_name: customerName,
            customer_email: customerEmail,
            shipping_full_address: shippingAddress,
            payment_method: paymentMethod,
            total: total,
            status: 'pending'
        });

    if (orderError) {
        console.error('Failed to save order:', orderError);
        alert('Order processing error. Please try again.');
        return;
    }

    // Insert order items
    const orderItems = cart.map(item => ({
        order_id: orderId,
        product_id: item.id,
        name: item.name,
        price: item.price
    }));

    await supabase.from('order_items').insert(orderItems);

    // Mark products as sold
    const purchasedIds = cart.map(item => item.id);
    await supabase
        .from('products')
        .update({ available: false })
        .in('id', purchasedIds);

    // Show confirmation
    alert(`Order placed successfully! Order #${orderId.substring(0, 8)}\n\nWe'll send payment instructions to ${customerEmail}`);

    closeCheckout();
    loadShopInventory();
}

// Load syndicated listings from Supabase
async function loadSyndicatedListingsToFrontend() {
    try {
        const { data: listings, error } = await supabase
            .from('syndicated_listings')
            .select('*')
            .eq('active', true);

        if (error) throw error;

        if (!listings || listings.length === 0) {
            return [];
        }

        return listings.map(listing => ({
            title: listing.title,
            platform: listing.platform,
            price: listing.price,
            link: listing.link,
            image: listing.image_url
        }));
    } catch (err) {
        console.error('Failed to load syndicated listings:', err);
        return [];
    }
}

// Image Carousel Functions
let currentImageIndex = {};

function nextImage(event, itemId) {
    event.stopPropagation();
    const carousel = document.querySelector(`.image-carousel[data-item-id="${itemId}"]`);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.carousel-image');
    const dots = carousel.querySelectorAll('.dot');

    if (!currentImageIndex[itemId]) currentImageIndex[itemId] = 0;

    images[currentImageIndex[itemId]].style.opacity = '0';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'rgba(255,255,255,0.5)';
    }

    currentImageIndex[itemId] = (currentImageIndex[itemId] + 1) % images.length;

    images[currentImageIndex[itemId]].style.opacity = '1';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'var(--orange)';
    }
}

function prevImage(event, itemId) {
    event.stopPropagation();
    const carousel = document.querySelector(`.image-carousel[data-item-id="${itemId}"]`);
    if (!carousel) return;

    const images = carousel.querySelectorAll('.carousel-image');
    const dots = carousel.querySelectorAll('.dot');

    if (!currentImageIndex[itemId]) currentImageIndex[itemId] = 0;

    images[currentImageIndex[itemId]].style.opacity = '0';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'rgba(255,255,255,0.5)';
    }

    currentImageIndex[itemId] = (currentImageIndex[itemId] - 1 + images.length) % images.length;

    images[currentImageIndex[itemId]].style.opacity = '1';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'var(--orange)';
    }
}

// Load shop inventory when page loads
window.addEventListener('load', function() {
    loadShopInventory();
});

// Add smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href.length > 1) {
            e.preventDefault();
        }
    });
});
