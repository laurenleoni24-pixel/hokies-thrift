// Admin Panel JavaScript

// Worker URL — update this after deploying your Cloudflare Worker
const WORKER_URL = 'https://hokies-thrift-ebay.laurenleoni24.workers.dev';

/**
 * POST data to a Worker KV endpoint (admin-authenticated)
 */
async function postToWorker(path, data) {
    const adminKey = localStorage.getItem('adminKey') || '';
    if (!adminKey) {
        console.warn('No admin key set — data will only be saved locally');
        return;
    }
    try {
        const resp = await fetch(`${WORKER_URL.replace(/\/$/, '')}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Key': adminKey
            },
            body: JSON.stringify(data)
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            console.error(`Failed to sync ${path} to Worker:`, err);
        }
    } catch (e) {
        console.error(`Failed to sync ${path} to Worker:`, e);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initializeData();
    loadEbaySettings();
    loadShippoSettings();
    loadGooglePlacesSettings();
});

// AUTHENTICATION
function checkAuth() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn');
    if (isLoggedIn === 'true') {
        showDashboard();
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    loadDashboardData();
}

// Handle login
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Simple authentication (in production, this should be server-side)
    if (username === 'admin' && password === 'hokies2021') {
        localStorage.setItem('adminLoggedIn', 'true');
        showDashboard();
    } else {
        document.getElementById('loginError').textContent = 'Invalid credentials';
    }
});

function logout() {
    localStorage.removeItem('adminLoggedIn');
    showLogin();
}

// NAVIGATION
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.getAttribute('data-section');
        switchSection(section);
    });
});

function switchSection(sectionName) {
    // Update menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    // Update sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionName).classList.add('active');

    // Load section-specific data
    if (sectionName === 'drops') {
        loadDropsManagement();
        loadInventory();
    }
    if (sectionName === 'orders') loadOrders();
    if (sectionName === 'submissions') loadSubmissions();
    if (sectionName === 'profits') loadProfits();
    if (sectionName === 'syndicated') loadSyndicatedListings();
}

// INITIALIZE DATA
function initializeData() {
    if (!localStorage.getItem('inventory')) {
        localStorage.setItem('inventory', JSON.stringify([]));
    }
    if (!localStorage.getItem('orders')) {
        localStorage.setItem('orders', JSON.stringify([]));
    }
    if (!localStorage.getItem('sellerSubmissions')) {
        localStorage.setItem('sellerSubmissions', JSON.stringify([]));
    }
    if (!localStorage.getItem('syndicatedListings')) {
        localStorage.setItem('syndicatedListings', JSON.stringify([]));
    }
    if (!localStorage.getItem('dropCountdown')) {
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        localStorage.setItem('dropCountdown', defaultDate.toISOString());
    }
    if (!localStorage.getItem('drops')) {
        localStorage.setItem('drops', JSON.stringify([]));
    }

    // Run migration to add dropId to existing inventory items
    migrateInventoryToDrops();
}

// Migration function to add dropId field to existing inventory items
function migrateInventoryToDrops() {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    let modified = false;

    inventory.forEach(item => {
        if (item.dropId === undefined) {
            item.dropId = null;
            modified = true;
        }
    });

    if (modified) {
        localStorage.setItem('inventory', JSON.stringify(inventory));
    }
}

// DASHBOARD
function loadDashboardData() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');

    const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const newSubmissions = submissions.filter(s => s.status === 'new').length;

    document.getElementById('statPendingOrders').textContent = pendingOrders;
    document.getElementById('statCompletedOrders').textContent = completedOrders;
    document.getElementById('statRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('statActiveListings').textContent = inventory.filter(i => i.available).length;
    document.getElementById('statNewSubmissions').textContent = newSubmissions;
}

// DROP MANAGEMENT
function openDropModal() {
    document.getElementById('dropModal').classList.add('active');
    document.getElementById('imagePreview').innerHTML = '';
    uploadedImages = []; // Reset the uploaded images array
}

function closeDropModal() {
    document.getElementById('dropModal').classList.remove('active');
    document.getElementById('dropForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    uploadedImages = []; // Reset the uploaded images array
}

// Image preview handler with drag-and-drop reordering
let uploadedImages = [];

document.getElementById('itemImages').addEventListener('change', function(e) {
    const files = e.target.files;
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    uploadedImages = [];

    if (files.length > 5) {
        alert('Maximum 5 images allowed. Only first 5 will be used.');
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

                uploadedImages.push({
                    data: compressedData,
                    index: index
                });

                loadedCount++;
                if (loadedCount === fileArray.length) {
                    renderImagePreviews();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function renderImagePreviews() {
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';

    if (uploadedImages.length === 0) return;

    const helpText = document.createElement('p');
    helpText.style.width = '100%';
    helpText.style.fontSize = '0.85rem';
    helpText.style.color = '#666';
    helpText.style.marginBottom = '0.5rem';
    helpText.textContent = 'Drag and drop to reorder • First image will be the main photo';
    preview.appendChild(helpText);

    uploadedImages.forEach((img, index) => {
        const container = document.createElement('div');
        container.className = 'image-preview-item';
        container.draggable = true;
        container.dataset.index = index;
        container.style.position = 'relative';
        container.style.cursor = 'move';
        container.style.display = 'inline-block';

        const imgElement = document.createElement('img');
        imgElement.src = img.data;
        imgElement.style.width = '100px';
        imgElement.style.height = '100px';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '8px';
        imgElement.style.border = index === 0 ? '3px solid var(--orange)' : '2px solid var(--gray-300)';
        imgElement.style.display = 'block';

        const badge = document.createElement('span');
        badge.style.position = 'absolute';
        badge.style.top = '5px';
        badge.style.left = '5px';
        badge.style.background = index === 0 ? 'var(--orange)' : 'var(--gray-700)';
        badge.style.color = 'white';
        badge.style.padding = '3px 8px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '0.75rem';
        badge.style.fontWeight = 'bold';
        badge.textContent = index === 0 ? 'MAIN' : (index + 1);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '×';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '5px';
        removeBtn.style.right = '5px';
        removeBtn.style.background = 'var(--danger)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.width = '24px';
        removeBtn.style.height = '24px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontWeight = 'bold';
        removeBtn.style.fontSize = '1.2rem';
        removeBtn.style.lineHeight = '1';
        removeBtn.onclick = () => removeImage(index);

        container.appendChild(imgElement);
        container.appendChild(badge);
        container.appendChild(removeBtn);

        // Drag and drop events
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);

        preview.appendChild(container);
    });
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreviews();
}

let draggedIndex = null;

function handleDragStart(e) {
    const container = e.currentTarget;
    draggedIndex = parseInt(container.dataset.index);
    container.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', container.innerHTML);
}

function handleDragEnter(e) {
    const container = e.currentTarget;
    const currentIndex = parseInt(container.dataset.index);

    if (draggedIndex !== null && draggedIndex !== currentIndex) {
        container.style.transform = 'scale(1.05)';
        container.style.transition = 'transform 0.2s';
    }
}

function handleDragLeave(e) {
    const container = e.currentTarget;
    container.style.transform = 'scale(1)';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropContainer = e.currentTarget;
    const dropIndex = parseInt(dropContainer.dataset.index);

    // Reset transform on drop target
    dropContainer.style.transform = 'scale(1)';

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
        const draggedItem = uploadedImages[draggedIndex];
        uploadedImages.splice(draggedIndex, 1);
        uploadedImages.splice(dropIndex, 0, draggedItem);
        renderImagePreviews();
    }
    return false;
}

function handleDragEnd(e) {
    const container = e.currentTarget;
    container.style.opacity = '1';
    container.style.transform = 'scale(1)';
    draggedIndex = null;

    // Reset all containers' transforms
    document.querySelectorAll('.image-preview-item').forEach(item => {
        item.style.transform = 'scale(1)';
    });
}

document.getElementById('dropForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    // Validate that images have been uploaded
    if (uploadedImages.length === 0) {
        alert('Please upload at least one image for the item.');
        return;
    }

    // Use the reordered uploadedImages array instead of re-reading from file input
    const images = uploadedImages.map(img => img.data);

    const item = {
        id: Date.now().toString(),
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        cost: parseFloat(document.getElementById('itemCost').value) || 0,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value,
        condition: document.getElementById('itemCondition').value,
        images: images,
        available: true,
        createdAt: new Date().toISOString()
    };

    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    inventory.push(item);
    localStorage.setItem('inventory', JSON.stringify(inventory));

    closeDropModal();
    loadInventory();
    loadDashboardData();
    alert('Item added successfully!');
});

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadInventory() {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const grid = document.getElementById('inventoryGrid');

    // Filter to show only unassigned items (not in any drop)
    const unassignedItems = inventory.filter(item => !item.dropId);

    if (inventory.length === 0) {
        grid.innerHTML = '<p>No items in inventory. Create your first drop!</p>';
        return;
    }

    if (unassignedItems.length === 0) {
        grid.innerHTML = '<p class="empty-state">All items are assigned to drops. Create new items to add to future drops!</p>';
        return;
    }

    grid.innerHTML = unassignedItems.map(item => {
        // Handle both old (single image) and new (multiple images) format
        const images = item.images || (item.image ? [item.image] : []);
        const firstImage = images.length > 0 ? images[0] : null;

        return `
        <div class="inventory-item">
            <div class="inventory-item-image" style="position: relative;">
                ${firstImage ? `<img src="${firstImage}" alt="${item.name}">` : `<span>No Image</span>`}
                ${images.length > 1 ? `<span style="position: absolute; top: 5px; right: 5px; background: var(--orange); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">+${images.length - 1}</span>` : ''}
            </div>
            <div class="inventory-item-info">
                <h3>${item.name}</h3>
                <p>${item.description.substring(0, 80)}...</p>
                <p class="inventory-item-price">$${item.price.toFixed(2)}</p>
                <p><small>Size: ${item.size || 'N/A'} | Condition: ${item.condition}</small></p>
                <p><small>Cost: $${item.cost.toFixed(2)} | Profit: $${(item.price - item.cost).toFixed(2)}</small></p>
                <p><strong>Status: ${item.available ? '✅ Available' : '❌ Sold'}</strong></p>
                <div class="inventory-item-actions">
                    <button class="btn-primary" onclick="editInventoryItem('${item.id}')">Edit</button>
                    ${item.available ?
                        `<button class="btn-danger" onclick="markAsSold('${item.id}')">Mark as Sold</button>` :
                        `<button class="btn-secondary" onclick="markAsAvailable('${item.id}')">Mark Available</button>`
                    }
                    <button class="btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function markAsSold(itemId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === itemId);
    if (item) {
        item.available = false;
        localStorage.setItem('inventory', JSON.stringify(inventory));
        loadInventory();
        loadDashboardData();
    }
}

function markAsAvailable(itemId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === itemId);
    if (item) {
        item.available = true;
        localStorage.setItem('inventory', JSON.stringify(inventory));
        loadInventory();
        loadDashboardData();
    }
}

function deleteItem(itemId) {
    if (confirm('Are you sure you want to delete this item?')) {
        let inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
        inventory = inventory.filter(i => i.id !== itemId);
        localStorage.setItem('inventory', JSON.stringify(inventory));
        loadInventory();
        loadDashboardData();
    }
}

// EDIT INVENTORY ITEM
let editUploadedImages = [];
let currentEditItemId = null;

function editInventoryItem(itemId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === itemId);

    if (!item) {
        alert('Item not found');
        return;
    }

    currentEditItemId = itemId;

    // Populate form fields
    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemDescription').value = item.description;
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemCost').value = item.cost || 0;
    document.getElementById('editItemCategory').value = item.category || 'other';
    document.getElementById('editItemSize').value = item.size || '';
    document.getElementById('editItemCondition').value = item.condition || 'good';

    // Load existing images
    editUploadedImages = (item.images || []).map((img, index) => ({
        data: img,
        index: index
    }));

    renderEditImagePreviews();

    // Show modal
    document.getElementById('editInventoryModal').classList.add('active');
}

