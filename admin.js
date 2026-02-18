// Admin Panel JavaScript — Supabase Backend

// Worker URL for eBay proxy only
const WORKER_URL = 'https://hokies-thrift-ebay.laurenleoni24.workers.dev';

// ==========================================
// AUTHENTICATION (Supabase Auth)
// ==========================================

let currentUser = null;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentUser.id)
            .single();
        if (profile && profile.is_admin) {
            isAdmin = true;
            showDashboard();
        } else {
            document.getElementById('loginError').textContent = 'This account does not have admin access.';
            await supabase.auth.signOut();
            showLogin();
        }
    } else {
        showLogin();
    }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
        currentUser = null;
        isAdmin = false;
        showLogin();
    }
});

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    if (currentUser) {
        document.querySelector('.user-info').textContent = currentUser.email;
    }
    loadDashboardData();
}

// Handle login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        errorEl.textContent = error.message;
        return;
    }

    currentUser = data.user;
    const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', currentUser.id)
        .single();

    if (!profile || !profile.is_admin) {
        errorEl.textContent = 'This account does not have admin access.';
        await supabase.auth.signOut();
        return;
    }

    isAdmin = true;
    showDashboard();
});

async function logout() {
    await supabase.auth.signOut();
    currentUser = null;
    isAdmin = false;
    showLogin();
}

// ==========================================
// NAVIGATION
// ==========================================

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.getAttribute('data-section');
        switchSection(section);
    });
});

function switchSection(sectionName) {
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

    document.querySelectorAll('.admin-section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionName).classList.add('active');

    if (sectionName === 'drops') { loadDropsManagement(); loadInventory(); }
    if (sectionName === 'orders') loadOrders();
    if (sectionName === 'submissions') loadSubmissions();
    if (sectionName === 'profits') loadProfits();
    if (sectionName === 'syndicated') loadSyndicatedListings();
    if (sectionName === 'events') loadAdminEvents();
    if (sectionName === 'settings') { loadSettings(); loadEbaySettings(); loadShippoSettings(); loadGooglePlacesSettings(); }
}

// ==========================================
// DASHBOARD
// ==========================================

async function loadDashboardData() {
    const { data: orders } = await supabase.from('orders').select('id, total, status');
    const { data: products } = await supabase.from('products').select('id, available');
    const { data: submissions } = await supabase.from('seller_submissions').select('id, status');

    const orderList = orders || [];
    const productList = products || [];
    const submissionList = submissions || [];

    const pendingOrders = orderList.filter(o => o.status === 'pending' || o.status === 'processing').length;
    const completedOrders = orderList.filter(o => o.status === 'delivered').length;
    const totalRevenue = orderList.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const newSubmissions = submissionList.filter(s => s.status === 'pending_admin').length;

    document.getElementById('statPendingOrders').textContent = pendingOrders;
    document.getElementById('statCompletedOrders').textContent = completedOrders;
    document.getElementById('statRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('statActiveListings').textContent = productList.filter(i => i.available).length;
    document.getElementById('statNewSubmissions').textContent = newSubmissions;
}

// ==========================================
// PRODUCT / ITEM MANAGEMENT
// ==========================================

let uploadedImages = []; // File objects for new item creation

function openDropModal() {
    document.getElementById('dropModal').classList.add('active');
    document.getElementById('imagePreview').innerHTML = '';
    uploadedImages = [];
}

function closeDropModal() {
    document.getElementById('dropModal').classList.remove('active');
    document.getElementById('dropForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    uploadedImages = [];
}

// Image preview handler
document.getElementById('itemImages').addEventListener('change', function(e) {
    const files = e.target.files;
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    uploadedImages = [];

    if (files.length > 5) alert('Maximum 5 images allowed. Only first 5 will be used.');

    const fileArray = Array.from(files).slice(0, 5);
    fileArray.forEach((file, index) => {
        uploadedImages.push({ file, index });
        const reader = new FileReader();
        reader.onload = function(event) {
            const container = document.createElement('div');
            container.className = 'image-preview-item';
            container.style.position = 'relative';
            container.style.display = 'inline-block';

            const imgElement = document.createElement('img');
            imgElement.src = event.target.result;
            imgElement.style.cssText = 'width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid var(--gray-300);';
            container.appendChild(imgElement);
            preview.appendChild(container);
        };
        reader.readAsDataURL(file);
    });
});

// Submit new item
document.getElementById('dropForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    if (uploadedImages.length === 0) {
        alert('Please upload at least one image for the item.');
        return;
    }

    const itemId = Date.now().toString();
    const item = {
        id: itemId,
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value,
        price: parseFloat(document.getElementById('itemPrice').value),
        cost: parseFloat(document.getElementById('itemCost').value) || 0,
        category: document.getElementById('itemCategory').value,
        size: document.getElementById('itemSize').value,
        condition: document.getElementById('itemCondition').value,
        available: true,
        drop_id: null,
        created_at: new Date().toISOString()
    };

    // Insert product
    const { error: productError } = await supabase.from('products').insert(item);
    if (productError) {
        alert('Error creating item: ' + productError.message);
        return;
    }

    // Upload images to Storage
    for (let i = 0; i < uploadedImages.length; i++) {
        try {
            const compressed = await compressImage(uploadedImages[i].file);
            const url = await uploadImageFile('product-images', compressed, itemId);
            await supabase.from('product_images').insert({
                product_id: itemId,
                storage_path: url,
                display_order: i
            });
        } catch (imgError) {
            console.error('Image upload error:', imgError);
        }
    }

    closeDropModal();
    loadInventory();
    loadDashboardData();
    alert('Item added successfully!');
});

// Load unassigned inventory
async function loadInventory() {
    const { data: products } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .is('drop_id', null)
        .order('created_at', { ascending: false });

    const grid = document.getElementById('inventoryGrid');
    const items = products || [];

    if (items.length === 0) {
        grid.innerHTML = '<p class="empty-state">All items are assigned to drops. Create new items to add to future drops!</p>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const images = (item.product_images || []).sort((a, b) => a.display_order - b.display_order);
        const firstImage = images.length > 0 ? images[0].storage_path : null;

        return `
        <div class="inventory-item">
            <div class="inventory-item-image" style="position: relative;">
                ${firstImage ? `<img src="${firstImage}" alt="${escapeHtml(item.name)}">` : `<span>No Image</span>`}
                ${images.length > 1 ? `<span style="position: absolute; top: 5px; right: 5px; background: var(--orange); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">+${images.length - 1}</span>` : ''}
            </div>
            <div class="inventory-item-info">
                <h3>${escapeHtml(item.name)}</h3>
                <p>${escapeHtml((item.description || '').substring(0, 80))}...</p>
                <p class="inventory-item-price">$${parseFloat(item.price).toFixed(2)}</p>
                <p><small>Size: ${item.size || 'N/A'} | Condition: ${item.condition}</small></p>
                <p><small>Cost: $${parseFloat(item.cost).toFixed(2)} | Profit: $${(item.price - item.cost).toFixed(2)}</small></p>
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
        </div>`;
    }).join('');
}

async function markAsSold(itemId) {
    await supabase.from('products').update({ available: false }).eq('id', itemId);
    loadInventory();
    loadDashboardData();
}

