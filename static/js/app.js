// Taste & Trend E-Commerce - Main App & Adaptive Rendering Logic

let currentDepartment = 'all';
let currentCategory = null;
let currentSearchQuery = '';
let currentSort = 'featured';
let activeQuickViewProduct = null;

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    loadCategories();
    loadProducts();
});

function initEventListeners() {
    document.querySelectorAll('.dept-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.dept-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            currentDepartment = e.currentTarget.dataset.dept;
            currentCategory = null;
            
            updateHeaderTheme();
            loadCategories();
            loadProducts();
        });
    });

    document.getElementById('ctaFoodBtn')?.addEventListener('click', () => {
        switchDepartment('food');
    });
    
    document.getElementById('ctaDressBtn')?.addEventListener('click', () => {
        switchDepartment('dress');
    });

    const searchInput = document.getElementById('searchInput');
    let searchTimeout = null;
    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearchQuery = e.target.value.trim();
            loadProducts();
        }, 300);
    });

    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        loadProducts();
    });

    document.getElementById('modalCloseBtn')?.addEventListener('click', closeQuickViewModal);
    document.getElementById('modalOverlay')?.addEventListener('click', closeQuickViewModal);
}

function switchDepartment(dept) {
    const targetBtn = document.querySelector(`.dept-btn[data-dept="${dept}"]`);
    if (targetBtn) {
        targetBtn.click();
        window.scrollTo({ top: 600, behavior: 'smooth' });
    }
}

function updateHeaderTheme() {
    const titleEl = document.getElementById('sectionTitle');
    if (currentDepartment === 'food') {
        titleEl.textContent = '🍽️ Culinary Delights & Gourmet Food';
    } else if (currentDepartment === 'dress') {
        titleEl.textContent = '👗 Fashion Trends & Chic Apparel';
    } else {
        titleEl.textContent = '🔥 Featured Products & Popular Picks';
    }
}

async function loadCategories() {
    const pillsContainer = document.getElementById('categoryPills');
    if (!pillsContainer) return;

    try {
        const url = currentDepartment !== 'all' ? `/api/categories?department=${currentDepartment}` : '/api/categories';
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
            let html = `<button class="category-pill ${currentCategory === null ? 'active' : ''}" data-cat-id="all">
                <i class="fas fa-grid"></i> All Categories
            </button>`;

            data.categories.forEach(cat => {
                const isActive = currentCategory == cat.id ? 'active' : '';
                const iconClass = cat.icon || 'fa-tag';
                html += `<button class="category-pill ${isActive}" data-cat-id="${cat.id}">
                    <i class="fas ${iconClass}"></i> ${cat.name}
                </button>`;
            });

            pillsContainer.innerHTML = html;

            pillsContainer.querySelectorAll('.category-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    pillsContainer.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    const catId = e.currentTarget.dataset.catId;
                    currentCategory = catId === 'all' ? null : catId;
                    loadProducts();
                });
            });
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