function renderEditImagePreviews() {
    const preview = document.getElementById('editImagePreview');
    preview.innerHTML = '';

    if (editUploadedImages.length === 0) {
        preview.innerHTML = '<p style="color: #666;">No photos yet. Upload photos below.</p>';
        return;
    }

    const helpText = document.createElement('p');
    helpText.style.width = '100%';
    helpText.style.fontSize = '0.85rem';
    helpText.style.color = '#666';
    helpText.style.marginBottom = '0.5rem';
    helpText.textContent = 'Drag and drop to reorder • First image will be the main photo';
    preview.appendChild(helpText);

    editUploadedImages.forEach((img, index) => {
        const container = document.createElement('div');
        container.className = 'image-preview-item';
        container.draggable = true;
        container.dataset.index = index;
        container.style.position = 'relative';
        container.style.cursor = 'move';
        container.style.display = 'inline-block';

        const imgElement = document.createElement('img');
        imgElement.src = img.data;
        imgElement.style.width = '100px';
        imgElement.style.height = '100px';
        imgElement.style.objectFit = 'cover';
        imgElement.style.borderRadius = '8px';
        imgElement.style.border = index === 0 ? '3px solid var(--orange)' : '2px solid var(--gray-300)';
        imgElement.style.display = 'block';

        const badge = document.createElement('span');
        badge.style.position = 'absolute';
        badge.style.top = '5px';
        badge.style.left = '5px';
        badge.style.background = index === 0 ? 'var(--orange)' : 'var(--maroon)';
        badge.style.color = 'white';
        badge.style.padding = '2px 8px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '0.75rem';
        badge.style.fontWeight = 'bold';
        badge.textContent = index + 1;

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = 'var(--danger)';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '24px';
        deleteBtn.style.height = '24px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.fontSize = '1rem';
        deleteBtn.style.lineHeight = '1';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            editUploadedImages.splice(index, 1);
            editUploadedImages = editUploadedImages.map((img, idx) => ({ ...img, index: idx }));
            renderEditImagePreviews();
        };

        container.appendChild(imgElement);
        container.appendChild(badge);
        container.appendChild(deleteBtn);

        // Drag and drop handlers
        container.addEventListener('dragstart', handleEditDragStart);
        container.addEventListener('dragover', handleEditDragOver);
        container.addEventListener('drop', handleEditDrop);
        container.addEventListener('dragend', handleEditDragEnd);

        preview.appendChild(container);
    });
}

let editDraggedIndex = null;

function handleEditDragStart(e) {
    const container = e.currentTarget;
    editDraggedIndex = parseInt(container.dataset.index);
    container.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
}

function handleEditDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const container = e.currentTarget;
    container.style.transform = 'scale(1.05)';
}

function handleEditDrop(e) {
    e.preventDefault();
    const container = e.currentTarget;
    container.style.transform = 'scale(1)';

    const dropIndex = parseInt(container.dataset.index);

    if (editDraggedIndex !== dropIndex) {
        const draggedItem = editUploadedImages[editDraggedIndex];
        editUploadedImages.splice(editDraggedIndex, 1);
        editUploadedImages.splice(dropIndex, 0, draggedItem);
        editUploadedImages = editUploadedImages.map((img, idx) => ({ ...img, index: idx }));
        renderEditImagePreviews();
    }
}

function handleEditDragEnd(e) {
    const container = e.currentTarget;
    container.style.opacity = '1';
    container.style.transform = 'scale(1)';
}

function closeEditInventoryModal() {
    document.getElementById('editInventoryModal').classList.remove('active');
    document.getElementById('editInventoryForm').reset();
    editUploadedImages = [];
    currentEditItemId = null;
}