async function markAsAvailable(itemId) {
    await supabase.from('products').update({ available: true }).eq('id', itemId);
    loadInventory();
    loadDashboardData();
}

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    // Delete images from storage
    const { data: images } = await supabase.from('product_images').select('storage_path').eq('product_id', itemId);
    if (images) {
        for (const img of images) {
            const path = img.storage_path.split('/storage/v1/object/public/product-images/')[1];
            if (path) await supabase.storage.from('product-images').remove([path]);
        }
    }
    await supabase.from('products').delete().eq('id', itemId);
    loadInventory();
    loadDashboardData();
}

// ==========================================
// EDIT INVENTORY ITEM
// ==========================================

let editUploadedImages = []; // { url, isExisting, file }
let currentEditItemId = null;

async function editInventoryItem(itemId) {
    const { data: item } = await supabase
        .from('products')
        .select('*, product_images(*)')
        .eq('id', itemId)
        .single();

    if (!item) { alert('Item not found'); return; }

    currentEditItemId = itemId;

    document.getElementById('editItemId').value = item.id;
    document.getElementById('editItemName').value = item.name;
    document.getElementById('editItemDescription').value = item.description || '';
    document.getElementById('editItemPrice').value = item.price;
    document.getElementById('editItemCost').value = item.cost || 0;
    document.getElementById('editItemCategory').value = item.category || 'other';
    document.getElementById('editItemSize').value = item.size || '';
    document.getElementById('editItemCondition').value = item.condition || 'good';

    const images = (item.product_images || []).sort((a, b) => a.display_order - b.display_order);
    editUploadedImages = images.map((img, idx) => ({
        url: img.storage_path,
        isExisting: true,
        imageId: img.id,
        index: idx
    }));

    renderEditImagePreviews();
    document.getElementById('editInventoryModal').classList.add('active');
}

function renderEditImagePreviews() {
    const preview = document.getElementById('editImagePreview');
    preview.innerHTML = '';

    if (editUploadedImages.length === 0) {
        preview.innerHTML = '<p style="color: #666;">No photos yet. Upload photos below.</p>';
        return;
    }

    editUploadedImages.forEach((img, index) => {
        const container = document.createElement('div');
        container.className = 'image-preview-item';
        container.style.cssText = 'position:relative;display:inline-block;';

        const imgElement = document.createElement('img');
        imgElement.src = img.url || '';
        imgElement.style.cssText = 'width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid var(--gray-300);';

        const badge = document.createElement('span');
        badge.style.cssText = `position:absolute;top:5px;left:5px;background:${index === 0 ? 'var(--orange)' : 'var(--maroon)'};color:white;padding:2px 8px;border-radius:12px;font-size:0.75rem;font-weight:bold;`;
        badge.textContent = index === 0 ? 'MAIN' : (index + 1);

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.cssText = 'position:absolute;top:5px;right:5px;background:var(--danger);color:white;border:none;border-radius:50%;width:24px;height:24px;cursor:pointer;font-size:1rem;line-height:1;';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            editUploadedImages.splice(index, 1);
            renderEditImagePreviews();
        };

        container.appendChild(imgElement);
        container.appendChild(badge);
        container.appendChild(deleteBtn);
        preview.appendChild(container);
    });
}

function closeEditInventoryModal() {
    document.getElementById('editInventoryModal').classList.remove('active');
    document.getElementById('editInventoryForm').reset();
    editUploadedImages = [];
    currentEditItemId = null;
}

// Handle new photo uploads in edit modal
document.getElementById('editItemImages').addEventListener('change', async function(e) {
    const files = e.target.files;
    if (editUploadedImages.length + files.length > 5) {
        alert('Maximum 5 images allowed.');
    }

    const remainingSlots = 5 - editUploadedImages.length;
    const fileArray = Array.from(files).slice(0, remainingSlots);

    for (const file of fileArray) {
        const reader = new FileReader();
        const dataUrl = await new Promise(resolve => {
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(file);
        });
        editUploadedImages.push({
            url: dataUrl,
            isExisting: false,
            file: file,
            index: editUploadedImages.length
        });
    }
    renderEditImagePreviews();
});

// Handle edit form submission
document.getElementById('editInventoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const updates = {
        name: document.getElementById('editItemName').value,
        description: document.getElementById('editItemDescription').value,
        price: parseFloat(document.getElementById('editItemPrice').value),
        cost: parseFloat(document.getElementById('editItemCost').value) || 0,
        category: document.getElementById('editItemCategory').value,
        size: document.getElementById('editItemSize').value,
        condition: document.getElementById('editItemCondition').value,
    };

    await supabase.from('products').update(updates).eq('id', currentEditItemId);

    // Handle images: delete removed ones, upload new ones
    const { data: existingImages } = await supabase.from('product_images').select('*').eq('product_id', currentEditItemId);
    const keepImageIds = editUploadedImages.filter(i => i.isExisting).map(i => i.imageId);

    // Delete removed images
    for (const existing of (existingImages || [])) {
        if (!keepImageIds.includes(existing.id)) {
            const path = existing.storage_path.split('/storage/v1/object/public/product-images/')[1];
            if (path) await supabase.storage.from('product-images').remove([path]);
            await supabase.from('product_images').delete().eq('id', existing.id);
        }
    }

    // Upload new images and update display_order
    for (let i = 0; i < editUploadedImages.length; i++) {
        const img = editUploadedImages[i];
        if (img.isExisting) {
            await supabase.from('product_images').update({ display_order: i }).eq('id', img.imageId);
        } else {
            const compressed = await compressImage(img.file);
            const url = await uploadImageFile('product-images', compressed, currentEditItemId);
            await supabase.from('product_images').insert({
                product_id: currentEditItemId,
                storage_path: url,
                display_order: i
            });
        }
    }

    alert('Item updated successfully!');
    closeEditInventoryModal();
    loadInventory();
});

// ==========================================
// DROP MANAGEMENT SYSTEM
// ==========================================

async function loadDropsManagement() {
    const { data: drops } = await supabase
        .from('drops')
        .select('*, drop_items(product_id)')
        .order('created_at', { ascending: false });

    const allDrops = drops || [];

    const draftDrops = allDrops.filter(d => d.status === 'draft');
    const scheduledDrops = allDrops.filter(d => d.status === 'scheduled').sort((a, b) =>
        new Date(a.scheduled_date) - new Date(b.scheduled_date)
    );
    const liveDrops = allDrops.filter(d => d.status === 'live').sort((a, b) =>
        new Date(b.activated_date) - new Date(a.activated_date)
    );

    await renderDropCategory('draftDropsContainer', draftDrops, 'draft');
    await renderDropCategory('scheduledDropsContainer', scheduledDrops, 'scheduled');
    await renderDropCategory('liveDropsContainer', liveDrops, 'live');

    startDropCountdowns();
}

