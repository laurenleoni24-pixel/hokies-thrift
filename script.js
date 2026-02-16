// Navigation and page switching
document.addEventListener('DOMContentLoaded', function() {
    // Clean up storage on load to prevent quota issues
    cleanupStorage();

    initNavigation();
    initCountdown();
    initShopTabs();
    initNavigationCards();
    initSellerForm();
    initMobileMenu();
    updateCartCount(); // Update cart count on page load
    loadHokiesEvents(); // Load Hokies events on home page
});

// Clean up old/large data to prevent storage quota issues
function cleanupStorage() {
    try {
        // Remove old seller submissions that are no longer needed (keep only pending_admin status)
        const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
        const recentSubmissions = submissions.filter(s => s.status === 'pending_admin' || s.status === 'pending_seller');

        // Only keep recent submissions (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const cleanedSubmissions = recentSubmissions.filter(s => {
            const submissionDate = new Date(s.date);
            return submissionDate > thirtyDaysAgo;
        });

        if (cleanedSubmissions.length < submissions.length) {
            localStorage.setItem('sellerSubmissions', JSON.stringify(cleanedSubmissions));
            console.log(`Cleaned up ${submissions.length - cleanedSubmissions.length} old submissions`);
        }
    } catch (error) {
        console.error('Storage cleanup error:', error);
    }
}

// Navigation between pages
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);

            // Update active states
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Show target page
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Load eBay listings when browse page is activated
            if (targetId === 'browse') {
                loadEbayListings();
            }

            // Close mobile menu if open
            document.getElementById('navLinks').classList.remove('active');

            // Scroll to top
            window.scrollTo(0, 0);
        });
    });

    // Handle quick links
    const quickLinks = document.querySelectorAll('.quick-link');
    quickLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);

            // Update nav
            navLinks.forEach(l => l.classList.remove('active'));
            const targetNav = document.querySelector(`.nav-links a[href="#${targetId}"]`);
            if (targetNav) targetNav.classList.add('active');

            // Show page
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // Load eBay listings when browse page is activated
            if (targetId === 'browse') {
                loadEbayListings();
            }

            window.scrollTo(0, 0);
        });
    });
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
function initCountdown() {
    updateUpcomingDrops();
    setInterval(updateUpcomingDrops, 1000);
}

function updateUpcomingDrops() {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const scheduledDrops = drops
        .filter(d => d.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
        .slice(0, 3); // Show up to 3 upcoming drops

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
        const target = new Date(drop.scheduledDate).getTime();
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
                <p class="drop-date">${new Date(drop.scheduledDate).toLocaleString()}</p>
            </div>
        `;
    }).join('');
}

// Load and display Hokies Events on home page
function loadHokiesEvents() {
    const events = JSON.parse(localStorage.getItem('hokiesEvents') || '[]');
    const container = document.getElementById('hokiesEventsContainer');

    if (!container) return;

    // Filter to only show future events and sort by date
    const now = new Date();
    const upcomingEvents = events
        .filter(event => new Date(event.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 6); // Show up to 6 upcoming events

    if (upcomingEvents.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                <p>No upcoming Hokies events scheduled</p>
                <p style="opacity: 0.8;">Check back soon for event updates!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = upcomingEvents.map(event => {
        const eventDate = new Date(event.date);
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
}

// Shop Tabs
function initShopTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Load shop inventory on initial page load
    loadShopInventory();

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');

            // Load content when tabs are selected
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
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const shopTab = this.getAttribute('data-shop-tab');

            // Update nav links
            navLinks.forEach(l => l.classList.remove('active'));
            const targetNav = document.querySelector(`.nav-links a[href="#${targetId}"]`);
            if (targetNav) targetNav.classList.add('active');

            // Show target page
            pages.forEach(page => page.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            // If navigating to shop with a specific tab
            if (targetId === 'shop' && shopTab) {
                // Switch to the correct shop tab
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

                // Load the appropriate content
                if (shopTab === 'upcoming') {
                    loadUpcomingDropsPreview();
                } else if (shopTab === 'available') {
                    loadShopInventory();
                }
            }

            // Load eBay listings when browse page is activated
            if (targetId === 'browse') {
                loadEbayListings();
            }

            // Scroll to top
            window.scrollTo(0, 0);
        });
    });
}

// Load upcoming drops preview for the "Upcoming Drops" tab
function loadUpcomingDropsPreview() {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    const scheduledDrops = drops
        .filter(d => d.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

    const container = document.getElementById('upcomingDropsPreview');

    if (!container) return;

    if (scheduledDrops.length === 0) {
        container.innerHTML = `
            <div class="upcoming-info" style="text-align: center; padding: 3rem;">
                <h2>No upcoming drops scheduled yet</h2>
                <p>Follow us on Instagram to get notified when we announce new drops!</p>
                <a href="https://www.instagram.com/hokiesthrift/?hl=en" target="_blank" class="btn-primary">Follow on Instagram</a>
            </div>
        `;
        return;
    }

    container.innerHTML = scheduledDrops.map(drop => {
        const dropItems = inventory.filter(item => drop.itemIds.includes(item.id));
        const sampleImages = dropItems.slice(0, 4).map(item => {
            const images = item.images || [];
            return images.length > 0 ? images[0] : null;
        }).filter(img => img !== null);

        const now = new Date().getTime();
        const target = new Date(drop.scheduledDate).getTime();
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
                    <p class="drop-stats">${drop.itemIds.length} items dropping in ${days > 0 ? days + ' days' : hours + ' hours'}</p>
                    <p class="drop-schedule"><strong>Drops:</strong> ${new Date(drop.scheduledDate).toLocaleString()}</p>
                </div>
            </div>
        `;
    }).join('');
}