// Handle new photo uploads in edit modal
document.getElementById('editItemImages').addEventListener('change', function(e) {
    const files = e.target.files;

    if (editUploadedImages.length + files.length > 5) {
        alert('Maximum 5 images allowed. Some files will be skipped.');
    }

    const remainingSlots = 5 - editUploadedImages.length;
    const fileArray = Array.from(files).slice(0, remainingSlots);
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

                editUploadedImages.push({
                    data: compressedData,
                    index: editUploadedImages.length
                });

                loadedCount++;
                if (loadedCount === fileArray.length) {
                    renderEditImagePreviews();
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

// Handle edit form submission
document.getElementById('editInventoryForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const item = inventory.find(i => i.id === currentEditItemId);

    if (!item) {
        alert('Item not found');
        return;
    }

    // Update item with new values
    item.name = document.getElementById('editItemName').value;
    item.description = document.getElementById('editItemDescription').value;
    item.price = parseFloat(document.getElementById('editItemPrice').value);
    item.cost = parseFloat(document.getElementById('editItemCost').value) || 0;
    item.category = document.getElementById('editItemCategory').value;
    item.size = document.getElementById('editItemSize').value;
    item.condition = document.getElementById('editItemCondition').value;
    item.images = editUploadedImages.map(img => img.data);

    // Save to localStorage
    localStorage.setItem('inventory', JSON.stringify(inventory));

    alert('Item updated successfully!');
    closeEditInventoryModal();
    loadInventory();
});

function setDropCountdown() {
    const dateTime = document.getElementById('dropDateTime').value;
    if (dateTime) {
        const date = new Date(dateTime);
        localStorage.setItem('dropCountdown', date.toISOString());
        alert('Countdown updated! The homepage will show the new drop date.');
    } else {
        alert('Please select a date and time');
    }
}

// ==========================================
// DROP MANAGEMENT SYSTEM
// ==========================================

// Load and display drops in admin panel
function loadDropsManagement() {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');

    // Separate by status
    const draftDrops = drops.filter(d => d.status === 'draft');
    const scheduledDrops = drops.filter(d => d.status === 'scheduled').sort((a, b) =>
        new Date(a.scheduledDate) - new Date(b.scheduledDate)
    );
    const liveDrops = drops.filter(d => d.status === 'live').sort((a, b) =>
        new Date(b.activatedDate) - new Date(a.activatedDate)
    );

    // Render each category
    renderDropCategory('draftDropsContainer', draftDrops, 'draft');
    renderDropCategory('scheduledDropsContainer', scheduledDrops, 'scheduled');
    renderDropCategory('liveDropsContainer', liveDrops, 'live');

    // Start countdown updates for scheduled drops
    startDropCountdowns();
}

// Render drop cards for a specific status
function renderDropCategory(containerId, drops, status) {
    const container = document.getElementById(containerId);

    if (!container) return;

    if (drops.length === 0) {
        container.innerHTML = '<p class="empty-state">No ' + status + ' drops</p>';
        return;
    }

    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    container.innerHTML = drops.map(drop => {
        const dropItems = inventory.filter(item => drop.itemIds.includes(item.id));
        const availableCount = dropItems.filter(item => item.available).length;

        let html = `<div class="drop-card" data-drop-id="${drop.id}">
            <h3>${drop.name}</h3>`;

        if (drop.description) {
            html += `<p class="drop-description">${drop.description}</p>`;
        }

        if (status === 'draft') {
            html += `
                <p class="drop-stats">${drop.itemIds.length} items selected</p>
                <div class="drop-actions">
                    <button class="btn-primary" onclick="editDrop('${drop.id}')">Edit</button>
                    <button class="btn-secondary" onclick="scheduleDrop('${drop.id}')">Schedule</button>
                    <button class="btn-danger" onclick="deleteDrop('${drop.id}')">Delete</button>
                </div>`;
        }

        if (status === 'scheduled') {
            html += `
                <div class="drop-countdown" id="countdown-${drop.id}">
                    Calculating...
                </div>
                <p class="drop-stats">${drop.itemIds.length} items | ${new Date(drop.scheduledDate).toLocaleString()}</p>
                <div class="drop-actions">
                    <button class="btn-success" onclick="viewDropItems('${drop.id}')">View Items</button>
                    <button class="btn-secondary" onclick="editDropSchedule('${drop.id}')">Edit Schedule</button>
                    <button class="btn-danger" onclick="cancelScheduledDrop('${drop.id}')">Cancel</button>
                </div>`;
        }

        if (status === 'live') {
            html += `
                <p class="drop-live-badge">🔴 LIVE NOW</p>
                <p class="drop-stats">${availableCount}/${drop.itemIds.length} items remaining</p>
                <p class="drop-meta">Activated: ${new Date(drop.activatedDate).toLocaleString()}</p>
                <div class="drop-actions">
                    <button class="btn-success" onclick="viewDropItems('${drop.id}')">View Items</button>
                    <button class="btn-secondary" onclick="completeDrop('${drop.id}')">Mark Complete</button>
                </div>`;
        }

        html += `</div>`;
        return html;
    }).join('');
}

// Open drop creation/edit modal
let currentEditingDropId = null;

function openDropEditor(dropId = null) {
    const modal = document.getElementById('dropEditorModal');
    modal.classList.add('active');

    currentEditingDropId = dropId;

    if (dropId) {
        // Edit mode
        const drops = JSON.parse(localStorage.getItem('drops') || '[]');
        const drop = drops.find(d => d.id === dropId);

        if (drop) {
            document.getElementById('dropEditorTitle').textContent = 'Edit Drop';
            document.getElementById('dropName').value = drop.name;
            document.getElementById('dropDescription').value = drop.description || '';
            document.getElementById('btnSaveDrop').textContent = 'Update Drop';
        }
    } else {
        // Create mode
        document.getElementById('dropEditorTitle').textContent = 'Create New Drop';
        document.getElementById('dropName').value = '';
        document.getElementById('dropDescription').value = '';
        document.querySelector('input[name="scheduleType"][value="draft"]').checked = true;
        document.getElementById('scheduleDatePicker').style.display = 'none';
        document.getElementById('dropScheduleDate').value = '';
        document.getElementById('btnSaveDrop').textContent = 'Create Drop';
    }

    showDropStep(1);
}

function closeDropEditor() {
    document.getElementById('dropEditorModal').classList.remove('active');
    currentEditingDropId = null;
}

// Step navigation
function showDropStep(stepNum) {
    document.querySelectorAll('.drop-step').forEach(step => step.classList.remove('active'));
    const stepEl = document.getElementById('dropStep' + stepNum);
    if (stepEl) {
        stepEl.classList.add('active');
    }

    // Load item selection when moving to step 2
    if (stepNum === 2) {
        loadDropItemSelection();
    }
}

function nextDropStep(stepNum) {
    if (stepNum === 2) {
        // Validate step 1
        const name = document.getElementById('dropName').value.trim();
        if (!name) {
            alert('Please enter a drop name');
            return;
        }
    } else if (stepNum === 3) {
        // Validate step 2 (item selection)
        const selectedCount = getSelectedDropItems().length;
        if (selectedCount < 1 || selectedCount > 10) {
            alert('Please select between 1-10 items');
            return;
        }

        // Update preview
        updateDropPreview();
    }

    showDropStep(stepNum);
}

function prevDropStep(stepNum) {
    showDropStep(stepNum);
}

// Load available items for selection
function loadDropItemSelection() {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    // Get unassigned items (or items in current drop if editing)
    const availableItems = inventory.filter(item =>
        !item.dropId || item.dropId === currentEditingDropId
    );

    const container = document.getElementById('dropItemSelection');

    if (availableItems.length === 0) {
        container.innerHTML = '<p class="empty-state">No unassigned items available. All items are in other drops.</p>';
        return;
    }

    container.innerHTML = availableItems.map(item => {
        const images = item.images || [];
        const firstImage = images.length > 0 ? images[0] : null;
        const isCurrentlyInDrop = currentEditingDropId && item.dropId === currentEditingDropId;

        return `
            <label class="item-select-card">
                <input type="checkbox"
                       value="${item.id}"
                       onchange="updateDropItemCount()"
                       ${isCurrentlyInDrop ? 'checked' : ''}>
                <div class="item-select-preview">
                    ${firstImage ?
                        `<img src="${firstImage}" alt="${item.name}">` :
                        `<div class="placeholder-icon">${item.category}</div>`
                    }
                </div>
                <div class="item-select-info">
                    <strong>${item.name}</strong>
                    <span class="price">$${item.price.toFixed(2)}</span>
                    <small>${item.size || 'N/A'} | ${item.condition}</small>
                </div>
            </label>
        `;
    }).join('');

    // Update count after rendering
    updateDropItemCount();
}

// Update item selection counter
function updateDropItemCount() {
    const selected = getSelectedDropItems();
    const count = selected.length;
    document.getElementById('selectedCount').textContent = count;

    const warning = document.getElementById('selectionWarning');
    const btnContinue = document.getElementById('btnContinueItems');

    if (count < 1) {
        warning.textContent = '⚠️ Minimum 1 item required';
        warning.style.color = 'var(--danger)';
        btnContinue.disabled = true;
    } else if (count > 10) {
        warning.textContent = '⚠️ Maximum 10 items allowed';
        warning.style.color = 'var(--danger)';
        btnContinue.disabled = true;
    } else {
        warning.textContent = '✓ Valid selection';
        warning.style.color = 'var(--success)';
        btnContinue.disabled = false;
    }
}

function getSelectedDropItems() {
    const checkboxes = document.querySelectorAll('#dropItemSelection input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Update drop preview in step 3
function updateDropPreview() {
    const name = document.getElementById('dropName').value.trim();
    const itemCount = getSelectedDropItems().length;
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;

    document.getElementById('previewName').textContent = name;
    document.getElementById('previewItemCount').textContent = itemCount + ' items';

    let statusText = 'Draft';
    if (scheduleType === 'schedule') {
        statusText = 'Scheduled';
    } else if (scheduleType === 'now') {
        statusText = 'Live (Immediate)';
    }
    document.getElementById('previewStatus').textContent = statusText;
}

// Save drop
function saveDrop() {
    const dropId = currentEditingDropId || 'drop_' + Date.now();
    const name = document.getElementById('dropName').value.trim();
    const description = document.getElementById('dropDescription').value.trim();
    const itemIds = getSelectedDropItems();
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;

    if (!name) {
        alert('Please enter a drop name');
        return;
    }

    if (itemIds.length < 1 || itemIds.length > 10) {
        alert('Please select between 1-10 items');
        return;
    }

    let status = 'draft';
    let scheduledDate = null;
    let activatedDate = null;

    if (scheduleType === 'schedule') {
        const dateInput = document.getElementById('dropScheduleDate').value;
        if (!dateInput) {
            alert('Please select a schedule date');
            return;
        }
        const selectedDate = new Date(dateInput);
        if (selectedDate <= new Date()) {
            alert('Please select a future date and time');
            return;
        }
        scheduledDate = selectedDate.toISOString();
        status = 'scheduled';
    } else if (scheduleType === 'now') {
        status = 'live';
        activatedDate = new Date().toISOString();
    }

    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const existingDropIndex = drops.findIndex(d => d.id === dropId);

    const drop = {
        id: dropId,
        name,
        description,
        status,
        itemIds,
        scheduledDate,
        activatedDate: activatedDate,
        completedDate: null,
        createdAt: existingDropIndex >= 0 ? drops[existingDropIndex].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (existingDropIndex >= 0) {
        drops[existingDropIndex] = drop;
    } else {
        drops.push(drop);
    }

    localStorage.setItem('drops', JSON.stringify(drops));

    // Update inventory items with dropId
    updateItemDropAssignments(itemIds, dropId);

    closeDropEditor();
    loadDropsManagement();

    let message = `Drop "${name}" ${existingDropIndex >= 0 ? 'updated' : 'created'} successfully!`;
    if (status === 'live') {
        message += '\n\n✅ The drop is now LIVE on your shop page!';
    } else if (status === 'scheduled') {
        message += '\n\n⏰ Countdown started! Drop will go live automatically.';
    }
    alert(message);
}

// Update item assignments
function updateItemDropAssignments(itemIds, dropId) {
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    // First, remove dropId from items that were in this drop but are no longer
    if (currentEditingDropId) {
        inventory.forEach(item => {
            if (item.dropId === dropId && !itemIds.includes(item.id)) {
                item.dropId = null;
            }
        });
    }

    // Then assign new items
    itemIds.forEach(itemId => {
        const item = inventory.find(i => i.id === itemId);
        if (item) {
            item.dropId = dropId;
        }
    });

    localStorage.setItem('inventory', JSON.stringify(inventory));
}

// Handle schedule type change
document.addEventListener('change', function(e) {
    if (e.target.name === 'scheduleType') {
        const datePicker = document.getElementById('scheduleDatePicker');
        datePicker.style.display = e.target.value === 'schedule' ? 'block' : 'none';
    }
});

// Multi-countdown system for scheduled drops
let dropCountdownIntervals = {};

function startDropCountdowns() {
    // Clear existing intervals
    Object.values(dropCountdownIntervals).forEach(interval => clearInterval(interval));
    dropCountdownIntervals = {};

    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const scheduledDrops = drops.filter(d => d.status === 'scheduled');

    scheduledDrops.forEach(drop => {
        const interval = setInterval(() => {
            updateDropCountdown(drop.id, drop.scheduledDate);
        }, 1000);

        dropCountdownIntervals[drop.id] = interval;
    });
}

function updateDropCountdown(dropId, scheduledDate) {
    const now = new Date().getTime();
    const target = new Date(scheduledDate).getTime();
    const distance = target - now;

    const element = document.getElementById('countdown-' + dropId);
    if (!element) return;

    if (distance <= 0) {
        // Auto-activate drop
        activateDrop(dropId);
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    element.innerHTML = `
        <strong>Drops in:</strong> ${days}d ${hours}h ${minutes}m ${seconds}s
    `;
}

// Auto-activation logic
function activateDrop(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop || drop.status !== 'scheduled') return;

    drop.status = 'live';
    drop.activatedDate = new Date().toISOString();

    localStorage.setItem('drops', JSON.stringify(drops));

    // Clear countdown interval
    if (dropCountdownIntervals[dropId]) {
        clearInterval(dropCountdownIntervals[dropId]);
        delete dropCountdownIntervals[dropId];
    }

    // Reload drops display
    loadDropsManagement();

    // Notify admin (if they're on the page)
    alert(`Drop "${drop.name}" is now LIVE!`);
}

// Drop action handlers
function editDrop(dropId) {
    openDropEditor(dropId);
}

function scheduleDrop(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    const dateInput = prompt('Enter drop date and time (YYYY-MM-DD HH:MM):');
    if (!dateInput) return;

    try {
        const scheduledDate = new Date(dateInput);
        if (scheduledDate <= new Date()) {
            alert('Please select a future date and time');
            return;
        }

        drop.status = 'scheduled';
        drop.scheduledDate = scheduledDate.toISOString();
        drop.updatedAt = new Date().toISOString();

        localStorage.setItem('drops', JSON.stringify(drops));
        loadDropsManagement();
        alert(`Drop "${drop.name}" scheduled for ${scheduledDate.toLocaleString()}`);
    } catch (e) {
        alert('Invalid date format. Please try again.');
    }
}

function deleteDrop(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    if (drop.status === 'live') {
        alert('Cannot delete a live drop. Please complete it first.');
        return;
    }

    if (!confirm(`Are you sure you want to delete "${drop.name}"? Items will be unassigned.`)) return;

    // Unassign items
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    inventory.forEach(item => {
        if (item.dropId === dropId) {
            item.dropId = null;
        }
    });
    localStorage.setItem('inventory', JSON.stringify(inventory));

    // Remove drop
    const updatedDrops = drops.filter(d => d.id !== dropId);
    localStorage.setItem('drops', JSON.stringify(updatedDrops));

    loadDropsManagement();
    loadInventory();
    alert('Drop deleted successfully');
}

function completeDrop(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    if (!confirm(`Mark "${drop.name}" as complete? This will archive the drop.`)) return;

    drop.status = 'completed';
    drop.completedDate = new Date().toISOString();

    localStorage.setItem('drops', JSON.stringify(drops));
    loadDropsManagement();
    alert('Drop marked as complete');
}

function viewDropItems(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');
    const dropItems = inventory.filter(item => drop.itemIds.includes(item.id));

    const itemsList = dropItems.map(item =>
        `- ${item.name} ($${item.price.toFixed(2)}) - ${item.available ? 'Available' : 'Sold'}`
    ).join('\n');

    alert(`Items in "${drop.name}":\n\n${itemsList}`);
}

function editDropSchedule(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    const currentDate = new Date(drop.scheduledDate);
    const dateInput = prompt(`Current schedule: ${currentDate.toLocaleString()}\n\nEnter new date and time (YYYY-MM-DD HH:MM):`);

    if (!dateInput) return;

    try {
        const newDate = new Date(dateInput);
        if (newDate <= new Date()) {
            alert('Please select a future date and time');
            return;
        }

        drop.scheduledDate = newDate.toISOString();
        drop.updatedAt = new Date().toISOString();

        localStorage.setItem('drops', JSON.stringify(drops));
        loadDropsManagement();
        alert(`Drop rescheduled for ${newDate.toLocaleString()}`);
    } catch (e) {
        alert('Invalid date format. Please try again.');
    }
}

function cancelScheduledDrop(dropId) {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const drop = drops.find(d => d.id === dropId);

    if (!drop) return;

    if (!confirm(`Cancel scheduling for "${drop.name}"? It will be saved as a draft.`)) return;

    drop.status = 'draft';
    drop.scheduledDate = null;
    drop.updatedAt = new Date().toISOString();

    // Clear countdown interval
    if (dropCountdownIntervals[dropId]) {
        clearInterval(dropCountdownIntervals[dropId]);
        delete dropCountdownIntervals[dropId];
    }

    localStorage.setItem('drops', JSON.stringify(drops));
    loadDropsManagement();
    alert('Drop saved as draft');
}

// Auto-completion logic - check if all items in live drops are sold
function checkDropCompletion() {
    const drops = JSON.parse(localStorage.getItem('drops') || '[]');
    const liveDrops = drops.filter(d => d.status === 'live');
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    let anyCompleted = false;

    liveDrops.forEach(drop => {
        const dropItems = inventory.filter(item => drop.itemIds.includes(item.id));
        const availableCount = dropItems.filter(item => item.available).length;

        if (availableCount === 0 && dropItems.length > 0) {
            // Auto-complete drop when all items sold
            drop.status = 'completed';
            drop.completedDate = new Date().toISOString();
            anyCompleted = true;
        }
    });

    if (anyCompleted) {
        localStorage.setItem('drops', JSON.stringify(drops));
    }
}

// Run completion check periodically
setInterval(checkDropCompletion, 30000); // Every 30 seconds

// ORDERS
function loadOrders() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No orders yet</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id.substring(0, 8)}</td>
            <td>${new Date(order.date).toLocaleDateString()}</td>
            <td>${order.customerName}<br><small>${order.customerEmail}</small></td>
            <td>${order.items.length} item(s)</td>
            <td>$${order.total.toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewOrderDetail('${order.id}')">View</button>
                <button class="btn-primary" onclick="updateOrderStatus('${order.id}')">Update</button>
                ${order.shipping && order.shipping.label_url ?
                    `<button class="btn-secondary" onclick="window.open('${order.shipping.label_url}', '_blank')">🖨️ Label</button>` :
                    ''
                }
            </td>
        </tr>
    `).join('');
}

function filterOrders() {
    const filter = document.getElementById('orderStatusFilter').value;
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = filtered.map(order => `
        <tr>
            <td>#${order.id.substring(0, 8)}</td>
            <td>${new Date(order.date).toLocaleDateString()}</td>
            <td>${order.customerName}<br><small>${order.customerEmail}</small></td>
            <td>${order.items.length} item(s)</td>
            <td>$${order.total.toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewOrderDetail('${order.id}')">View</button>
                <button class="btn-primary" onclick="updateOrderStatus('${order.id}')">Update</button>
                ${order.shipping && order.shipping.label_url ?
                    `<button class="btn-secondary" onclick="window.open('${order.shipping.label_url}', '_blank')">🖨️ Label</button>` :
                    ''
                }
            </td>
        </tr>
    `).join('');
}

function viewOrderDetail(orderId) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => o.id === orderId);

    if (!order) return;

    const content = `
        <h3>Order #${order.id.substring(0, 8)}</h3>
        <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
        <p><strong>Customer:</strong> ${order.customerName}</p>
        <p><strong>Email:</strong> ${order.customerEmail}</p>
        <p><strong>Shipping Address:</strong><br>${typeof order.shippingAddress === 'string' ? order.shippingAddress : order.shippingAddress.fullAddress}</p>

        ${order.shipping && order.shipping.tracking_number ? `
            <div style="background: #e8f5e9; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; border: 2px solid #4caf50;">
                <h4 style="margin-top: 0; color: #2e7d32;">📦 Shipping Label Created</h4>
                <p><strong>Tracking Number:</strong> <code style="background: white; padding: 0.25rem 0.5rem; border-radius: 4px;">${order.shipping.tracking_number}</code></p>
                <p><strong>Carrier:</strong> ${order.shipping.carrier.toUpperCase()} - ${order.shipping.service}</p>
                ${order.shipping.cost ? `<p><strong>Shipping Cost:</strong> $${order.shipping.cost}</p>` : ''}
                ${order.shipping.tracking_url ? `
                    <p><a href="${order.shipping.tracking_url}" target="_blank" style="color: #1976d2; text-decoration: none; font-weight: 600;">Track Package →</a></p>
                ` : ''}
                ${order.shipping.label_url ? `
                    <button class="btn-primary" onclick="window.open('${order.shipping.label_url}', '_blank')" style="margin-top: 0.5rem;">
                        🖨️ Print Shipping Label
                    </button>
                ` : ''}
            </div>
        ` : ''}

        <h4>Items:</h4>
        <ul>
            ${order.items.map(item => `<li>${item.name} - $${item.price.toFixed(2)}</li>`).join('')}
        </ul>
        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></p>
    `;

    document.getElementById('orderDetailContent').innerHTML = content;
    document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('active');
}

function updateOrderStatus(orderId) {
    const newStatus = prompt('Enter new status (pending/processing/shipped/delivered):');
    if (!newStatus) return;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered'];
    if (!validStatuses.includes(newStatus.toLowerCase())) {
        alert('Invalid status');
        return;
    }

    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = newStatus.toLowerCase();
        localStorage.setItem('orders', JSON.stringify(orders));
        loadOrders();
        alert('Order status updated!');
    }
}

function generateShippingLabel(orderId) {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const order = orders.find(o => o.id === orderId);

    if (!order) return;

    // In production, this would integrate with ShipStation, EasyPost, or USPS API
    alert(`Shipping Label for Order #${order.id.substring(0, 8)}\n\n` +
          `To: ${order.customerName}\n${order.shippingAddress}\n\n` +
          `Note: In production, this would integrate with a shipping service like ShipStation, EasyPost, or USPS to generate a real label with tracking.`);

    // Mark as shipped
    order.status = 'shipped';
    localStorage.setItem('orders', JSON.stringify(orders));
    loadOrders();
}

// PROFITS
function loadProfits() {
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    // Calculate totals
    const completedOrders = orders.filter(o => o.status === 'delivered');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);

    let totalCosts = 0;
    completedOrders.forEach(order => {
        order.items.forEach(orderItem => {
            const inventoryItem = inventory.find(i => i.id === orderItem.id);
            if (inventoryItem) {
                totalCosts += inventoryItem.cost || 0;
            }
        });
    });

    const netProfit = totalRevenue - totalCosts;

    document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('totalCosts').textContent = '$' + totalCosts.toFixed(2);
    document.getElementById('netProfit').textContent = '$' + netProfit.toFixed(2);

    // Load sales table
    const tbody = document.getElementById('salesTableBody');
    if (completedOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No completed sales yet</td></tr>';
        return;
    }

    let salesRows = [];
    completedOrders.forEach(order => {
        order.items.forEach(item => {
            const inventoryItem = inventory.find(i => i.id === item.id);
            const cost = inventoryItem ? inventoryItem.cost : 0;
            const profit = item.price - cost;

            salesRows.push(`
                <tr>
                    <td>${new Date(order.date).toLocaleDateString()}</td>
                    <td>${item.name}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td>$${cost.toFixed(2)}</td>
                    <td style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: bold;">$${profit.toFixed(2)}</td>
                </tr>
            `);
        });
    });

    tbody.innerHTML = salesRows.join('');
}

// SYNDICATED LISTINGS
function openSyndicatedModal() {
    document.getElementById('syndicatedModal').classList.add('active');
}

function closeSyndicatedModal() {
    document.getElementById('syndicatedModal').classList.remove('active');
    document.getElementById('syndicatedForm').reset();
}

document.getElementById('syndicatedForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const listing = {
        id: Date.now().toString(),
        title: document.getElementById('syndicatedTitle').value,
        platform: document.getElementById('syndicatedPlatform').value,
        price: document.getElementById('syndicatedPrice').value,
        link: document.getElementById('syndicatedLink').value,
        image: document.getElementById('syndicatedImage').value,
        active: true,
        createdAt: new Date().toISOString()
    };

    const listings = JSON.parse(localStorage.getItem('syndicatedListings') || '[]');
    listings.push(listing);
    localStorage.setItem('syndicatedListings', JSON.stringify(listings));

    // Sync to Worker KV
    postToWorker('/syndicated-listings', listings);

    closeSyndicatedModal();
    loadSyndicatedListings();
    alert('Syndicated listing added!');
});

function loadSyndicatedListings() {
    const listings = JSON.parse(localStorage.getItem('syndicatedListings') || '[]');
    const grid = document.getElementById('syndicatedGrid');

    if (listings.length === 0) {
        grid.innerHTML = '<p>No syndicated listings yet. Add your first listing!</p>';
        return;
    }

    grid.innerHTML = listings.map(listing => `
        <div class="syndicated-item">
            <div class="syndicated-item-image">
                ${listing.image ? `<img src="${listing.image}" alt="${listing.title}">` : `<span>No Image</span>`}
            </div>
            <div class="syndicated-item-info">
                <span class="platform-badge">${listing.platform.toUpperCase()}</span>
                <h3>${listing.title}</h3>
                <p class="inventory-item-price">${listing.price}</p>
                <p><small><a href="${listing.link}" target="_blank">View Listing →</a></small></p>
                <p><strong>Status: ${listing.active ? '✅ Active' : '❌ Hidden'}</strong></p>
                <div class="inventory-item-actions">
                    ${listing.active ?
                        `<button class="btn-secondary" onclick="toggleSyndicatedListing('${listing.id}', false)">Hide</button>` :
                        `<button class="btn-success" onclick="toggleSyndicatedListing('${listing.id}', true)">Show</button>`
                    }
                    <button class="btn-danger" onclick="deleteSyndicatedListing('${listing.id}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleSyndicatedListing(listingId, active) {
    const listings = JSON.parse(localStorage.getItem('syndicatedListings') || '[]');
    const listing = listings.find(l => l.id === listingId);
    if (listing) {
        listing.active = active;
        localStorage.setItem('syndicatedListings', JSON.stringify(listings));
        postToWorker('/syndicated-listings', listings);
        loadSyndicatedListings();
    }
}

function deleteSyndicatedListing(listingId) {
    if (confirm('Are you sure you want to delete this listing?')) {
        let listings = JSON.parse(localStorage.getItem('syndicatedListings') || '[]');
        listings = listings.filter(l => l.id !== listingId);
        localStorage.setItem('syndicatedListings', JSON.stringify(listings));
        postToWorker('/syndicated-listings', listings);
        loadSyndicatedListings();
    }
}

// SETTINGS
function saveSettings() {
    const settings = {
        storeName: document.getElementById('storeName').value,
        contactEmail: document.getElementById('contactEmail').value,
        instagramHandle: document.getElementById('instagramHandle').value
    };

    localStorage.setItem('storeSettings', JSON.stringify(settings));
    alert('Settings saved!');
}

// Load settings on page load
window.addEventListener('load', function() {
    const settings = JSON.parse(localStorage.getItem('storeSettings') || '{}');
    if (settings.storeName) document.getElementById('storeName').value = settings.storeName;
    if (settings.contactEmail) document.getElementById('contactEmail').value = settings.contactEmail;
    if (settings.instagramHandle) document.getElementById('instagramHandle').value = settings.instagramHandle;
});

// SELLER SUBMISSIONS
function loadSubmissions() {
    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const tbody = document.getElementById('submissionsTableBody');

    if (submissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No seller submissions yet</td></tr>';
        return;
    }

    tbody.innerHTML = submissions.map(submission => `
        <tr>
            <td>${new Date(submission.date).toLocaleDateString()}</td>
            <td>${submission.name}<br><small>${submission.email}</small></td>
            <td>${submission.itemType}</td>
            <td>${submission.condition}</td>
            <td>${submission.era || 'N/A'}</td>
            <td>${submission.estimate || 'N/A'}</td>
            <td><span class="status-badge status-${submission.status}">${submission.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewSubmissionDetail('${submission.id}')">View</button>
                <button class="btn-primary" onclick="updateSubmissionStatus('${submission.id}')">Update</button>
            </td>
        </tr>
    `).join('');
}

function filterSubmissions() {
    const filter = document.getElementById('submissionStatusFilter').value;
    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const filtered = filter === 'all' ? submissions : submissions.filter(s => s.status === filter);

    const tbody = document.getElementById('submissionsTableBody');

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No submissions found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(submission => `
        <tr>
            <td>${new Date(submission.date).toLocaleDateString()}</td>
            <td>${submission.name}<br><small>${submission.email}</small></td>
            <td>${submission.itemType}</td>
            <td>${submission.condition}</td>
            <td>${submission.era || 'N/A'}</td>
            <td>${submission.estimate || 'N/A'}</td>
            <td><span class="status-badge status-${submission.status}">${submission.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewSubmissionDetail('${submission.id}')">View</button>
                <button class="btn-primary" onclick="updateSubmissionStatus('${submission.id}')">Update</button>
            </td>
        </tr>
    `).join('');
}

function viewSubmissionDetail(submissionId) {
    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const submission = submissions.find(s => s.id === submissionId);

    if (!submission) return;

    let statusActions = '';

    if (submission.status === 'pending_admin') {
        statusActions = `
            <div style="background: var(--light-beige); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>Admin Review</h4>
                <div class="form-group">
                    <label>Set Your Price (what you'll pay the seller):</label>
                    <input type="number" id="adminPrice" placeholder="Enter price" step="0.01" style="width: 200px; padding: 0.5rem; border: 2px solid var(--gray-200); border-radius: 5px;">
                </div>
                <div class="form-group">
                    <label>Notes (optional):</label>
                    <textarea id="adminNotes" rows="3" placeholder="Any notes for your records" style="width: 100%; padding: 0.5rem; border: 2px solid var(--gray-200); border-radius: 5px;"></textarea>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <button class="btn-success" onclick="approveSubmission('${submission.id}')">Approve & Send to Seller</button>
                    <button class="btn-danger" onclick="rejectSubmission('${submission.id}')">Reject</button>
                </div>
            </div>
        `;
    } else if (submission.status === 'pending_seller') {
        // Generate approval link - handle both local file system and web server
        let approvalLink = '';
        if (window.location.protocol === 'file:') {
            // For local file system, use the full file path
            const currentPath = window.location.pathname;
            const directory = currentPath.substring(0, currentPath.lastIndexOf('/'));
            approvalLink = `file://${directory}/seller-approval.html?id=${submission.id}`;
        } else {
            // For web server
            approvalLink = `${window.location.origin}/seller-approval.html?id=${submission.id}`;
        }

        statusActions = `
            <div style="background: var(--light-beige); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>⏳ Waiting for Seller Approval</h4>
                <p><strong>Your Offer:</strong> $${submission.adminPrice}</p>
                ${submission.adminNotes ? `<p><strong>Your Notes:</strong> ${submission.adminNotes}</p>` : ''}
                <p><strong>Reviewed:</strong> ${new Date(submission.reviewedAt).toLocaleString()}</p>

                <div style="margin-top: 1rem;">
                    <p><strong>Approval Link:</strong></p>
                    <input type="text" value="${approvalLink}" readonly style="width: 100%; padding: 0.5rem; background: white; border: 2px solid var(--gray-200); border-radius: 5px; font-size: 0.85rem;" onclick="this.select()">
                    <button class="btn-primary" onclick="copyApprovalLink('${approvalLink}')" style="margin-top: 0.5rem; width: 100%;">📋 Copy Link</button>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">Copy and email this link to ${submission.email}</p>
                </div>

                <div style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 5px;">
                    <p style="font-weight: 600; margin-bottom: 0.5rem;">Alternative: Submission ID</p>
                    <p style="font-size: 0.9rem; color: #666;">If the link doesn't work, provide the seller with this ID:</p>
                    <input type="text" value="${submission.id}" readonly style="width: 100%; padding: 0.5rem; background: var(--light-beige); border: 2px solid var(--gray-200); border-radius: 5px; margin-top: 0.5rem; font-family: monospace;" onclick="this.select()">
                    <p style="font-size: 0.85rem; color: #666; margin-top: 0.5rem;">Tell them to open seller-approval.html and enter this ID manually</p>
                </div>
            </div>
        `;
    } else if (submission.status === 'approved') {
        statusActions = `
            <div style="background: var(--success); color: white; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>✅ Approved & Added to Inventory</h4>
                <p><strong>Final Price:</strong> $${submission.adminPrice}</p>
                <p><strong>Seller Approved:</strong> ${new Date(submission.sellerApprovedAt).toLocaleString()}</p>
                <p style="margin-top: 1rem;">This item has been added to your unassigned inventory and is ready to be added to a drop.</p>
            </div>
        `;
    } else if (submission.status === 'rejected') {
        statusActions = `
            <div style="background: var(--danger); color: white; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>❌ Rejected</h4>
                <p><strong>Rejected:</strong> ${new Date(submission.reviewedAt).toLocaleString()}</p>
                ${submission.adminNotes ? `<p><strong>Reason:</strong> ${submission.adminNotes}</p>` : ''}
            </div>
        `;
    }

    // Generate photos display
    let photosHTML = '';
    if (submission.photos && submission.photos.length > 0) {
        photosHTML = `
            <h4>Item Photos:</h4>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                ${submission.photos.map((photo, idx) => `
                    <img src="${photo}" alt="Photo ${idx + 1}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; border: 2px solid var(--gray-300); cursor: pointer;" onclick="window.open('${photo}', '_blank')">
                `).join('')}
            </div>
        `;
    } else {
        photosHTML = `
            <div style="background: #FEF3C7; padding: 1rem; border-radius: 5px; border-left: 4px solid #F59E0B; margin-bottom: 1.5rem;">
                <p style="margin: 0; color: #92400E;"><strong>⚠️ No photos uploaded</strong> - Contact seller to request photos before approving</p>
            </div>
        `;
    }

    const content = `
        <h3>Submission #${submission.id.substring(0, 8)}</h3>
        <p><strong>Date:</strong> ${new Date(submission.date).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${submission.status}">${submission.status.replace(/_/g, ' ').toUpperCase()}</span></p>

        ${photosHTML}

        <h4>Seller Information:</h4>
        <p><strong>Name:</strong> ${submission.name}</p>
        <p><strong>Email:</strong> ${submission.email}</p>
        <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>

        <h4>Item Details:</h4>
        <p><strong>Type:</strong> ${submission.itemType}</p>
        <p><strong>Condition:</strong> ${submission.condition}</p>
        <p><strong>Era:</strong> ${submission.era || 'Not specified'}</p>
        <p><strong>Description:</strong></p>
        <p style="background: #f5f5f5; padding: 1rem; border-radius: 5px;">${submission.description}</p>

        <h4>Seller's Expected Payout:</h4>
        <p style="font-size: 1.5rem; color: var(--orange); font-weight: bold;">${submission.estimate || 'Not calculated'}</p>

        ${statusActions}

        <div style="margin-top: 2rem;">
            <button class="btn-secondary" onclick="closeSubmissionModal()">Close</button>
        </div>
    `;

    document.getElementById('submissionDetailContent').innerHTML = content;
    document.getElementById('submissionModal').classList.add('active');
}

function closeSubmissionModal() {
    document.getElementById('submissionModal').classList.remove('active');
}

function updateSubmissionStatus(submissionId) {
    const newStatus = prompt('Enter new status (new/reviewed/contacted/accepted/declined):');
    if (!newStatus) return;

    const validStatuses = ['new', 'reviewed', 'contacted', 'accepted', 'declined'];
    if (!validStatuses.includes(newStatus.toLowerCase())) {
        alert('Invalid status. Use: new, reviewed, contacted, accepted, or declined');
        return;
    }

    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const submission = submissions.find(s => s.id === submissionId);
    if (submission) {
        submission.status = newStatus.toLowerCase();
        localStorage.setItem('sellerSubmissions', JSON.stringify(submissions));
        loadSubmissions();
        alert('Submission status updated!');
    }
}

// Admin approves submission and sets price
function approveSubmission(submissionId) {
    const price = document.getElementById('adminPrice').value;
    const notes = document.getElementById('adminNotes').value;

    if (!price || price <= 0) {
        alert('Please enter a valid price');
        return;
    }

    if (!confirm(`Approve this submission with a price of $${price}?\n\nThis will send the seller an approval link to accept your offer.`)) {
        return;
    }

    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const submission = submissions.find(s => s.id === submissionId);

    if (submission) {
        submission.status = 'pending_seller';
        submission.adminPrice = parseFloat(price);
        submission.adminNotes = notes;
        submission.reviewedAt = new Date().toISOString();
        localStorage.setItem('sellerSubmissions', JSON.stringify(submissions));

        alert(`Submission approved!\n\nNext steps:\n1. Copy the approval link shown on screen\n2. Email it to ${submission.email}\n3. Wait for seller to approve your $${price} offer\n4. Once approved, item will be added to inventory`);

        closeSubmissionModal();
        loadSubmissions();
        // Reopen to show the approval link
        setTimeout(() => viewSubmissionDetail(submissionId), 100);
    }
}

// Admin rejects submission
function rejectSubmission(submissionId) {
    const reason = prompt('Enter rejection reason (optional - will be saved in notes):');

    if (!confirm('Are you sure you want to reject this submission?')) {
        return;
    }

    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const submission = submissions.find(s => s.id === submissionId);

    if (submission) {
        submission.status = 'rejected';
        submission.adminNotes = reason || 'No reason provided';
        submission.reviewedAt = new Date().toISOString();
        localStorage.setItem('sellerSubmissions', JSON.stringify(submissions));

        alert(`Submission rejected.\n\nConsider sending a polite email to ${submission.email} explaining why.`);

        closeSubmissionModal();
        loadSubmissions();
    }
}

// Seller approves the admin's price offer (called from seller-approval page)
function sellerApproveSubmission(submissionId) {
    const submissions = JSON.parse(localStorage.getItem('sellerSubmissions') || '[]');
    const submission = submissions.find(s => s.id === submissionId);

    if (!submission) {
        return { success: false, message: 'Submission not found' };
    }

    if (submission.status !== 'pending_seller') {
        return { success: false, message: 'This submission is no longer pending approval' };
    }

    // Update submission status
    submission.status = 'approved';
    submission.sellerApprovedAt = new Date().toISOString();
    localStorage.setItem('sellerSubmissions', JSON.stringify(submissions));

    // Auto-create inventory item
    const inventory = JSON.parse(localStorage.getItem('inventory') || '[]');

    const newItem = {
        id: 'sub_' + Date.now().toString(),
        name: `${submission.itemType} - ${submission.era || 'Vintage'} VT`,
        description: submission.description,
        price: 0, // Admin will set retail price later
        cost: submission.adminPrice, // What admin pays the seller
        category: submission.itemType,
        size: 'TBD', // Admin will update
        condition: submission.condition,
        images: submission.photos || [], // Use seller's photos
        available: true,
        dropId: null, // Unassigned
        createdAt: new Date().toISOString(),
        submissionId: submissionId // Link back to original submission
    };

    inventory.push(newItem);
    localStorage.setItem('inventory', JSON.stringify(inventory));

    return {
        success: true,
        message: 'Thank you! Your item has been approved. We will contact you shortly to arrange pickup/shipping.',
        itemId: newItem.id
    };
}

// Copy approval link to clipboard
function copyApprovalLink(link) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => {
            alert('Link copied to clipboard! Paste it in your email to the seller.');
        }).catch(() => {
            // Fallback: select the text
            alert('Please manually copy the link from the text box above.');
        });
    } else {
        alert('Please manually copy the link from the text box above.');
    }
}