async function loadProducts() {
    const grid = document.getElementById('productGrid');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p style="margin-top: 0.5rem;">Loading products...</p>
    </div>`;

    try {
        const activeTier = window.AdaptiveEngine ? window.AdaptiveEngine.tier : 'high';
        let url = `/api/products?tier=${activeTier}&`;
        if (currentDepartment !== 'all') url += `department=${currentDepartment}&`;
        if (currentCategory) url += `category_id=${currentCategory}&`;
        if (currentSearchQuery) url += `q=${encodeURIComponent(currentSearchQuery)}&`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.products.length > 0) {
            let products = data.products;

            if (currentSort === 'price-low') {
                products.sort((a, b) => a.price - b.price);
            } else if (currentSort === 'price-high') {
                products.sort((a, b) => b.price - a.price);
            } else if (currentSort === 'rating') {
                products.sort((a, b) => b.rating - a.rating);
            }

            grid.innerHTML = products.map((p, idx) => renderProductCard(p, idx, activeTier)).join('');

            // Bind Add to Cart
            grid.querySelectorAll('.btn-add-cart').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const prodId = parseInt(e.currentTarget.dataset.id);
                    const product = products.find(p => p.id === prodId);
                    if (product) {
                        let opt = '';
                        if (product.department === 'dress' && product.attributes?.sizes?.length) {
                            opt = `Size: ${product.attributes.sizes[0]}`;
                        }
                        CartModule.addItem(product, 1, opt);
                    }
                });
            });

            // Bind Buy Now
            grid.querySelectorAll('.btn-buy-now').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const prodId = parseInt(e.currentTarget.dataset.id);
                    const product = products.find(p => p.id === prodId);
                    if (product) {
                        let opt = '';
                        if (product.department === 'dress' && product.attributes?.sizes?.length) {
                            opt = `Size: ${product.attributes.sizes[0]}`;
                        }
                        CartModule.buyNow(product, opt);
                    }
                });
            });

            // Bind Quick View
            grid.querySelectorAll('.btn-quick-view').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const prodId = parseInt(e.currentTarget.dataset.id);
                    const product = products.find(p => p.id === prodId);
                    if (product) {
                        openQuickViewModal(product);
                    }
                });
            });

        } else {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #64748b;">
                <i class="fas fa-search fa-3x" style="margin-bottom: 1rem; opacity: 0.4;"></i>
                <h3>No products found</h3>
                <p>Try clearing your search filters or selecting another category.</p>
            </div>`;
        }
    } catch (err) {
        console.error('Error loading products:', err);
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #e63946; padding: 2rem;">
            Failed to load products. Please ensure backend server is running.
        </div>`;
    }
}

window.loadProducts = loadProducts;

function renderProductCard(p, index, tier) {
    const isFood = p.department === 'food';
    const deptClass = isFood ? 'food' : 'dress';
    const deptLabel = isFood ? 'Food' : 'Dress';
    
    const optimizedImgUrl = window.ImageOptimizer ? window.ImageOptimizer.getOptimizedImageUrl(p.image_url, tier) : p.image_url;
    const isLcpElement = index === 0;
    const loadingAttr = isLcpElement ? 'loading="eager"' : 'loading="lazy"';
    const fetchPriorityAttr = isLcpElement && tier === 'high' ? 'fetchpriority="high"' : '';

    let attrHtml = '';
    if (isFood) {
        if (p.attributes?.prep_time) attrHtml += `<span class="attr-tag"><i class="far fa-clock"></i> ${p.attributes.prep_time}</span>`;
        if (p.attributes?.calories) attrHtml += `<span class="attr-tag">${p.attributes.calories}</span>`;
        if (p.attributes?.is_veg) attrHtml += `<span class="attr-tag" style="color:#16a34a;"><i class="fas fa-leaf"></i> Veg</span>`;
    } else {
        if (p.attributes?.fabric) attrHtml += `<span class="attr-tag">${p.attributes.fabric}</span>`;
        if (p.attributes?.sizes?.length) attrHtml += `<span class="attr-tag">Sizes: ${p.attributes.sizes.join(', ')}</span>`;
    }

    return `
    <div class="product-card" data-department="${deptClass}" data-id="${p.id}">
        <div class="product-image-wrap">
            <img src="${optimizedImgUrl}" alt="${p.name}" ${loadingAttr} ${fetchPriorityAttr}>
            <span class="badge-dept ${deptClass}">${deptLabel}</span>
            <span class="rating-badge"><i class="fas fa-star" style="color:#f59e0b;"></i> ${p.rating}</span>
        </div>
        <div class="product-info">
            <div class="product-category-name">${p.category_name || deptLabel}</div>
            <h3 class="product-title">${p.name}</h3>
            <p class="product-desc">${p.description}</p>
            <div class="product-attributes-preview">${attrHtml}</div>
            <div class="product-footer">
                <span class="product-price">$${parseFloat(p.price).toFixed(2)}</span>
                <div class="product-actions">
                    <button class="btn-quick-view" data-id="${p.id}" title="Quick View">
                        <i class="far fa-eye"></i>
                    </button>
                    <button class="btn-add-cart" data-id="${p.id}">
                        <i class="fas fa-cart-plus"></i> Add
                    </button>
                    <button class="btn-buy-now" data-id="${p.id}">
                        ⚡ Buy Now
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
}