// Seller Form with Price Estimation
function initSellerForm() {
    const form = document.getElementById('sellerForm');
    const itemType = document.getElementById('itemType');
    const itemCondition = document.getElementById('itemCondition');
    const itemEra = document.getElementById('itemEra');
    const estimateAmount = document.getElementById('estimateAmount');
    const itemPhotos = document.getElementById('itemPhotos');

    // Check if all required elements exist
    if (!form || !itemType || !itemCondition || !itemEra || !estimateAmount || !itemPhotos) {
        console.error('Seller form elements not found');
        return;
    }

    // Handle photo preview
    let sellerUploadedPhotos = [];
    itemPhotos.addEventListener('change', function(e) {
        const files = e.target.files;
        const preview = document.getElementById('sellerPhotoPreview');
        if (!preview) {
            console.error('Photo preview element not found');
            return;
        }
        preview.innerHTML = '';
        sellerUploadedPhotos = [];

        if (files.length > 5) {
            alert('Maximum 5 photos allowed. Only first 5 will be used.');
        }

        const fileArray = Array.from(files).slice(0, 5);
        let loadedCount = 0;

        fileArray.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(event) {
                // Compress the image before storing
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Resize to max 600px width/height while maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    const maxSize = 600;

                    if (width > height && width > maxSize) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else if (height > maxSize) {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG at 0.3 quality for smaller file size
                    const compressedData = canvas.toDataURL('image/jpeg', 0.3);
                    sellerUploadedPhotos.push(compressedData);

                    // Show preview
                    const imgContainer = document.createElement('div');
                    imgContainer.style.cssText = 'position: relative; display: inline-block;';

                    const previewImg = document.createElement('img');
                    previewImg.src = compressedData;
                    previewImg.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid var(--gray-300);';

                    imgContainer.appendChild(previewImg);
                    preview.appendChild(imgContainer);

                    loadedCount++;
                };
                img.src = event.target.result;
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

        // Base prices by type
        const basePrices = {
            'hoodie': { min: 25, max: 45 },
            'jacket': { min: 40, max: 90 },
            'tshirt': { min: 15, max: 35 },
            'jersey': { min: 30, max: 70 },
            'hat': { min: 10, max: 25 },
            'other': { min: 15, max: 40 }
        };

        // Condition multipliers
        const conditionMultipliers = {
            'excellent': 1.0,
            'good': 0.8,
            'fair': 0.6,
            'poor': 0.4
        };

        // Era bonus
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

        let minPrice = Math.round((base.min * multiplier + bonus) * 0.6); // 60% payout
        let maxPrice = Math.round((base.max * multiplier + bonus) * 0.6);

        estimateAmount.textContent = `$${minPrice} - $${maxPrice}`;
    }

    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        console.log('Form submitted, photos count:', sellerUploadedPhotos.length);

        try {
            // Validate photos
            if (sellerUploadedPhotos.length === 0) {
                alert('Please upload at least one photo of your item');
                return;
            }

            // Get the current estimate
            const estimateText = document.getElementById('estimateAmount').textContent;

            // Create submission object
            const submission = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                name: document.getElementById('sellerName').value,
                email: document.getElementById('sellerEmail').value,
                phone: document.getElementById('sellerPhone').value || '',
                itemType: itemType.value,
                description: document.getElementById('itemDescription').value,
                condition: itemCondition.value,
                era: itemEra.value || '',
                estimate: estimateText,
                photos: sellerUploadedPhotos,  // Add photos to submission
                status: 'pending_admin',  // pending_admin → pending_seller → approved → rejected
                adminPrice: null,
                adminNotes: null,
                reviewedAt: null,
                sellerApprovedAt: null
            };

            // Save to localStorage for admin backend
            const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
            submissions.push(submission);

            try {
                localStorage.setItem('sellerSubmissions', JSON.stringify(submissions));
                console.log('Submission saved:', submission);
            } catch (storageError) {
                if (storageError.name === 'QuotaExceededError') {
                    alert('Storage limit reached. Your browser\'s storage is full.\n\nPlease:\n1. Try refreshing this page and submitting again\n2. Or use smaller photo files\n3. Or contact us directly to submit your item');
                } else {
                    throw storageError; // Re-throw if it's a different error
                }
                return;
            }

            // Show success message
            form.style.display = 'none';
            document.getElementById('estimateResult').style.display = 'none';
            document.getElementById('submissionSuccess').style.display = 'block';
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred while submitting your item. Please try again.');
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

// Marketplace Search
// ==============================
// EBAY INTEGRATION
// ==============================

// Cache for eBay listings to reduce API calls
let ebayListingsCache = {
    data: null,
    timestamp: null,
    cacheDuration: 15 * 60 * 1000 // 15 minutes
};

/**
 * Load eBay listings when browse page is activated
 */
async function loadEbayListings() {
    const grid = document.getElementById('ebayListingsGrid');
    const settings = JSON.parse(localStorage.getItem('ebaySettings') || '{}');

    // Check if eBay is configured
    if (!settings.proxyUrl || !settings.ebaySellerUsername) {
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
        console.log('Using cached eBay listings');
        renderEbayListings(ebayListingsCache.data);
        return;
    }

    // Show loading state
    grid.innerHTML = '<div class="ebay-loading">⏳ Loading eBay listings...</div>';

    try {
        // Fetch listings from proxy
        const listingsUrl = `${settings.proxyUrl.replace(/\/$/, '')}/listings?seller=${encodeURIComponent(settings.ebaySellerUsername)}&limit=200`;
        const response = await fetch(listingsUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch listings: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Cache the results
        ebayListingsCache.data = data;
        ebayListingsCache.timestamp = Date.now();

        // Render listings
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

/**
 * Render eBay listings to the grid
 */
function renderEbayListings(data) {
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

    const settings = JSON.parse(localStorage.getItem('ebaySettings') || '{}');

    // Filter by approved items only (if curation is enabled)
    const approvedItems = JSON.parse(localStorage.getItem('ebayApprovedItems') || '[]');
    let itemsToDisplay = data.items;

    // If there are approved items, only show those
    if (approvedItems.length > 0) {
        itemsToDisplay = data.items.filter(item => approvedItems.includes(item.itemId));
    }

    // Check if filtered list is empty
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

    console.log(`Rendered ${itemsToDisplay.length} approved eBay listings (${data.items.length} total available)`);
}

/**
 * Build affiliate link with EPN tracking
 */
function buildAffiliateLink(itemUrl, campaignId) {
    if (!itemUrl || !campaignId) {
        return itemUrl;
    }

    const params = new URLSearchParams({
        mkevt: '1',
        mkcid: '1',
        mkrid: '711-53200-19255-0', // eBay US rotation ID
        campid: campaignId,
        toolid: '10001'
    });

    return `${itemUrl}&${params.toString()}`;
}

/**
 * Refresh eBay listings (clear cache and reload)
 */
function refreshEbayListings() {
    ebayListingsCache.data = null;
    ebayListingsCache.timestamp = null;
    loadEbayListings();
}

/**
 * Sort eBay listings by price or date
 */
function sortEbayListings(sortBy) {
    const data = ebayListingsCache.data;

    if (!data || !data.items) {
        return;
    }

    const items = [...data.items]; // Create a copy

    switch (sortBy) {
        case 'price-low':
            items.sort((a, b) => parseFloat(a.price.value) - parseFloat(b.price.value));
            break;
        case 'price-high':
            items.sort((a, b) => parseFloat(b.price.value) - parseFloat(a.price.value));
            break;
        case 'recent':
        default:
            // eBay API returns recent first by default, so no sorting needed
            break;
    }

    // Re-render with sorted items
    renderEbayListings({ ...data, items });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==============================
// SHIPPO SHIPPING INTEGRATION
// ==============================

/**
 * Create shipping label via Shippo API
 * @param {Object} order - Order details including customer shipping info
 * @returns {Promise<Object>} Shipment object with label_url and tracking_number
 */
async function createShippingLabel(order) {
    const shippoSettings = JSON.parse(localStorage.getItem('shippoSettings') || '{}');

    console.log('📋 Shippo settings loaded:', {
        hasApiKey: !!shippoSettings.shippoApiKey,
        apiKeyPrefix: shippoSettings.shippoApiKey ? shippoSettings.shippoApiKey.substring(0, 15) + '...' : 'NOT SET',
        shipFrom: shippoSettings.shipFromCity ? `${shippoSettings.shipFromCity}, ${shippoSettings.shipFromState}` : 'NOT SET',
        email: shippoSettings.shipFromEmail || 'NOT SET',
        phone: shippoSettings.shipFromPhone || 'NOT SET',
        defaultService: shippoSettings.shippoDefaultService || 'usps_first'
    });

    if (!shippoSettings.shippoApiKey) {
        console.error('❌ Shippo API key not configured');
        return null;
    }

    try {
        // Get shipping address from order (now structured as object)
        const address = order.shippingAddress;
        const street1 = address.street;
        const street2 = address.apt || '';
        const city = address.city;
        const state = address.state;
        const zip = address.zip;

        console.log('📦 Creating shipping label for:', {
            customer: order.customerName,
            address: `${street1}${street2 ? ', ' + street2 : ''}, ${city}, ${state} ${zip}`
        });

        // Step 1: Create shipment
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

        console.log('Creating Shippo shipment...', shipmentData);

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
        console.log('✅ Shipment created:', shipment);

        // Step 2: Get rates and select cheapest one
        const rates = shipment.rates || [];

        console.log(`Found ${rates.length} shipping rates:`, rates);

        if (rates.length === 0) {
            console.error('❌ No shipping rates returned. Shipment:', shipment);
            throw new Error('No shipping rates available');
        }

        // Filter by service level if specified
        let selectedRate = null;
        const preferredService = shippoSettings.shippoDefaultService || 'usps_first';

        if (preferredService === 'usps_first') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.token === 'usps_first');
        } else if (preferredService === 'usps_priority') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.token === 'usps_priority');
        } else if (preferredService === 'usps_ground_advantage') {
            selectedRate = rates.find(r => r.servicelevel && r.servicelevel.name && r.servicelevel.name.toLowerCase().includes('ground'));
        }

        // Fallback to cheapest rate
        if (!selectedRate) {
            selectedRate = rates.sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0];
        }

        console.log('✅ Selected rate:', {
            provider: selectedRate.provider,
            service: selectedRate.servicelevel.name,
            amount: selectedRate.amount,
            currency: selectedRate.currency
        });

        // Step 3: Purchase label
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
        console.log('Label created:', transaction);

        if (transaction.status !== 'SUCCESS') {
            const errorMsg = transaction.messages ? JSON.stringify(transaction.messages, null, 2) : 'Unknown error';
            console.error('❌ Shippo Transaction Failed:', transaction);
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
        console.error('❌ Shippo label creation error:', error);
        console.error('Error details:', error.message);

        // Try to parse and show more details if it's a JSON error
        try {
            const errorObj = JSON.parse(error.message);
            console.error('Parsed error:', errorObj);
        } catch (e) {
            // Not JSON, just a regular error
        }

        return null;
    }
}

// Load inventory from admin backend (filtered by live drops only)
function loadShopInventory() {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');

    // Get all live drops
    const liveDrops = drops.filter(d => d.status === 'live');
    const liveDropItemIds = liveDrops.flatMap(d => d.itemIds);

    // Filter items: must be available AND in a live drop
    const availableItems = inventory.filter(item =>
        item.available && liveDropItemIds.includes(item.id)
    );

    const itemsGrid = document.getElementById('availableItems');

    if (availableItems.length === 0) {
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
    availableItems.forEach(item => {
        const dropId = item.dropId;
        if (!groupedByDrop[dropId]) {
            groupedByDrop[dropId] = [];
        }
        groupedByDrop[dropId].push(item);
    });

    itemsGrid.innerHTML = '';

    // Render items grouped by drop
    Object.entries(groupedByDrop).forEach(([dropId, items]) => {
        const drop = liveDrops.find(d => d.id === dropId);

        // Add drop header
        const dropHeader = document.createElement('div');
        dropHeader.className = 'drop-header';
        dropHeader.style.gridColumn = '1 / -1';
        dropHeader.innerHTML = `
            <h2 class="drop-name">${drop.name}</h2>
            ${drop.description ? `<p class="drop-description">${drop.description}</p>` : ''}
            <span class="live-badge">🔴 LIVE NOW</span>
        `;
        itemsGrid.appendChild(dropHeader);

        // Add items
        items.forEach(item => {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';
            itemCard.dataset.itemId = item.id;

            itemCard.innerHTML = createItemCardHTML(item);
            itemsGrid.appendChild(itemCard);
        });
    });
}

// Helper function to create item card HTML
function createItemCardHTML(item) {
    const images = item.images || (item.image ? [item.image] : []);
    const hasImages = images.length > 0;

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
              `<span class="placeholder">${item.category}</span>`}
        </div>
        <div class="item-details">
            <h3>${item.name}</h3>
            <p class="item-description">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</p>
            <p><small>Size: ${item.size || 'N/A'} | Condition: ${item.condition}</small></p>
            <p class="item-price">$${item.price.toFixed(2)}</p>
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                <button class="btn-secondary" onclick="addToCart('${item.id}')" style="flex: 1;">Add to Cart</button>
                <button class="btn-primary" onclick="buyNow('${item.id}')" style="flex: 1;">Buy Now</button>
            </div>
        </div>
    `;
}

// Original version (for backward compatibility) - kept for syndicated listings
function loadShopInventoryOld() {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const availableItems = inventory.filter(item => item.available);
    const itemsGrid = document.getElementById('availableItems');

    if (availableItems.length === 0) {
        itemsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3>No items available right now</h3>
                <p>Check back soon for new drops!</p>
            </div>
        `;
        return;
    }

    itemsGrid.innerHTML = availableItems.map(item => {
        // Handle both old (single image) and new (multiple images) format
        const images = item.images || (item.image ? [item.image] : []);
        const hasImages = images.length > 0;

        return `
        <div class="item-card" data-item-id="${item.id}">
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
                  `<span class="placeholder">${item.category}</span>`}
            </div>
            <div class="item-details">
                <h3>${item.name}</h3>
                <p class="item-description">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</p>
                <p><small>Size: ${item.size || 'N/A'} | Condition: ${item.condition}</small></p>
                <p class="item-price">$${item.price.toFixed(2)}</p>
                <button class="btn-primary" onclick="purchaseItem('${item.id}')">Purchase</button>
            </div>
        </div>
        `;
    }).join('');
}

// Shopping Cart
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

function addToCart(itemId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === itemId);

    if (!item || !item.available) {
        alert('Sorry, this item is no longer available.');
        return;
    }

    // Check if item already in cart
    if (cart.find(i => i.id === itemId)) {
        alert('This item is already in your cart!');
        return;
    }

    // Add to cart
    cart.push(item);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // Show success message
    alert(`✓ "${item.name}" added to cart!`);
}

function buyNow(itemId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === itemId);

    if (!item || !item.available) {
        alert('Sorry, this item is no longer available.');
        return;
    }

    // Check if item already in cart
    if (!cart.find(i => i.id === itemId)) {
        cart.push(item);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
    }

    // Go to checkout page immediately
    goToCheckout();
}