// Legacy functions (kept for compatibility)
function acceptSubmission(submissionId) {
    approveSubmission(submissionId);
}

function declineSubmission(submissionId) {
    rejectSubmission(submissionId);
}

// ==============================
// EBAY INTEGRATION SETTINGS
// ==============================

/**
 * Load eBay settings from KV (falling back to localStorage) and populate form fields
 */
async function loadEbaySettings() {
    let settings = JSON.parse(localStorage.getItem('ebaySettings') || '{}');

    // Try to load from Worker KV if local settings are empty
    if (!settings.ebayAppId) {
        try {
            const resp = await fetch(`${WORKER_URL.replace(/\/$/, '')}/settings`);
            if (resp.ok) {
                const kvSettings = await resp.json();
                if (kvSettings && kvSettings.ebayAppId) {
                    settings = kvSettings;
                    // Cache back to localStorage
                    localStorage.setItem('ebaySettings', JSON.stringify(settings));
                }
            }
        } catch (e) {
            console.warn('Could not fetch settings from Worker KV:', e);
        }
    }

    // Populate form fields if they exist (only after login)
    if (document.getElementById('ebayAppId')) {
        document.getElementById('ebayAppId').value = settings.ebayAppId || '';
        document.getElementById('ebayClientSecret').value = settings.ebayClientSecret || '';
        document.getElementById('ebaySellerUsername').value = settings.ebaySellerUsername || '';
        document.getElementById('epnCampaignId').value = settings.epnCampaignId || '';
        document.getElementById('proxyUrl').value = settings.proxyUrl || '';
        document.getElementById('adminKey').value = localStorage.getItem('adminKey') || '';
    }
}