async function renderDropCategory(containerId, drops, status) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (drops.length === 0) {
        container.innerHTML = '<p class="empty-state">No ' + status + ' drops</p>';
        return;
    }

    // Get product availability info
    const allProductIds = drops.flatMap(d => (d.drop_items || []).map(di => di.product_id));
    let productMap = {};
    if (allProductIds.length > 0) {
        const { data: products } = await supabase.from('products').select('id, available').in('id', allProductIds);
        (products || []).forEach(p => { productMap[p.id] = p; });
    }

    container.innerHTML = drops.map(drop => {
        const itemIds = (drop.drop_items || []).map(di => di.product_id);
        const availableCount = itemIds.filter(id => productMap[id] && productMap[id].available).length;

        let html = `<div class="drop-card" data-drop-id="${drop.id}">
            <h3>${escapeHtml(drop.name)}</h3>`;

        if (drop.description) html += `<p class="drop-description">${escapeHtml(drop.description)}</p>`;

        if (status === 'draft') {
            html += `
                <p class="drop-stats">${itemIds.length} items selected</p>
                <div class="drop-actions">
                    <button class="btn-primary" onclick="editDrop('${drop.id}')">Edit</button>
                    <button class="btn-secondary" onclick="scheduleDrop('${drop.id}')">Schedule</button>
                    <button class="btn-danger" onclick="deleteDrop('${drop.id}')">Delete</button>
                </div>`;
        }

        if (status === 'scheduled') {
            html += `
                <div class="drop-countdown" id="countdown-${drop.id}">Calculating...</div>
                <p class="drop-stats">${itemIds.length} items | ${new Date(drop.scheduled_date).toLocaleString()}</p>
                <div class="drop-actions">
                    <button class="btn-success" onclick="viewDropItems('${drop.id}')">View Items</button>
                    <button class="btn-secondary" onclick="editDropSchedule('${drop.id}')">Edit Schedule</button>
                    <button class="btn-danger" onclick="cancelScheduledDrop('${drop.id}')">Cancel</button>
                </div>`;
        }

        if (status === 'live') {
            html += `
                <p class="drop-live-badge">🔴 LIVE NOW</p>
                <p class="drop-stats">${availableCount}/${itemIds.length} items remaining</p>
                <p class="drop-meta">Activated: ${new Date(drop.activated_date).toLocaleString()}</p>
                <div class="drop-actions">
                    <button class="btn-success" onclick="viewDropItems('${drop.id}')">View Items</button>
                    <button class="btn-secondary" onclick="completeDrop('${drop.id}')">Mark Complete</button>
                </div>`;
        }

        html += `</div>`;
        return html;
    }).join('');
}

// Drop Editor
let currentEditingDropId = null;