function removeFromCart(itemId) {
    cart = cart.filter(i => i.id !== itemId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
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

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'cartOverlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; opacity: 0; transition: opacity 0.3s;';
    overlay.onclick = closeCartModal;

    // Create sidebar
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
                        <button onclick="removeFromCart('${item.id}'); closeCartModal(); viewCart();"
                                style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--danger); color: white; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; line-height: 1; display: flex; align-items: center; justify-content: center;">
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

    // Trigger animation
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

    // Navigate to checkout page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('checkout').classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

    // Load checkout content
    loadCheckoutPage();
}

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SkDzEPi2IQrE6IGuAOxp2dU7dFUFeDPT7VMBG7A3NwMi93mmzzpSMmeGZ65CZjnc2m7yQHDUYspXamuqgvZ2SVh00qoAJF0hT';
let stripe = null;

function initializeStripe() {
    if (typeof Stripe !== 'undefined' && STRIPE_PUBLISHABLE_KEY !== 'pk_test_YOUR_KEY_HERE') {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    }
}

function loadCheckoutPage() {
    const checkoutContent = document.getElementById('checkoutContent');
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    const tax = total * 0.0575; // 5.75% VA sales tax
    const grandTotal = total + tax;

    checkoutContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
            <!-- Order Summary -->
            <div style="background: var(--light-beige); padding: 2rem; border-radius: 12px;">
                <h2 style="font-family: 'Bebas Neue', cursive; color: var(--maroon); margin-bottom: 1.5rem; font-size: 2rem;">Order Summary</h2>

                ${cart.map(item => {
                    const firstImage = (item.images && item.images.length > 0) ? item.images[0] : null;
                    return `
                    <div style="display: flex; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid rgba(99, 0, 49, 0.1);">
                        ${firstImage ? `<img src="${firstImage}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : ''}
                        <div style="flex: 1;">
                            <strong style="display: block;">${item.name}</strong>
                            <small style="color: #666;">Size: ${item.size || 'N/A'}</small>
                        </div>
                        <span style="font-weight: 600; color: var(--orange);">$${item.price.toFixed(2)}</span>
                    </div>
                `}).join('')}

                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid var(--maroon);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Subtotal:</span>
                        <span>$${total.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Tax (5.75%):</span>
                        <span>$${tax.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span>Shipping:</span>
                        <span>FREE</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.3rem; font-weight: bold; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(99, 0, 49, 0.2);">
                        <span style="color: var(--maroon);">Total:</span>
                        <span style="color: var(--orange);">$${grandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Payment Form -->
            <div>
                <h2 style="font-family: 'Bebas Neue', cursive; color: var(--maroon); margin-bottom: 1.5rem; font-size: 2rem;">Payment Details</h2>

                <form id="payment-form" style="background: white; padding: 2rem; border-radius: 12px; border: 2px solid var(--light-beige);">
                    <!-- Contact Info -->
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">Email *</label>
                        <input type="email" id="customer-email" required
                               style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;">
                    </div>

                    <!-- Shipping Address -->
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">Full Name *</label>
                        <input type="text" id="customer-name" required
                               style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;">
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">Street Address *</label>
                        <input type="text" id="shipping-street" required autocomplete="off"
                               style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;"
                               placeholder="123 Main St">
                        <div id="address-suggestions" style="display: none; position: relative; z-index: 1000;"></div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">Apartment, Suite, etc. (optional)</label>
                        <input type="text" id="shipping-apt" autocomplete="address-line2"
                               style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;"
                               placeholder="Apt 4, Unit B, etc.">
                    </div>

                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">City *</label>
                            <input type="text" id="shipping-city" required autocomplete="address-level2"
                                   style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">State *</label>
                            <select id="shipping-state" required autocomplete="address-level1"
                                    style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;">
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
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">ZIP *</label>
                            <input type="text" id="shipping-zip" required autocomplete="postal-code" pattern="[0-9]{5}"
                                   maxlength="5"
                                   style="width: 100%; padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; font-size: 1rem;"
                                   placeholder="22015">
                        </div>
                    </div>

                    <!-- Stripe Card Element -->
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--maroon);">Card Details *</label>
                        <div id="card-element" style="padding: 0.75rem; border: 2px solid var(--light-beige); border-radius: 8px; background: white;">
                            <!-- Stripe Card Element will be inserted here -->
                        </div>
                        <div id="card-errors" style="color: var(--danger); margin-top: 0.5rem; font-size: 0.9rem;"></div>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" id="submit-button"
                            style="width: 100%; background: var(--orange); color: white; padding: 1.2rem; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1.2rem; font-family: 'Bebas Neue', cursive; letter-spacing: 1px;">
                        Pay $${grandTotal.toFixed(2)}
                    </button>

                    <div style="text-align: center; margin-top: 1rem;">
                        <small style="color: #666;">
                            <svg style="width: 16px; height: 16px; vertical-align: middle;" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                            </svg>
                            Secured by Stripe
                        </small>
                    </div>

                    <div style="text-align: center; margin-top: 0.5rem;">
                        <button type="button" onclick="backToShopping()"
                                style="background: none; border: none; color: var(--maroon); text-decoration: underline; cursor: pointer;">
                            ← Back to Shopping
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Initialize Stripe Elements
    setupStripeCheckout(grandTotal);

    // Initialize Google Places Autocomplete (wait for Google Maps to load)
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        initializeAddressAutocomplete();
    } else {
        // Wait for Google Maps to load
        const waitForGoogle = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                clearInterval(waitForGoogle);
                initializeAddressAutocomplete();
            }
        }, 100);

        // Give up after 5 seconds
        setTimeout(() => {
            clearInterval(waitForGoogle);
            if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
                initializeAddressAutocomplete(); // Will show the "not configured" message
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

    // Handle real-time validation errors
    cardElement.on('change', function(event) {
        const displayError = document.getElementById('card-errors');
        if (event.error) {
            displayError.textContent = event.error.message;
        } else {
            displayError.textContent = '';
        }
    });

    // Handle form submission
    const form = document.getElementById('payment-form');
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        const submitButton = document.getElementById('submit-button');
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';

        try {
            // In a real implementation, you would:
            // 1. Create a PaymentIntent on your server
            // 2. Pass the client_secret to confirmCardPayment
            // For now, we'll simulate this with a direct charge

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
            } else {
                // Payment method created successfully
                // In production, send paymentMethod.id to your server
                processPayment(paymentMethod.id, amount);
            }
        } catch (err) {
            alert('Payment failed: ' + err.message);
            submitButton.disabled = false;
            submitButton.textContent = 'Pay $' + amount.toFixed(2);
        }
    });
}

// Google Places Autocomplete for address validation
function initializeAddressAutocomplete() {
    const streetInput = document.getElementById('shipping-street');
    if (!streetInput) {
        console.error('Street input field not found');
        return;
    }

    console.log('=== Google Places Autocomplete Debug ===');
    console.log('Street input found:', streetInput);
    console.log('Google object exists:', typeof google !== 'undefined');
    console.log('Google Maps exists:', typeof google !== 'undefined' && google.maps);
    console.log('Google Places exists:', typeof google !== 'undefined' && google.maps && google.maps.places);

    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.warn('Google Places API not loaded. Address autocomplete disabled.');
        console.log('localStorage googlePlacesSettings:', localStorage.getItem('googlePlacesSettings'));

        // Show a helpful message below the street input
        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
        helpText.innerHTML = '⚠️ Address autocomplete not available - check browser console for errors';
        streetInput.parentElement.appendChild(helpText);
        return;
    }

    try {
        console.log('✓ Google Places API loaded successfully');
        console.log('Creating autocomplete instance...');

        // Remove any existing pac-container (autocomplete dropdown) on error
        const existingContainers = document.querySelectorAll('.pac-container');
        existingContainers.forEach(container => container.remove());

        // Create autocomplete instance with error handling
        const autocomplete = new google.maps.places.Autocomplete(streetInput, {
            types: ['address'],
            componentRestrictions: { country: 'us' },
            fields: ['address_components', 'formatted_address', 'geometry']
        });

        console.log('✓ Autocomplete instance created:', autocomplete);

        // Check for Google Maps errors after a short delay
        setTimeout(() => {
            const errorOverlay = document.querySelector('.dismissible-error-overlay, .gm-err-container');
            if (errorOverlay) {
                console.error('❌ Google Maps showing error overlay - disabling autocomplete');
                // Remove the autocomplete to prevent blocking
                google.maps.event.clearInstanceListeners(streetInput);
                errorOverlay.remove();

                const helpText = document.createElement('small');
                helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
                helpText.innerHTML = '⚠️ Address autocomplete error - please type address manually. Check console for details.';
                streetInput.parentElement.appendChild(helpText);
                return;
            }
        }, 1000);

        // Add visual indicator that autocomplete is active
        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #28a745; font-size: 0.85rem;';
        helpText.innerHTML = '✓ Address suggestions enabled - start typing to see matches';
        streetInput.parentElement.appendChild(helpText);

        // Handle place selection
        autocomplete.addListener('place_changed', function() {
            const place = autocomplete.getPlace();

            console.log('=== Place Selected ===');
            console.log('Place object:', place);

            if (!place.address_components) {
                console.warn('No address components found in selected place');
                return;
            }

            // Extract address components
            let streetNumber = '';
            let route = '';
            let city = '';
            let state = '';
            let zip = '';

            console.log('Extracting address components...');
            for (const component of place.address_components) {
                const types = component.types;
                console.log('Component:', component.long_name, '- Types:', types);

                if (types.includes('street_number')) {
                    streetNumber = component.long_name;
                }
                if (types.includes('route')) {
                    route = component.long_name;
                }
                if (types.includes('locality')) {
                    city = component.long_name;
                }
                if (types.includes('administrative_area_level_1')) {
                    state = component.short_name;
                }
                if (types.includes('postal_code')) {
                    zip = component.long_name;
                }
            }

            console.log('Extracted values:', { streetNumber, route, city, state, zip });

            // Auto-fill the form fields
            document.getElementById('shipping-street').value = `${streetNumber} ${route}`.trim();
            document.getElementById('shipping-city').value = city;
            document.getElementById('shipping-state').value = state;
            document.getElementById('shipping-zip').value = zip;

            console.log('✓ Address fields auto-filled successfully');
        });

        console.log('✓ Google Places Autocomplete initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing autocomplete:', error);

        // Show error message
        const helpText = document.createElement('small');
        helpText.style.cssText = 'display: block; margin-top: 0.5rem; color: #dc3545; font-size: 0.85rem;';
        helpText.innerHTML = `⚠️ Error: ${error.message}`;
        streetInput.parentElement.appendChild(helpText);
    }
}

async function processPayment(paymentMethodId, amount) {
    // In production, this would call your server to create a charge
    // For now, we'll simulate a successful payment

    // Collect shipping address from separate fields
    const shippingStreet = document.getElementById('shipping-street').value;
    const shippingApt = document.getElementById('shipping-apt').value;
    const shippingCity = document.getElementById('shipping-city').value;
    const shippingState = document.getElementById('shipping-state').value;
    const shippingZip = document.getElementById('shipping-zip').value;

    const order = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        customerName: document.getElementById('customer-name').value,
        customerEmail: document.getElementById('customer-email').value,
        shippingAddress: {
            street: shippingStreet,
            apt: shippingApt,
            city: shippingCity,
            state: shippingState,
            zip: shippingZip,
            fullAddress: `${shippingStreet}${shippingApt ? ', ' + shippingApt : ''}, ${shippingCity}, ${shippingState} ${shippingZip}`
        },
        paymentMethod: 'stripe',
        paymentMethodId: paymentMethodId,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price
        })),
        total: amount,
        status: 'paid'
    };

    // Create shipping label via Shippo
    console.log('Creating shipping label...');
    const shippingLabel = await createShippingLabel(order);

    if (shippingLabel) {
        console.log('Shipping label created successfully!', shippingLabel);
        order.shipping = {
            label_url: shippingLabel.label_url,
            tracking_number: shippingLabel.tracking_number,
            tracking_url: shippingLabel.tracking_url,
            carrier: shippingLabel.carrier,
            service: shippingLabel.service,
            cost: shippingLabel.cost,
            transaction_id: shippingLabel.transaction_id,
            created_at: new Date().toISOString()
        };
    } else {
        console.warn('Shipping label creation failed - order will be saved without label');
        order.shipping = null;
    }

    // Save order
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    // Mark items as sold
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    cart.forEach(cartItem => {
        const item = inventory.find(i => i.id === cartItem.id);
        if (item) {
            item.available = false;
        }
    });
    localStorage.setItem('inventory', JSON.stringify(inventory));

    // Clear cart
    cart = [];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // Show success
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

    // Refresh shop to remove sold items
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

function completeOrder() {
    const order = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        customerName: document.getElementById('customerName').value,
        customerEmail: document.getElementById('customerEmail').value,
        shippingAddress: document.getElementById('shippingAddress').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price
        })),
        total: cart.reduce((sum, item) => sum + item.price, 0),
        status: 'pending'
    };

    // Save order
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));

    // Mark items as sold
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    cart.forEach(cartItem => {
        const item = inventory.find(i => i.id === cartItem.id);
        if (item) {
            item.available = false;
        }
    });
    localStorage.setItem('inventory', JSON.stringify(inventory));

    // Show confirmation
    alert(`Order placed successfully! Order #${order.id.substring(0, 8)}\n\nWe'll send payment instructions to ${order.customerEmail}`);

    closeCheckout();
    loadShopInventory(); // Refresh shop
}

// Load syndicated listings from admin backend
function loadSyndicatedListingsToFrontend() {
    const listings = JSON.parse(localStorage.getItem('syndicatedListings') || '[]');
    const activeListings = listings.filter(l => l.active);

    if (activeListings.length === 0) {
        return [];
    }

    return activeListings.map(listing => ({
        title: listing.title,
        platform: listing.platform,
        price: listing.price,
        link: listing.link,
        image: listing.image
    }));
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

    // Hide current image
    images[currentImageIndex[itemId]].style.opacity = '0';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'rgba(255,255,255,0.5)';
    }

    // Move to next image
    currentImageIndex[itemId] = (currentImageIndex[itemId] + 1) % images.length;

    // Show next image
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

    // Hide current image
    images[currentImageIndex[itemId]].style.opacity = '0';
    if (dots[currentImageIndex[itemId]]) {
        dots[currentImageIndex[itemId]].style.background = 'rgba(255,255,255,0.5)';
    }

    // Move to previous image
    currentImageIndex[itemId] = (currentImageIndex[itemId] - 1 + images.length) % images.length;

    // Show previous image
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