/**
 * Save eBay settings to localStorage
 */
function saveEbaySettings() {
    const settings = {
        ebayAppId: document.getElementById('ebayAppId').value.trim(),
        ebayClientSecret: document.getElementById('ebayClientSecret').value.trim(),
        ebaySellerUsername: document.getElementById('ebaySellerUsername').value.trim(),
        epnCampaignId: document.getElementById('epnCampaignId').value.trim(),
        proxyUrl: document.getElementById('proxyUrl').value.trim()
    };

    // Save admin key to localStorage only (never synced to KV)
    const adminKey = document.getElementById('adminKey').value.trim();
    if (adminKey) {
        localStorage.setItem('adminKey', adminKey);
    }

    // Validate required fields
    if (!settings.ebayAppId || !settings.ebayClientSecret || !settings.ebaySellerUsername ||
        !settings.epnCampaignId || !settings.proxyUrl) {
        alert('Please fill in all eBay settings fields');
        return;
    }

    // Validate proxy URL format
    try {
        new URL(settings.proxyUrl);
    } catch (e) {
        alert('Invalid Proxy URL. Please enter a valid URL (e.g., https://your-worker.workers.dev)');
        return;
    }

    // Save to localStorage (local cache)
    localStorage.setItem('ebaySettings', JSON.stringify(settings));

    // Sync to Worker KV
    postToWorker('/settings', settings);

    // Show success message
    const resultDiv = document.getElementById('ebayTestResult');
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">✓ eBay settings saved successfully!</div>';

    // Clear message after 3 seconds
    setTimeout(() => {
        resultDiv.innerHTML = '';
    }, 3000);
}