function openQuickViewModal(product) {
    activeQuickViewProduct = product;
    const modal = document.getElementById('quickViewModal');
    const overlay = document.getElementById('modalOverlay');
    if (!modal || !overlay) return;

    const isFood = product.department === 'food';
    let optionsHtml = '';

    if (!isFood && product.attributes?.sizes) {
        optionsHtml += `
        <div class="option-group">
            <label>Select Size:</label>
            <div class="option-buttons" id="sizeOptions">
                ${product.attributes.sizes.map((s, idx) => `
                    <button class="opt-btn ${idx === 0 ? 'selected' : ''}" data-val="${s}">${s}</button>
                `).join('')}
            </div>
        </div>`;
    }

    if (!isFood && product.attributes?.colors) {
        optionsHtml += `
        <div class="option-group">
            <label>Color Variant:</label>
            <div class="option-buttons" id="colorOptions">
                ${product.attributes.colors.map((c, idx) => `
                    <button class="opt-btn ${idx === 0 ? 'selected' : ''}" data-val="${c}">${c}</button>
                `).join('')}
            </div>
        </div>`;
    }

    if (isFood && product.attributes?.spicy) {
        optionsHtml += `
        <div class="option-group">
            <label>Spice Preference:</label>
            <div class="option-buttons" id="spiceOptions">
                <button class="opt-btn selected" data-val="${product.attributes.spicy}">${product.attributes.spicy}</button>
            </div>
        </div>`;
    }

    const activeTier = window.AdaptiveEngine ? window.AdaptiveEngine.tier : 'high';
    const optimizedModalImg = window.ImageOptimizer ? window.ImageOptimizer.getOptimizedImageUrl(product.image_url, activeTier) : product.image_url;

    modal.innerHTML = `
    <button class="modal-close-btn" id="modalCloseBtn"><i class="fas fa-times"></i></button>
    <div class="quick-view-grid">
        <img src="${optimizedModalImg}" alt="${product.name}" class="quick-view-img">
        <div class="quick-view-details">
            <span class="badge-dept ${isFood ? 'food' : 'dress'}" style="position:static; display:inline-block; width:fit-content; margin-bottom: 8px;">
                ${isFood ? 'Gourmet Food' : 'Fashion Apparel'}
            </span>
            <h2 style="font-size: 1.5rem; font-weight:800; margin-bottom: 6px;">${product.name}</h2>
            <div style="color: #f59e0b; font-weight: 700; margin-bottom: 12px;">
                <i class="fas fa-star"></i> ${product.rating} / 5.0
            </div>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1rem;">${product.description}</p>
            <h3 style="font-size: 1.6rem; font-weight:800; color:#1e293b; margin-bottom: 1rem;">$${parseFloat(product.price).toFixed(2)}</h3>
            
            ${optionsHtml}

            <div style="margin-top: auto; padding-top: 1rem; display: flex; gap: 0.6rem;">
                <button class="btn-checkout" id="modalAddToCartBtn" style="flex:1; background:#1e293b;">
                    <i class="fas fa-shopping-bag"></i> Add To Cart
                </button>
                <button class="btn-checkout" id="modalBuyNowBtn" style="flex:1; background:linear-gradient(135deg, #f59e0b, #d97706);">
                    ⚡ Buy Now
                </button>
            </div>
        </div>
    </div>
    `;

    overlay.classList.add('active');
    modal.classList.add('active');

    modal.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const parent = e.currentTarget.parentElement;
            parent.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    modal.querySelector('#modalCloseBtn')?.addEventListener('click', closeQuickViewModal);

    modal.querySelector('#modalAddToCartBtn')?.addEventListener('click', () => {
        let selectedOpts = [];
        const selSize = modal.querySelector('#sizeOptions .selected');
        const selColor = modal.querySelector('#colorOptions .selected');
        const selSpice = modal.querySelector('#spiceOptions .selected');

        if (selSize) selectedOpts.push(`Size: ${selSize.dataset.val}`);
        if (selColor) selectedOpts.push(`Color: ${selColor.dataset.val}`);
        if (selSpice) selectedOpts.push(`Spice: ${selSpice.dataset.val}`);

        CartModule.addItem(product, 1, selectedOpts.join(', '));
        closeQuickViewModal();
    });

    modal.querySelector('#modalBuyNowBtn')?.addEventListener('click', () => {
        let selectedOpts = [];
        const selSize = modal.querySelector('#sizeOptions .selected');
        const selColor = modal.querySelector('#colorOptions .selected');
        const selSpice = modal.querySelector('#spiceOptions .selected');

        if (selSize) selectedOpts.push(`Size: ${selSize.dataset.val}`);
        if (selColor) selectedOpts.push(`Color: ${selColor.dataset.val}`);
        if (selSpice) selectedOpts.push(`Spice: ${selSpice.dataset.val}`);

        CartModule.buyNow(product, selectedOpts.join(', '));
        closeQuickViewModal();
    });
}

function closeQuickViewModal() {
    const modal = document.getElementById('quickViewModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) modal.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}