function openDropEditor(dropId = null) {
    const modal = document.getElementById('dropEditorModal');
    modal.classList.add('active');
    currentEditingDropId = dropId;

    if (dropId) {
        supabase.from('drops').select('*').eq('id', dropId).single().then(({ data: drop }) => {
            if (drop) {
                document.getElementById('dropEditorTitle').textContent = 'Edit Drop';
                document.getElementById('dropName').value = drop.name;
                document.getElementById('dropDescription').value = drop.description || '';
                document.getElementById('btnSaveDrop').textContent = 'Update Drop';
            }
        });
    } else {
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

function showDropStep(stepNum) {
    document.querySelectorAll('.drop-step').forEach(step => step.classList.remove('active'));
    const stepEl = document.getElementById('dropStep' + stepNum);
    if (stepEl) stepEl.classList.add('active');
    if (stepNum === 2) loadDropItemSelection();
}

function nextDropStep(stepNum) {
    if (stepNum === 2) {
        if (!document.getElementById('dropName').value.trim()) {
            alert('Please enter a drop name');
            return;
        }
    } else if (stepNum === 3) {
        const selectedCount = getSelectedDropItems().length;
        if (selectedCount < 1 || selectedCount > 10) {
            alert('Please select between 1-10 items');
            return;
        }
        updateDropPreview();
    }
    showDropStep(stepNum);
}

function prevDropStep(stepNum) { showDropStep(stepNum); }

async function loadDropItemSelection() {
    // Get products that are either unassigned or in the current drop
    let query = supabase.from('products').select('*, product_images(*)');

    const { data: products } = await query.order('created_at', { ascending: false });
    const items = (products || []).filter(item => !item.drop_id || item.drop_id === currentEditingDropId);

    const container = document.getElementById('dropItemSelection');

    if (items.length === 0) {
        container.innerHTML = '<p class="empty-state">No unassigned items available.</p>';
        return;
    }

    container.innerHTML = items.map(item => {
        const images = (item.product_images || []).sort((a, b) => a.display_order - b.display_order);
        const firstImage = images.length > 0 ? images[0].storage_path : null;
        const isCurrentlyInDrop = currentEditingDropId && item.drop_id === currentEditingDropId;

        return `
            <label class="item-select-card">
                <input type="checkbox" value="${item.id}" onchange="updateDropItemCount()" ${isCurrentlyInDrop ? 'checked' : ''}>
                <div class="item-select-preview">
                    ${firstImage ? `<img src="${firstImage}" alt="${escapeHtml(item.name)}">` : `<div class="placeholder-icon">${item.category}</div>`}
                </div>
                <div class="item-select-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span class="price">$${parseFloat(item.price).toFixed(2)}</span>
                    <small>${item.size || 'N/A'} | ${item.condition}</small>
                </div>
            </label>`;
    }).join('');

    updateDropItemCount();
}

function updateDropItemCount() {
    const selected = getSelectedDropItems();
    const count = selected.length;
    document.getElementById('selectedCount').textContent = count;

    const warning = document.getElementById('selectionWarning');
    const btnContinue = document.getElementById('btnContinueItems');

    if (count < 1) {
        warning.textContent = 'Minimum 1 item required';
        warning.style.color = 'var(--danger)';
        btnContinue.disabled = true;
    } else if (count > 10) {
        warning.textContent = 'Maximum 10 items allowed';
        warning.style.color = 'var(--danger)';
        btnContinue.disabled = true;
    } else {
        warning.textContent = 'Valid selection';
        warning.style.color = 'var(--success)';
        btnContinue.disabled = false;
    }
}

function getSelectedDropItems() {
    return Array.from(document.querySelectorAll('#dropItemSelection input[type="checkbox"]:checked')).map(cb => cb.value);
}

function updateDropPreview() {
    document.getElementById('previewName').textContent = document.getElementById('dropName').value.trim();
    document.getElementById('previewItemCount').textContent = getSelectedDropItems().length + ' items';
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;
    document.getElementById('previewStatus').textContent = scheduleType === 'draft' ? 'Draft' : scheduleType === 'schedule' ? 'Scheduled' : 'Live (Immediate)';
}

async function saveDrop() {
    const dropId = currentEditingDropId || 'drop_' + Date.now();
    const name = document.getElementById('dropName').value.trim();
    const description = document.getElementById('dropDescription').value.trim();
    const itemIds = getSelectedDropItems();
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;

    if (!name || itemIds.length < 1 || itemIds.length > 10) return;

    let status = 'draft';
    let scheduled_date = null;
    let activated_date = null;

    if (scheduleType === 'schedule') {
        const dateInput = document.getElementById('dropScheduleDate').value;
        if (!dateInput) { alert('Please select a schedule date'); return; }
        const selectedDate = new Date(dateInput);
        if (selectedDate <= new Date()) { alert('Please select a future date'); return; }
        scheduled_date = selectedDate.toISOString();
        status = 'scheduled';
    } else if (scheduleType === 'now') {
        status = 'live';
        activated_date = new Date().toISOString();
    }

    const dropData = {
        id: dropId,
        name,
        description: description || null,
        status,
        scheduled_date,
        activated_date,
        updated_at: new Date().toISOString()
    };

    if (currentEditingDropId) {
        await supabase.from('drops').update(dropData).eq('id', dropId);
    } else {
        dropData.created_at = new Date().toISOString();
        await supabase.from('drops').insert(dropData);
    }

    // Update drop_items junction table
    await supabase.from('drop_items').delete().eq('drop_id', dropId);
    if (itemIds.length > 0) {
        await supabase.from('drop_items').insert(itemIds.map(pid => ({ drop_id: dropId, product_id: pid })));
    }

    // Update products' drop_id
    // Clear old assignments
    await supabase.from('products').update({ drop_id: null }).eq('drop_id', dropId);
    // Set new assignments
    for (const pid of itemIds) {
        await supabase.from('products').update({ drop_id: dropId }).eq('id', pid);
    }

    closeDropEditor();
    loadDropsManagement();

    let message = `Drop "${name}" ${currentEditingDropId ? 'updated' : 'created'} successfully!`;
    if (status === 'live') message += '\n\nThe drop is now LIVE on your shop page!';
    else if (status === 'scheduled') message += '\n\nCountdown started!';
    alert(message);
}

function editDrop(dropId) { openDropEditor(dropId); }

async function scheduleDrop(dropId) {
    const dateInput = prompt('Enter drop date and time (YYYY-MM-DD HH:MM):');
    if (!dateInput) return;
    try {
        const scheduledDate = new Date(dateInput);
        if (scheduledDate <= new Date()) { alert('Please select a future date'); return; }
        await supabase.from('drops').update({
            status: 'scheduled',
            scheduled_date: scheduledDate.toISOString(),
            updated_at: new Date().toISOString()
        }).eq('id', dropId);
        loadDropsManagement();
    } catch (e) { alert('Invalid date format.'); }
}

async function deleteDrop(dropId) {
    const { data: drop } = await supabase.from('drops').select('name, status').eq('id', dropId).single();
    if (!drop) return;
    if (drop.status === 'live') { alert('Cannot delete a live drop.'); return; }
    if (!confirm(`Delete "${drop.name}"? Items will be unassigned.`)) return;

    await supabase.from('products').update({ drop_id: null }).eq('drop_id', dropId);
    await supabase.from('drops').delete().eq('id', dropId);
    loadDropsManagement();
    loadInventory();
}

async function completeDrop(dropId) {
    const { data: drop } = await supabase.from('drops').select('name').eq('id', dropId).single();
    if (!drop || !confirm(`Mark "${drop.name}" as complete?`)) return;

    await supabase.from('drops').update({
        status: 'completed',
        completed_date: new Date().toISOString()
    }).eq('id', dropId);
    loadDropsManagement();
}

async function activateDrop(dropId) {
    await supabase.from('drops').update({
        status: 'live',
        activated_date: new Date().toISOString()
    }).eq('id', dropId);

    if (dropCountdownIntervals[dropId]) {
        clearInterval(dropCountdownIntervals[dropId]);
        delete dropCountdownIntervals[dropId];
    }
    loadDropsManagement();
}

async function viewDropItems(dropId) {
    const { data: drop } = await supabase.from('drops').select('name').eq('id', dropId).single();
    const { data: items } = await supabase
        .from('drop_items')
        .select('product_id, products(name, price, available)')
        .eq('drop_id', dropId);

    const itemsList = (items || []).map(di =>
        `- ${di.products.name} ($${parseFloat(di.products.price).toFixed(2)}) - ${di.products.available ? 'Available' : 'Sold'}`
    ).join('\n');

    alert(`Items in "${drop.name}":\n\n${itemsList}`);
}

async function editDropSchedule(dropId) {
    const { data: drop } = await supabase.from('drops').select('scheduled_date').eq('id', dropId).single();
    if (!drop) return;
    const dateInput = prompt(`Current: ${new Date(drop.scheduled_date).toLocaleString()}\nNew date (YYYY-MM-DD HH:MM):`);
    if (!dateInput) return;
    try {
        const newDate = new Date(dateInput);
        if (newDate <= new Date()) { alert('Pick a future date'); return; }
        await supabase.from('drops').update({ scheduled_date: newDate.toISOString(), updated_at: new Date().toISOString() }).eq('id', dropId);
        loadDropsManagement();
    } catch (e) { alert('Invalid date.'); }
}

async function cancelScheduledDrop(dropId) {
    const { data: drop } = await supabase.from('drops').select('name').eq('id', dropId).single();
    if (!drop || !confirm(`Cancel scheduling for "${drop.name}"?`)) return;

    await supabase.from('drops').update({ status: 'draft', scheduled_date: null, updated_at: new Date().toISOString() }).eq('id', dropId);
    if (dropCountdownIntervals[dropId]) {
        clearInterval(dropCountdownIntervals[dropId]);
        delete dropCountdownIntervals[dropId];
    }
    loadDropsManagement();
}

// Handle schedule type change
document.addEventListener('change', function(e) {
    if (e.target.name === 'scheduleType') {
        document.getElementById('scheduleDatePicker').style.display = e.target.value === 'schedule' ? 'block' : 'none';
    }
});

// Countdown timers
let dropCountdownIntervals = {};

function startDropCountdowns() {
    Object.values(dropCountdownIntervals).forEach(i => clearInterval(i));
    dropCountdownIntervals = {};

    document.querySelectorAll('.drop-countdown').forEach(el => {
        const dropId = el.id.replace('countdown-', '');
        const interval = setInterval(async () => {
            const { data } = await supabase.from('drops').select('scheduled_date').eq('id', dropId).single();
            if (!data) return;
            const now = Date.now();
            const target = new Date(data.scheduled_date).getTime();
            const distance = target - now;

            if (distance <= 0) {
                activateDrop(dropId);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            el.innerHTML = `<strong>Drops in:</strong> ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
        dropCountdownIntervals[dropId] = interval;
    });
}

// ==========================================
// ORDERS
// ==========================================

async function loadOrders() {
    const { data: orders } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('ordersTableBody');
    const orderList = orders || [];

    if (orderList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No orders yet</td></tr>';
        return;
    }

    tbody.innerHTML = orderList.map(order => `
        <tr>
            <td>#${order.id.substring(0, 8)}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(order.customer_name)}<br><small>${escapeHtml(order.customer_email)}</small></td>
            <td>${(order.order_items || []).length} item(s)</td>
            <td>$${parseFloat(order.total).toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewOrderDetail('${order.id}')">View</button>
                <button class="btn-primary" onclick="updateOrderStatus('${order.id}')">Update</button>
                ${order.shipping_label_url ? `<button class="btn-secondary" onclick="window.open('${order.shipping_label_url}', '_blank')">Label</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function filterOrders() {
    const filter = document.getElementById('orderStatusFilter').value;
    // Reload with filter
    loadOrdersFiltered(filter);
}

async function loadOrdersFiltered(filter) {
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false });
    if (filter && filter !== 'all') query = query.eq('status', filter);
    const { data: orders } = await query;
    const tbody = document.getElementById('ordersTableBody');
    const orderList = orders || [];

    tbody.innerHTML = orderList.map(order => `
        <tr>
            <td>#${order.id.substring(0, 8)}</td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(order.customer_name)}<br><small>${escapeHtml(order.customer_email)}</small></td>
            <td>${(order.order_items || []).length} item(s)</td>
            <td>$${parseFloat(order.total).toFixed(2)}</td>
            <td><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewOrderDetail('${order.id}')">View</button>
                <button class="btn-primary" onclick="updateOrderStatus('${order.id}')">Update</button>
                ${order.shipping_label_url ? `<button class="btn-secondary" onclick="window.open('${order.shipping_label_url}', '_blank')">Label</button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function viewOrderDetail(orderId) {
    const { data: order } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single();
    if (!order) return;

    const shippingAddr = order.shipping_full_address || `${order.shipping_street || ''}${order.shipping_apt ? ', ' + order.shipping_apt : ''}, ${order.shipping_city || ''}, ${order.shipping_state || ''} ${order.shipping_zip || ''}`;

    const content = `
        <h3>Order #${order.id.substring(0, 8)}</h3>
        <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleString()}</p>
        <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(order.customer_email)}</p>
        <p><strong>Shipping Address:</strong><br>${escapeHtml(shippingAddr)}</p>

        ${order.shipping_tracking_number ? `
            <div style="background: #e8f5e9; padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0; border: 2px solid #4caf50;">
                <h4 style="margin-top: 0; color: #2e7d32;">Shipping Label Created</h4>
                <p><strong>Tracking:</strong> <code>${order.shipping_tracking_number}</code></p>
                <p><strong>Carrier:</strong> ${(order.shipping_carrier || '').toUpperCase()} - ${order.shipping_service || ''}</p>
                ${order.shipping_cost ? `<p><strong>Cost:</strong> $${order.shipping_cost}</p>` : ''}
                ${order.shipping_tracking_url ? `<p><a href="${order.shipping_tracking_url}" target="_blank">Track Package</a></p>` : ''}
                ${order.shipping_label_url ? `<button class="btn-primary" onclick="window.open('${order.shipping_label_url}', '_blank')">Print Label</button>` : ''}
            </div>
        ` : ''}

        <h4>Items:</h4>
        <ul>${(order.order_items || []).map(item => `<li>${escapeHtml(item.name)} - $${parseFloat(item.price).toFixed(2)}</li>`).join('')}</ul>
        <p><strong>Total:</strong> $${parseFloat(order.total).toFixed(2)}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></p>
    `;

    document.getElementById('orderDetailContent').innerHTML = content;
    document.getElementById('orderModal').classList.add('active');
}

function closeOrderModal() { document.getElementById('orderModal').classList.remove('active'); }

async function updateOrderStatus(orderId) {
    const newStatus = prompt('Enter new status (pending/paid/processing/shipped/delivered):');
    if (!newStatus) return;
    const valid = ['pending', 'paid', 'processing', 'shipped', 'delivered'];
    if (!valid.includes(newStatus.toLowerCase())) { alert('Invalid status'); return; }

    await supabase.from('orders').update({ status: newStatus.toLowerCase() }).eq('id', orderId);
    loadOrders();
    alert('Order status updated!');
}

// ==========================================
// PROFITS
// ==========================================

async function loadProfits() {
    const { data: orders } = await supabase.from('orders').select('*, order_items(*)').eq('status', 'delivered');
    const completedOrders = orders || [];

    // Get product costs
    const allProductIds = completedOrders.flatMap(o => (o.order_items || []).map(i => i.product_id));
    let costMap = {};
    if (allProductIds.length > 0) {
        const { data: products } = await supabase.from('products').select('id, cost').in('id', allProductIds);
        (products || []).forEach(p => { costMap[p.id] = parseFloat(p.cost || 0); });
    }

    const totalRevenue = completedOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    let totalCosts = 0;
    completedOrders.forEach(o => {
        (o.order_items || []).forEach(item => {
            totalCosts += costMap[item.product_id] || 0;
        });
    });

    document.getElementById('totalRevenue').textContent = '$' + totalRevenue.toFixed(2);
    document.getElementById('totalCosts').textContent = '$' + totalCosts.toFixed(2);
    document.getElementById('netProfit').textContent = '$' + (totalRevenue - totalCosts).toFixed(2);

    const tbody = document.getElementById('salesTableBody');
    if (completedOrders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No completed sales yet</td></tr>';
        return;
    }

    let salesRows = [];
    completedOrders.forEach(order => {
        (order.order_items || []).forEach(item => {
            const cost = costMap[item.product_id] || 0;
            const profit = parseFloat(item.price) - cost;
            salesRows.push(`
                <tr>
                    <td>${new Date(order.created_at).toLocaleDateString()}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>$${parseFloat(item.price).toFixed(2)}</td>
                    <td>$${cost.toFixed(2)}</td>
                    <td style="color: ${profit > 0 ? 'green' : 'red'}; font-weight: bold;">$${profit.toFixed(2)}</td>
                </tr>
            `);
        });
    });
    tbody.innerHTML = salesRows.join('');
}

// ==========================================
// SYNDICATED LISTINGS
// ==========================================

function openSyndicatedModal() { document.getElementById('syndicatedModal').classList.add('active'); }
function closeSyndicatedModal() { document.getElementById('syndicatedModal').classList.remove('active'); document.getElementById('syndicatedForm').reset(); }

document.getElementById('syndicatedForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const listing = {
        id: Date.now().toString(),
        title: document.getElementById('syndicatedTitle').value,
        platform: document.getElementById('syndicatedPlatform').value,
        price: document.getElementById('syndicatedPrice').value,
        link: document.getElementById('syndicatedLink').value,
        image_url: document.getElementById('syndicatedImage').value,
        active: true,
        created_at: new Date().toISOString()
    };

    await supabase.from('syndicated_listings').insert(listing);
    closeSyndicatedModal();
    loadSyndicatedListings();
    alert('Syndicated listing added!');
});

async function loadSyndicatedListings() {
    const { data: listings } = await supabase.from('syndicated_listings').select('*').order('created_at', { ascending: false });
    const grid = document.getElementById('syndicatedGrid');
    const list = listings || [];

    if (list.length === 0) {
        grid.innerHTML = '<p>No syndicated listings yet. Add your first listing!</p>';
        return;
    }

    grid.innerHTML = list.map(listing => `
        <div class="syndicated-item">
            <div class="syndicated-item-image">
                ${listing.image_url ? `<img src="${listing.image_url}" alt="${escapeHtml(listing.title)}">` : `<span>No Image</span>`}
            </div>
            <div class="syndicated-item-info">
                <span class="platform-badge">${listing.platform.toUpperCase()}</span>
                <h3>${escapeHtml(listing.title)}</h3>
                <p class="inventory-item-price">${listing.price}</p>
                <p><small><a href="${listing.link}" target="_blank">View Listing</a></small></p>
                <p><strong>Status: ${listing.active ? 'Active' : 'Hidden'}</strong></p>
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

async function toggleSyndicatedListing(listingId, active) {
    await supabase.from('syndicated_listings').update({ active }).eq('id', listingId);
    loadSyndicatedListings();
}

async function deleteSyndicatedListing(listingId) {
    if (!confirm('Delete this listing?')) return;
    await supabase.from('syndicated_listings').delete().eq('id', listingId);
    loadSyndicatedListings();
}

// ==========================================
// SELLER SUBMISSIONS
// ==========================================

async function loadSubmissions() {
    const { data: submissions } = await supabase
        .from('seller_submissions')
        .select('*, submission_images(*)')
        .order('created_at', { ascending: false });

    const tbody = document.getElementById('submissionsTableBody');
    const list = submissions || [];

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No seller submissions yet</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(s.name)}<br><small>${escapeHtml(s.email)}</small></td>
            <td>${s.item_type}</td>
            <td>${s.condition}</td>
            <td>${s.era || 'N/A'}</td>
            <td>${s.estimate || 'N/A'}</td>
            <td><span class="status-badge status-${s.status}">${s.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewSubmissionDetail('${s.id}')">View</button>
                <button class="btn-primary" onclick="updateSubmissionStatus('${s.id}')">Update</button>
            </td>
        </tr>
    `).join('');
}

function filterSubmissions() {
    const filter = document.getElementById('submissionStatusFilter').value;
    loadSubmissionsFiltered(filter);
}

async function loadSubmissionsFiltered(filter) {
    let query = supabase.from('seller_submissions').select('*, submission_images(*)').order('created_at', { ascending: false });
    if (filter && filter !== 'all') query = query.eq('status', filter);
    const { data: submissions } = await query;
    const tbody = document.getElementById('submissionsTableBody');
    const list = submissions || [];

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center">No submissions found</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td>${new Date(s.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(s.name)}<br><small>${escapeHtml(s.email)}</small></td>
            <td>${s.item_type}</td>
            <td>${s.condition}</td>
            <td>${s.era || 'N/A'}</td>
            <td>${s.estimate || 'N/A'}</td>
            <td><span class="status-badge status-${s.status}">${s.status.toUpperCase()}</span></td>
            <td>
                <button class="btn-success" onclick="viewSubmissionDetail('${s.id}')">View</button>
                <button class="btn-primary" onclick="updateSubmissionStatus('${s.id}')">Update</button>
            </td>
        </tr>
    `).join('');
}

async function viewSubmissionDetail(submissionId) {
    const { data: submission } = await supabase
        .from('seller_submissions')
        .select('*, submission_images(*)')
        .eq('id', submissionId)
        .single();

    if (!submission) return;

    let statusActions = '';
    const images = (submission.submission_images || []).sort((a, b) => a.display_order - b.display_order);

    if (submission.status === 'pending_admin') {
        statusActions = `
            <div style="background: var(--light-beige); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>Admin Review</h4>
                <div class="form-group">
                    <label>Set Your Price:</label>
                    <input type="number" id="adminPrice" placeholder="Enter price" step="0.01" style="width: 200px; padding: 0.5rem; border: 2px solid var(--gray-200); border-radius: 5px;">
                </div>
                <div class="form-group">
                    <label>Notes (optional):</label>
                    <textarea id="adminNotes" rows="3" style="width: 100%; padding: 0.5rem; border: 2px solid var(--gray-200); border-radius: 5px;"></textarea>
                </div>
                <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                    <button class="btn-success" onclick="approveSubmission('${submission.id}')">Approve & Send to Seller</button>
                    <button class="btn-danger" onclick="rejectSubmission('${submission.id}')">Reject</button>
                </div>
            </div>`;
    } else if (submission.status === 'pending_seller') {
        const approvalLink = `${window.location.origin}/seller-approval.html?id=${submission.id}`;
        statusActions = `
            <div style="background: var(--light-beige); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>Waiting for Seller Approval</h4>
                <p><strong>Your Offer:</strong> $${parseFloat(submission.admin_price).toFixed(2)}</p>
                ${submission.admin_notes ? `<p><strong>Notes:</strong> ${escapeHtml(submission.admin_notes)}</p>` : ''}
                <p><strong>Reviewed:</strong> ${new Date(submission.reviewed_at).toLocaleString()}</p>
                <div style="margin-top: 1rem;">
                    <p><strong>Approval Link:</strong></p>
                    <input type="text" value="${approvalLink}" readonly style="width: 100%; padding: 0.5rem;" onclick="this.select()">
                    <button class="btn-primary" onclick="copyApprovalLink('${approvalLink}')" style="margin-top: 0.5rem; width: 100;">Copy Link</button>
                    <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">Email this link to ${escapeHtml(submission.email)}</p>
                </div>
            </div>`;
    } else if (submission.status === 'approved') {
        statusActions = `
            <div style="background: var(--success); color: white; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>Approved & Added to Inventory</h4>
                <p><strong>Final Price:</strong> $${parseFloat(submission.admin_price).toFixed(2)}</p>
                <p><strong>Approved:</strong> ${new Date(submission.seller_approved_at).toLocaleString()}</p>
            </div>`;
    } else if (submission.status === 'rejected') {
        statusActions = `
            <div style="background: var(--danger); color: white; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <h4>Rejected</h4>
                ${submission.admin_notes ? `<p><strong>Reason:</strong> ${escapeHtml(submission.admin_notes)}</p>` : ''}
            </div>`;
    }

    let photosHTML = images.length > 0 ?
        `<h4>Item Photos:</h4><div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
            ${images.map((img, idx) => `<img src="${img.storage_path}" alt="Photo ${idx + 1}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${img.storage_path}', '_blank')">`).join('')}
        </div>` :
        `<div style="background: #FEF3C7; padding: 1rem; border-radius: 5px; border-left: 4px solid #F59E0B; margin-bottom: 1.5rem;">
            <p style="margin: 0; color: #92400E;"><strong>No photos uploaded</strong></p>
        </div>`;

    const content = `
        <h3>Submission #${submission.id.substring(0, 8)}</h3>
        <p><strong>Date:</strong> ${new Date(submission.created_at).toLocaleString()}</p>
        <p><strong>Status:</strong> <span class="status-badge status-${submission.status}">${submission.status.replace(/_/g, ' ').toUpperCase()}</span></p>
        ${photosHTML}
        <h4>Seller Information:</h4>
        <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(submission.email)}</p>
        <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>
        <h4>Item Details:</h4>
        <p><strong>Type:</strong> ${submission.item_type}</p>
        <p><strong>Condition:</strong> ${submission.condition}</p>
        <p><strong>Era:</strong> ${submission.era || 'Not specified'}</p>
        <p><strong>Description:</strong></p>
        <p style="background: #f5f5f5; padding: 1rem; border-radius: 5px;">${escapeHtml(submission.description || '')}</p>
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

function closeSubmissionModal() { document.getElementById('submissionModal').classList.remove('active'); }

async function updateSubmissionStatus(submissionId) {
    const newStatus = prompt('Enter new status (pending_admin/pending_seller/approved/rejected):');
    if (!newStatus) return;
    const valid = ['pending_admin', 'pending_seller', 'approved', 'rejected'];
    if (!valid.includes(newStatus.toLowerCase())) { alert('Invalid status'); return; }

    await supabase.from('seller_submissions').update({ status: newStatus.toLowerCase() }).eq('id', submissionId);
    loadSubmissions();
    alert('Status updated!');
}

async function approveSubmission(submissionId) {
    const price = document.getElementById('adminPrice').value;
    const notes = document.getElementById('adminNotes').value;

    if (!price || price <= 0) { alert('Please enter a valid price'); return; }
    if (!confirm(`Approve with a price of $${price}?`)) return;

    await supabase.from('seller_submissions').update({
        status: 'pending_seller',
        admin_price: parseFloat(price),
        admin_notes: notes || null,
        reviewed_at: new Date().toISOString()
    }).eq('id', submissionId);

    const { data: sub } = await supabase.from('seller_submissions').select('email').eq('id', submissionId).single();
    alert(`Approved! Copy the approval link and email it to ${sub.email}`);
    closeSubmissionModal();
    loadSubmissions();
    setTimeout(() => viewSubmissionDetail(submissionId), 100);
}

async function rejectSubmission(submissionId) {
    const reason = prompt('Rejection reason (optional):');
    if (!confirm('Reject this submission?')) return;

    await supabase.from('seller_submissions').update({
        status: 'rejected',
        admin_notes: reason || 'No reason provided',
        reviewed_at: new Date().toISOString()
    }).eq('id', submissionId);

    closeSubmissionModal();
    loadSubmissions();
}

function copyApprovalLink(link) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => alert('Link copied!')).catch(() => alert('Please copy the link manually.'));
    } else {
        alert('Please copy the link manually.');
    }
}

// ==========================================
// SETTINGS
// ==========================================

async function loadSettings() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'store').single();
    const settings = data ? data.value : {};
    if (settings.storeName) document.getElementById('storeName').value = settings.storeName;
    if (settings.contactEmail) document.getElementById('contactEmail').value = settings.contactEmail;
    if (settings.instagramHandle) document.getElementById('instagramHandle').value = settings.instagramHandle;
}

async function saveSettings() {
    const settings = {
        storeName: document.getElementById('storeName').value,
        contactEmail: document.getElementById('contactEmail').value,
        instagramHandle: document.getElementById('instagramHandle').value
    };

    await supabase.from('settings').upsert({
        key: 'store',
        value: settings,
        updated_at: new Date().toISOString()
    });
    alert('Settings saved!');
}

// eBay Settings
async function loadEbaySettings() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'ebay').single();
    const settings = data ? data.value : {};

    if (document.getElementById('ebayAppId')) {
        document.getElementById('ebayAppId').value = settings.ebayAppId || '';
        document.getElementById('ebayClientSecret').value = settings.ebayClientSecret || '';
        document.getElementById('ebaySellerUsername').value = settings.ebaySellerUsername || '';
        document.getElementById('epnCampaignId').value = settings.epnCampaignId || '';
        document.getElementById('proxyUrl').value = settings.proxyUrl || '';
        document.getElementById('adminKey').value = settings.adminKey || '';
    }
}

async function saveEbaySettings() {
    const settings = {
        ebayAppId: document.getElementById('ebayAppId').value.trim(),
        ebayClientSecret: document.getElementById('ebayClientSecret').value.trim(),
        ebaySellerUsername: document.getElementById('ebaySellerUsername').value.trim(),
        epnCampaignId: document.getElementById('epnCampaignId').value.trim(),
        proxyUrl: document.getElementById('proxyUrl').value.trim(),
        adminKey: document.getElementById('adminKey').value.trim()
    };

    if (!settings.ebayAppId || !settings.ebaySellerUsername || !settings.proxyUrl) {
        alert('Please fill in required eBay settings');
        return;
    }

    await supabase.from('settings').upsert({
        key: 'ebay',
        value: settings,
        updated_at: new Date().toISOString()
    });

    const resultDiv = document.getElementById('ebayTestResult');
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">Settings saved!</div>';
    setTimeout(() => resultDiv.innerHTML = '', 3000);
}

async function testEbayConnection() {
    const resultDiv = document.getElementById('ebayTestResult');
    const { data } = await supabase.from('settings').select('value').eq('key', 'ebay').single();
    const settings = data ? data.value : {};

    if (!settings.proxyUrl || !settings.ebaySellerUsername) {
        resultDiv.innerHTML = '<div style="padding: 1rem; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px;">Save eBay settings first</div>';
        return;
    }

    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d1ecf1; color: #0c5460;">Testing...</div>';

    try {
        const resp = await fetch(`${settings.proxyUrl.replace(/\/$/, '')}/listings?seller=${encodeURIComponent(settings.ebaySellerUsername)}&limit=5`);
        if (!resp.ok) throw new Error(`Status: ${resp.status}`);
        const result = await resp.json();
        resultDiv.innerHTML = `<div style="padding: 1rem; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 8px;">Connected! Found ${result.total || 0} listings.</div>`;
    } catch (error) {
        resultDiv.innerHTML = `<div style="padding: 1rem; background: #f8d7da; color: #721c24;">Failed: ${error.message}</div>`;
    }
}

// Shippo Settings
async function loadShippoSettings() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'shippo').single();
    const settings = data ? data.value : {};

    if (document.getElementById('shippoApiKey')) {
        document.getElementById('shippoApiKey').value = settings.shippoApiKey || '';
        document.getElementById('shipFromStreet').value = settings.shipFromStreet || '';
        document.getElementById('shipFromCity').value = settings.shipFromCity || '';
        document.getElementById('shipFromState').value = settings.shipFromState || '';
        document.getElementById('shipFromZip').value = settings.shipFromZip || '';
        document.getElementById('shipFromEmail').value = settings.shipFromEmail || '';
        document.getElementById('shipFromPhone').value = settings.shipFromPhone || '';
        document.getElementById('shippoDefaultService').value = settings.shippoDefaultService || 'usps_first';
        document.getElementById('shippoDefaultLength').value = settings.shippoDefaultLength || '12';
        document.getElementById('shippoDefaultWidth').value = settings.shippoDefaultWidth || '10';
        document.getElementById('shippoDefaultHeight').value = settings.shippoDefaultHeight || '3';
        document.getElementById('shippoDefaultWeight').value = settings.shippoDefaultWeight || '1';
    }
}

async function saveShippoSettings() {
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

    if (!settings.shippoApiKey || !settings.shipFromStreet) {
        alert('Please fill in required Shippo settings');
        return;
    }

    await supabase.from('settings').upsert({ key: 'shippo', value: settings, updated_at: new Date().toISOString() });
    const resultDiv = document.getElementById('shippoTestResult');
    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d4edda; color: #155724;">Shippo settings saved!</div>';
    setTimeout(() => resultDiv.innerHTML = '', 3000);
}

async function testShippoConnection() {
    const resultDiv = document.getElementById('shippoTestResult');
    const { data } = await supabase.from('settings').select('value').eq('key', 'shippo').single();
    const settings = data ? data.value : {};

    if (!settings.shippoApiKey) {
        resultDiv.innerHTML = '<div style="padding: 1rem; background: #f8d7da; color: #721c24;">Save Shippo API key first</div>';
        return;
    }

    resultDiv.innerHTML = '<div style="padding: 1rem; background: #d1ecf1; color: #0c5460;">Testing...</div>';
    try {
        const resp = await fetch('https://api.goshippo.com/carrier_accounts/', {
            headers: { 'Authorization': `ShippoToken ${settings.shippoApiKey}` }
        });
        if (!resp.ok) throw new Error(`Status: ${resp.status}`);
        const result = await resp.json();
        resultDiv.innerHTML = `<div style="padding: 1rem; background: #d4edda; color: #155724;">Connected! ${result.results ? result.results.length : 0} carriers.</div>`;
    } catch (error) {
        resultDiv.innerHTML = `<div style="padding: 1rem; background: #f8d7da; color: #721c24;">Failed: ${error.message}</div>`;
    }
}

// Google Places Settings
async function loadGooglePlacesSettings() {
    const { data } = await supabase.from('settings').select('value').eq('key', 'google_places').single();
    const settings = data ? data.value : {};

    if (settings.apiKey && document.getElementById('googlePlacesApiKey')) {
        document.getElementById('googlePlacesApiKey').value = settings.apiKey;
    }
    const enabled = settings.enabled !== false;
    if (document.getElementById('googlePlacesEnabled')) {
        document.getElementById('googlePlacesEnabled').checked = enabled;
    }
    const keySection = document.getElementById('googlePlacesKeySection');
    if (keySection) keySection.style.display = enabled ? 'block' : 'none';
}

async function toggleGooglePlaces() {
    const enabled = document.getElementById('googlePlacesEnabled').checked;
    const { data: existing } = await supabase.from('settings').select('value').eq('key', 'google_places').single();
    const settings = existing ? existing.value : {};
    settings.enabled = enabled;

    await supabase.from('settings').upsert({ key: 'google_places', value: settings, updated_at: new Date().toISOString() });

    const keySection = document.getElementById('googlePlacesKeySection');
    if (keySection) keySection.style.display = enabled ? 'block' : 'none';
}

async function saveGooglePlacesSettings() {
    const apiKey = document.getElementById('googlePlacesApiKey').value.trim();
    if (!apiKey) { alert('Enter a Google Places API key'); return; }

    const settings = {
        apiKey,
        enabled: document.getElementById('googlePlacesEnabled').checked,
        lastUpdated: new Date().toISOString()
    };

    await supabase.from('settings').upsert({ key: 'google_places', value: settings, updated_at: new Date().toISOString() });
    document.getElementById('googlePlacesStatus').innerHTML = '<div style="padding: 1rem; background: #d4edda; color: #155724;">API Key saved! Reload to activate.</div>';
}

function applyGooglePlacesKey() {
    saveGooglePlacesSettings();
}

// ==========================================
// HOKIES EVENTS
// ==========================================

async function loadAdminEvents() {
    const { data: events } = await supabase.from('hokies_events').select('*').order('event_date', { ascending: true });
    const container = document.getElementById('adminEventsList');
    if (!container) return;
    const list = events || [];

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #666;"><p>No events yet.</p></div>';
        return;
    }

    container.innerHTML = list.map(event => `
        <div class="event-card" style="background: white; border: 2px solid #E8E6E1; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                    <h3 style="color: var(--maroon);">${escapeHtml(event.name)}</h3>
                    <p style="color: #666;"><strong>Date:</strong> ${new Date(event.event_date).toLocaleString()}</p>
                    ${event.location ? `<p style="color: #666;"><strong>Location:</strong> ${escapeHtml(event.location)}</p>` : ''}
                    ${event.description ? `<p style="color: #666;">${escapeHtml(event.description)}</p>` : ''}
                    ${event.link ? `<p><a href="${event.link}" target="_blank" style="color: var(--orange);">Event Link</a></p>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editEvent('${event.id}')" class="btn-secondary" style="padding: 0.5rem 1rem;">Edit</button>
                    <button onclick="deleteEvent('${event.id}')" class="btn-danger" style="padding: 0.5rem 1rem;">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openEventModal() {
    document.getElementById('eventModalTitle').textContent = 'Add Hokies Event';
    document.getElementById('eventForm').reset();
    document.getElementById('eventId').value = '';
    document.getElementById('eventModal').style.display = 'block';
}

function closeEventModal() {
    document.getElementById('eventModal').style.display = 'none';
    document.getElementById('eventForm').reset();
}

async function editEvent(eventId) {
    const { data: event } = await supabase.from('hokies_events').select('*').eq('id', eventId).single();
    if (!event) return;

    document.getElementById('eventModalTitle').textContent = 'Edit Hokies Event';
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventName').value = event.name;
    document.getElementById('eventDate').value = new Date(event.event_date).toISOString().slice(0, 16);
    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventLink').value = event.link || '';
    document.getElementById('eventModal').style.display = 'block';
}

document.getElementById('eventForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const eventId = document.getElementById('eventId').value || 'event_' + Date.now();
    const eventData = {
        id: eventId,
        name: document.getElementById('eventName').value,
        event_date: new Date(document.getElementById('eventDate').value).toISOString(),
        location: document.getElementById('eventLocation').value || null,
        description: document.getElementById('eventDescription').value || null,
        link: document.getElementById('eventLink').value || null
    };

    if (document.getElementById('eventId').value) {
        await supabase.from('hokies_events').update(eventData).eq('id', eventId);
    } else {
        eventData.created_at = new Date().toISOString();
        await supabase.from('hokies_events').insert(eventData);
    }

    closeEventModal();
    loadAdminEvents();
    alert('Event saved!');
});

async function deleteEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    await supabase.from('hokies_events').delete().eq('id', eventId);
    loadAdminEvents();
}

// ==========================================
// EBAY CURATION
// ==========================================

async function loadEbayListingsForCuration() {
    const container = document.getElementById('ebay-curation-container');
    const stats = document.getElementById('ebay-curation-stats');
    const { data: settingsRow } = await supabase.from('settings').select('value').eq('key', 'ebay').single();
    const settings = settingsRow ? settingsRow.value : {};

    if (!settings.proxyUrl || !settings.ebaySellerUsername) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #721c24;">Configure eBay settings first.</div>';
        return;
    }

    container.innerHTML = '<div style="text-align: center; padding: 4rem;">Loading eBay listings...</div>';

    try {
        const resp = await fetch(`${settings.proxyUrl.replace(/\/$/, '')}/listings?seller=${encodeURIComponent(settings.ebaySellerUsername)}&limit=200`);
        if (!resp.ok) throw new Error(`Status: ${resp.status}`);
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const { data: approvedRow } = await supabase.from('settings').select('value').eq('key', 'ebay_approved_items').single();
        const approvedItems = approvedRow ? approvedRow.value : [];

        renderEbayCurationList(data.items, approvedItems);
        const approvedCount = data.items.filter(item => approvedItems.includes(item.itemId)).length;
        stats.textContent = `${approvedCount} of ${data.items.length} items approved`;
    } catch (error) {
        container.innerHTML = `<div style="color: #721c24;">Failed: ${error.message}</div>`;
    }
}

function renderEbayCurationList(items, approvedItems) {
    const container = document.getElementById('ebay-curation-container');
    if (!items || items.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem;">No eBay listings found.</div>';
        return;
    }

    container.innerHTML = `<div class="ebay-curation-grid">
        ${items.map(item => {
            const isApproved = approvedItems.includes(item.itemId);
            return `
                <div class="ebay-curation-card ${isApproved ? 'approved' : 'hidden'}">
                    <div class="ebay-curation-image">
                        <img src="${item.image || ''}" alt="${escapeHtml(item.title)}" onerror="this.src=''">
                        <div class="ebay-curation-badge ${isApproved ? 'badge-approved' : 'badge-hidden'}">${isApproved ? 'VISIBLE' : 'HIDDEN'}</div>
                    </div>
                    <div class="ebay-curation-info">
                        <h4>${escapeHtml(item.title)}</h4>
                        <p class="price">$${parseFloat(item.price.value).toFixed(2)}</p>
                        <button class="btn-toggle ${isApproved ? 'btn-hide' : 'btn-approve'}" onclick="toggleEbayListingApproval('${item.itemId}')">
                            ${isApproved ? 'Hide' : 'Show on Browse'}
                        </button>
                    </div>
                </div>`;
        }).join('')}
    </div>`;
}

async function toggleEbayListingApproval(itemId) {
    const { data: row } = await supabase.from('settings').select('value').eq('key', 'ebay_approved_items').single();
    let approvedItems = row ? row.value : [];

    if (approvedItems.includes(itemId)) {
        approvedItems = approvedItems.filter(id => id !== itemId);
    } else {
        approvedItems.push(itemId);
    }

    await supabase.from('settings').upsert({ key: 'ebay_approved_items', value: approvedItems, updated_at: new Date().toISOString() });
    loadEbayListingsForCuration();
}

// ==========================================
// DATA MANAGEMENT
// ==========================================

async function clearAllData() {
    if (!confirm('WARNING: This will permanently delete ALL inventory, drops, orders, and submissions. Continue?')) return;
    if (!confirm('This CANNOT be undone! Click OK to delete.')) return;

    try {
        await supabase.from('order_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('orders').delete().neq('id', '');
        await supabase.from('product_images').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('drop_items').delete().neq('drop_id', '');
        await supabase.from('products').delete().neq('id', '');
        await supabase.from('drops').delete().neq('id', '');
        await supabase.from('submission_images').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('seller_submissions').delete().neq('id', '');
        await supabase.from('syndicated_listings').delete().neq('id', '');
        await supabase.from('hokies_events').delete().neq('id', '');

        alert('All data cleared! Reloading...');
        location.reload();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// ==========================================
// UTILITY
// ==========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