/**
 * Test eBay API connection
 */
async function testEbayConnection() {
    const resultDiv = document.getElementById('ebayTestResult');
    const settings = JSON.parse(localStorage.getItem('ebaySettings') || '{}');

    // Validate settings exist
    if (!settings.proxyUrl || !settings.ebaySellerUsername) {
        resultDiv.innerHTML = '<div style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px;">⚠ Please save your eBay settings first</div>';
        return;
    }

    // Show loading state
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; border-radius: 8px;">⏳ Testing connection to eBay API...</div>';

    try {
        // Test proxy health endpoint first
        const healthUrl = settings.proxyUrl.replace(/\/$/, '') + '/health';
        const healthResponse = await fetch(healthUrl);

        if (!healthResponse.ok) {
            throw new Error(`Proxy not responding. Status: ${healthResponse.status}`);
        }

        // Test listings endpoint
        const listingsUrl = `${settings.proxyUrl.replace(/\/$/, '')}/listings?seller=${encodeURIComponent(settings.ebaySellerUsername)}&limit=5`;
        const listingsResponse = await fetch(listingsUrl);

        if (!listingsResponse.ok) {
            const errorText = await listingsResponse.text();
            throw new Error(`API request failed: ${listingsResponse.status} - ${errorText}`);
        }

        const data = await listingsResponse.json();

        // Check for errors in response
        if (data.error) {
            throw new Error(data.error);
        }

        // Success!
        const itemCount = data.total || 0;
        resultDiv.innerHTML = `
            <div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">
                <strong>✓ Connection successful!</strong><br>
                Found ${itemCount} listing${itemCount !== 1 ? 's' : ''} for seller "${settings.ebaySellerUsername}"<br>
                <small>Your eBay integration is working correctly.</small>
            </div>
        `;

    } catch (error) {
        console.error('eBay connection test failed:', error);
        resultDiv.innerHTML = `
            <div style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px;">
                <strong>✗ Connection failed</strong><br>
                Error: ${error.message}<br>
                <small>Check your proxy URL and ensure the Cloudflare Worker is deployed correctly.</small>
            </div>
        `;
    }
}

// ==============================
// EBAY CURATION
// ==============================

/**
 * Load eBay listings for curation in admin panel
 */
async function loadEbayListingsForCuration() {
    const container = document.getElementById('ebay-curation-container');
    const stats = document.getElementById('ebay-curation-stats');
    const settings = JSON.parse(localStorage.getItem('ebaySettings') || '{}');

    // Check if eBay is configured
    if (!settings.proxyUrl || !settings.ebaySellerUsername) {
        container.innerHTML = `
            <div style="background: #fee; border: 2px solid #c33; border-radius: 12px; padding: 2rem; text-align: center; color: #721c24;">
                <h3>⚙️ eBay Not Configured</h3>
                <p>Please configure eBay settings first in the Settings section.</p>
            </div>
        `;
        return;
    }

    // Show loading state
    container.innerHTML = '<div style="text-align: center; padding: 4rem; color: var(--maroon);"><h3>⏳ Loading eBay listings...</h3></div>';
    stats.textContent = '';

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

        // Load approved items from localStorage
        const approvedItems = JSON.parse(localStorage.getItem('ebayApprovedItems') || '[]');

        // Render curation interface
        renderEbayCurationList(data.items, approvedItems);

        // Update stats
        const approvedCount = data.items.filter(item => approvedItems.includes(item.itemId)).length;
        stats.textContent = `${approvedCount} of ${data.items.length} items approved for display`;

    } catch (error) {
        console.error('Failed to load eBay listings for curation:', error);
        container.innerHTML = `
            <div style="background: #fee; border: 2px solid #c33; border-radius: 12px; padding: 2rem; text-align: center; color: #721c24;">
                <h3>✗ Failed to Load Listings</h3>
                <p>Error: ${error.message}</p>
                <p style="font-size: 0.9rem; margin-top: 1rem;">Check your eBay settings and Cloudflare Worker configuration.</p>
            </div>
        `;
    }
}

/**
 * Render eBay curation list
 */
function renderEbayCurationList(items, approvedItems) {
    const container = document.getElementById('ebay-curation-container');

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <h3>📦 No eBay Listings Found</h3>
                <p>Make sure you have active listings on your eBay store.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="ebay-curation-grid">
            ${items.map(item => {
                const isApproved = approvedItems.includes(item.itemId);
                return `
                    <div class="ebay-curation-card ${isApproved ? 'approved' : 'hidden'}">
                        <div class="ebay-curation-image">
                            <img src="${item.image || 'https://via.placeholder.com/200x200?text=No+Image'}"
                                 alt="${escapeHtml(item.title)}"
                                 onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'">
                            <div class="ebay-curation-badge ${isApproved ? 'badge-approved' : 'badge-hidden'}">
                                ${isApproved ? '✓ VISIBLE' : '✕ HIDDEN'}
                            </div>
                        </div>
                        <div class="ebay-curation-info">
                            <h4>${escapeHtml(item.title)}</h4>
                            <p class="price">$${parseFloat(item.price.value).toFixed(2)}</p>
                            <p class="condition">${escapeHtml(item.condition)}</p>
                            <button class="btn-toggle ${isApproved ? 'btn-hide' : 'btn-approve'}"
                                    onclick="toggleEbayListingApproval('${item.itemId}')">
                                ${isApproved ? '✕ Hide from Browse Page' : '✓ Show on Browse Page'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Toggle approval status for an eBay listing
 */
function toggleEbayListingApproval(itemId) {
    let approvedItems = JSON.parse(localStorage.getItem('ebayApprovedItems') || '[]');

    if (approvedItems.includes(itemId)) {
        // Remove from approved list
        approvedItems = approvedItems.filter(id => id !== itemId);
    } else {
        // Add to approved list
        approvedItems.push(itemId);
    }

    // Save to localStorage (local cache)
    localStorage.setItem('ebayApprovedItems', JSON.stringify(approvedItems));

    // Sync to Worker KV
    postToWorker('/approved-items', approvedItems);

    // Reload the curation list to reflect changes
    loadEbayListingsForCuration();
}

/**
 * Helper function to escape HTML (prevent XSS)
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==============================
// DATA MANAGEMENT
// ==============================

/**
 * Clear all inventory, drops, and orders data
 */
function clearAllData() {
    const confirmation = confirm(
        '⚠️ WARNING: This will permanently delete ALL:\n\n' +
        '• Inventory items\n' +
        '• Drops (draft, scheduled, live)\n' +
        '• Orders\n' +
        '• Seller submissions\n\n' +
        'Your eBay settings will NOT be affected.\n\n' +
        'Are you absolutely sure you want to continue?'
    );

    if (!confirmation) {
        return;
    }

    const doubleCheck = confirm(
        'This action CANNOT be undone!\n\n' +
        'Click OK to permanently delete all data, or Cancel to keep your data.'
    );

    if (!doubleCheck) {
        return;
    }

    try {
        // Clear all data except eBay settings
        localStorage.setItem('inventory', JSON.stringify([]));
        localStorage.setItem('drops', JSON.stringify([]));
        localStorage.setItem('orders', JSON.stringify([]));
        localStorage.setItem('sellerSubmissions', JSON.stringify([]));
        localStorage.setItem('syndicatedListings', JSON.stringify([]));

        // Reset dropdown countdown to 7 days from now
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
        localStorage.setItem('dropCountdown', defaultDate.toISOString());

        alert('✅ All data has been cleared successfully!\n\nThe page will now reload.');

        // Reload the page to reflect changes
        location.reload();

    } catch (error) {
        console.error('Error clearing data:', error);
        alert('❌ Error clearing data: ' + error.message);
    }
}

// ==============================
// SHIPPO SHIPPING INTEGRATION
// ==============================

/**
 * Load Shippo settings from localStorage
 */
function loadShippoSettings() {
    const settings = JSON.parse(localStorage.getItem('shippoSettings') || '{}');

    if (document.getElementById('shippoApiKey')) {
        document.getElementById('shippoApiKey').value = settings.shippoApiKey || '';
        document.getElementById('shipFromStreet').value = settings.shipFromStreet || '5610 De Soto St';
        document.getElementById('shipFromCity').value = settings.shipFromCity || 'Burke';
        document.getElementById('shipFromState').value = settings.shipFromState || 'VA';
        document.getElementById('shipFromZip').value = settings.shipFromZip || '22015';
        document.getElementById('shipFromEmail').value = settings.shipFromEmail || '';
        document.getElementById('shipFromPhone').value = settings.shipFromPhone || '';
        document.getElementById('shippoDefaultService').value = settings.shippoDefaultService || 'usps_first';
        document.getElementById('shippoDefaultLength').value = settings.shippoDefaultLength || '12';
        document.getElementById('shippoDefaultWidth').value = settings.shippoDefaultWidth || '10';
        document.getElementById('shippoDefaultHeight').value = settings.shippoDefaultHeight || '3';
        document.getElementById('shippoDefaultWeight').value = settings.shippoDefaultWeight || '1';
    }
}

/**
 * Save Shippo settings to localStorage
 */
function saveShippoSettings() {
    const settings = {
        shippoApiKey: document.getElementById('shippoApiKey').value.trim(),
        shipFromStreet: document.getElementById('shipFromStreet').value.trim(),
        shipFromCity: document.getElementById('shipFromCity').value.trim(),
        shipFromState: document.getElementById('shipFromState').value.trim().toUpperCase(),
        shipFromZip: document.getElementById('shipFromZip').value.trim(),
        shipFromEmail: document.getElementById('shipFromEmail').value.trim(),
        shipFromPhone: document.getElementById('shipFromPhone').value.trim(),
        shippoDefaultService: document.getElementById('shippoDefaultService').value,
        shippoDefaultLength: document.getElementById('shippoDefaultLength').value,
        shippoDefaultWidth: document.getElementById('shippoDefaultWidth').value,
        shippoDefaultHeight: document.getElementById('shippoDefaultHeight').value,
        shippoDefaultWeight: document.getElementById('shippoDefaultWeight').value
    };

    // Validate required fields
    if (!settings.shippoApiKey || !settings.shipFromStreet || !settings.shipFromCity ||
        !settings.shipFromState || !settings.shipFromZip) {
        alert('Please fill in all required Shippo settings (API key and ship-from address)');
        return;
    }

    // Validate state is 2 characters
    if (settings.shipFromState.length !== 2) {
        alert('State must be 2 letters (e.g., VA)');
        return;
    }

    // Validate email OR phone is provided (required by USPS)
    if (!settings.shipFromEmail && !settings.shipFromPhone) {
        alert('USPS requires either an email address OR phone number for shipping labels. Please provide at least one.');
        return;
    }

    // Save to localStorage
    localStorage.setItem('shippoSettings', JSON.stringify(settings));

    // Show success message
    const resultDiv = document.getElementById('shippoTestResult');
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">✓ Shippo settings saved successfully!</div>';

    // Clear message after 3 seconds
    setTimeout(() => {
        resultDiv.innerHTML = '';
    }, 3000);
}

/**
 * Test Shippo API connection
 */
async function testShippoConnection() {
    const resultDiv = document.getElementById('shippoTestResult');
    const settings = JSON.parse(localStorage.getItem('shippoSettings') || '{}');

    if (!settings.shippoApiKey) {
        resultDiv.innerHTML = '<div style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px;">⚠ Please save your Shippo API key first</div>';
        return;
    }

    // Show loading state
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; border-radius: 8px;">⏳ Testing Shippo connection...</div>';

    try {
        // Test API by fetching carrier accounts
        const response = await fetch('https://api.goshippo.com/carrier_accounts/', {
            method: 'GET',
            headers: {
                'Authorization': `ShippoToken ${settings.shippoApiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `API Error: ${response.status}`);
        }

        const data = await response.json();
        const carrierCount = data.results ? data.results.length : 0;

        // Success!
        resultDiv.innerHTML = `
            <div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">
                <strong>✓ Connection successful!</strong><br>
                Connected to Shippo API<br>
                Found ${carrierCount} carrier account${carrierCount !== 1 ? 's' : ''}<br>
                <small>API Key: ${settings.shippoApiKey.substring(0, 20)}...</small><br>
                <small>Ship From: ${settings.shipFromCity}, ${settings.shipFromState}</small>
            </div>
        `;

    } catch (error) {
        console.error('Shippo connection test failed:', error);
        resultDiv.innerHTML = `
            <div style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px;">
                <strong>✗ Connection failed</strong><br>
                Error: ${error.message}<br>
                <small>Check your API key and try again.</small>
            </div>
        `;
    }
}

// GOOGLE PLACES API SETTINGS
function loadGooglePlacesSettings() {
    const settings = JSON.parse(localStorage.getItem('googlePlacesSettings') || '{}');

    if (settings.apiKey) {
        document.getElementById('googlePlacesApiKey').value = settings.apiKey;
    }

    // Load enabled state
    const enabled = settings.enabled !== false; // Default to true
    document.getElementById('googlePlacesEnabled').checked = enabled;

    // Show/hide API key section based on enabled state
    const keySection = document.getElementById('googlePlacesKeySection');
    if (keySection) {
        keySection.style.display = enabled ? 'block' : 'none';
    }
}

function toggleGooglePlaces() {
    const enabled = document.getElementById('googlePlacesEnabled').checked;
    const settings = JSON.parse(localStorage.getItem('googlePlacesSettings') || '{}');
    settings.enabled = enabled;
    localStorage.setItem('googlePlacesSettings', JSON.stringify(settings));

    // Show/hide API key section
    const keySection = document.getElementById('googlePlacesKeySection');
    if (keySection) {
        keySection.style.display = enabled ? 'block' : 'none';
    }

    const statusDiv = document.getElementById('googlePlacesStatus');
    if (enabled) {
        statusDiv.innerHTML = `
            <div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">
                <strong>✓ Address Autocomplete Enabled</strong><br>
                <small>Reload the page for changes to take effect</small>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div style="padding: 1rem; background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; border-radius: 8px;">
                <strong>Address Autocomplete Disabled</strong><br>
                <small>Customers will type addresses manually. Reload the page for changes to take effect.</small>
            </div>
        `;
    }
}

function saveGooglePlacesSettings() {
    const apiKey = document.getElementById('googlePlacesApiKey').value.trim();

    if (!apiKey) {
        alert('Please enter a Google Places API key');
        return;
    }

    if (!apiKey.startsWith('AIza')) {
        if (!confirm('This doesn\'t look like a Google API key (should start with "AIza"). Save anyway?')) {
            return;
        }
    }

    const settings = {
        apiKey: apiKey,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('googlePlacesSettings', JSON.stringify(settings));

    const statusDiv = document.getElementById('googlePlacesStatus');
    statusDiv.innerHTML = `
        <div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">
            <strong>✓ API Key saved!</strong><br>
            <small>Reload the page to activate address autocomplete</small>
        </div>
    `;

    console.log('Google Places settings saved');
}

function applyGooglePlacesKey() {
    const apiKey = document.getElementById('googlePlacesApiKey').value.trim();

    if (!apiKey) {
        alert('Please enter a Google Places API key first');
        return;
    }

    // Save first
    saveGooglePlacesSettings();

    // Reload to apply the API key
    const statusDiv = document.getElementById('googlePlacesStatus');
    statusDiv.innerHTML = `
        <div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">
            <strong>✓ API Key saved!</strong><br>
            Click below to reload and activate address autocomplete<br>
            <button class="btn-primary" onclick="location.reload()" style="margin-top: 0.5rem;">Reload Page</button>
        </div>
    `;
}


// ==========================================
//  HOKIES EVENTS MANAGEMENT
// ==========================================

// Load and display events in admin panel
function loadAdminEvents() {
    const events = JSON.parse(localStorage.getItem('hokiesEvents') || '[]');
    const container = document.getElementById('adminEventsList');

    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: #666;">
                <p>No events yet. Click "+ Add Event" to create one.</p>
            </div>
        `;
        return;
    }

    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    container.innerHTML = events.map(event => `
        <div class="event-card" style="background: white; border: 2px solid #E8E6E1; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3 style="color: var(--maroon); margin-bottom: 0.5rem;">${event.name}</h3>
                    <p style="color: #666; margin-bottom: 0.5rem;">
                        <strong>Date:</strong> ${new Date(event.date).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        })}
                    </p>
                    ${event.location ? `<p style="color: #666; margin-bottom: 0.5rem;"><strong>Location:</strong> ${event.location}</p>` : ''}
                    ${event.description ? `<p style="color: #666; margin-bottom: 0.5rem;">${event.description}</p>` : ''}
                    ${event.link ? `<p><a href="${event.link}" target="_blank" style="color: var(--orange);">Event Link →</a></p>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editEvent('${event.id}')" class="btn-secondary" style="padding: 0.5rem 1rem;">Edit</button>
                    <button onclick="deleteEvent('${event.id}')" class="btn-danger" style="padding: 0.5rem 1rem; background: #c33; color: white; border: none; border-radius: 5px; cursor: pointer;">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

// Open event modal
function openEventModal() {
    document.getElementById('eventModalTitle').textContent = 'Add Hokies Event';
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('eventModal').style.display = 'block';
}

// Close event modal
function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    document.getElementById('eventForm').reset();
}

// Edit event
function editEvent(eventId) {
    const events = JSON.parse(localStorage.getItem('hokiesEvents') || '[]');
    const event = events.find(e => e.id === eventId);

    if (!event) return;

    document.getElementById('eventModalTitle').textContent = 'Edit Hokies Event';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventName').value = event.name;

    // Convert date to datetime-local format
    const date = new Date(event.date);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset*60*1000));
    document.getElementById('eventDate').value = localDate.toISOString().slice(0, 16);

    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventLink').value = event.link || '';

    document.getElementById('eventModal').style.display = 'block';
}

// Delete event
function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;

    let events = JSON.parse(localStorage.getItem('hokiesEvents') || '[]');
    events = events.filter(e => e.id !== eventId);
    localStorage.setItem('hokiesEvents', JSON.stringify(events));

    loadAdminEvents();
    alert('Event deleted successfully!');
}

// Handle event form submission
document.addEventListener('DOMContentLoaded', function() {
    const eventForm = document.getElementById('eventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const eventId = document.getElementById('eventId').value;
            const eventData = {
                id: eventId || Date.now().toString(),
                name: document.getElementById('eventName').value,
                date: document.getElementById('eventDate').value,
                location: document.getElementById('eventLocation').value,
                description: document.getElementById('eventDescription').value,
                link: document.getElementById('eventLink').value
            };

            let events = JSON.parse(localStorage.getItem('hokiesEvents') || '[]');

            if (eventId) {
                // Update existing event
                const index = events.findIndex(e => e.id === eventId);
                if (index !== -1) {
                    events[index] = eventData;
                }
            } else {
                // Add new event
                events.push(eventData);
            }

            localStorage.setItem('hokiesEvents', JSON.stringify(events));

            closeEventModal();
            loadAdminEvents();
            alert(eventId ? 'Event updated successfully!' : 'Event added successfully!');
        });
    }

    // Load events when events section is active
    const eventsMenuItem = document.querySelector('[data-section="events"]');
    if (eventsMenuItem) {
        eventsMenuItem.addEventListener('click', loadAdminEvents);
    }
});
