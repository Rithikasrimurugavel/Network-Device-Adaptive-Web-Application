// Taste & Trend E-Commerce - Cart, Instant Buy Now & Order Tracker Module

const CartModule = {
    cart: [],

    init() {
        const saved = localStorage.getItem('taste_trend_cart');
        if (saved) {
            try {
                this.cart = JSON.parse(saved);
            } catch (e) {
                this.cart = [];
            }
        }
        this.bindEvents();
        this.render();
    },

    save() {
        localStorage.setItem('taste_trend_cart', JSON.stringify(this.cart));
        this.render();
    },

    addItem(product, quantity = 1, selectedOptions = '') {
        const existingIndex = this.cart.findIndex(item => item.product_id === product.id && item.selected_options === selectedOptions);
        if (existingIndex > -1) {
            this.cart[existingIndex].quantity += quantity;
        } else {
            this.cart.push({
                product_id: product.id,
                name: product.name,
                price: parseFloat(product.price),
                image_url: product.image_url,
                department: product.department,
                quantity: quantity,
                selected_options: selectedOptions
            });
        }
        this.save();
        this.showToast(`Added "${product.name}" to cart!`);
        this.openDrawer();
    },

    buyNow(product, selectedOptions = '') {
        this.addItem(product, 1, selectedOptions);
        this.closeDrawer();
        this.openCheckoutModal();
    },

    removeItem(index) {
        if (index >= 0 && index < this.cart.length) {
            this.cart.splice(index, 1);
            this.save();
        }
    },

    updateQuantity(index, delta) {
        if (index >= 0 && index < this.cart.length) {
            this.cart[index].quantity += delta;
            if (this.cart[index].quantity <= 0) {
                this.cart.splice(index, 1);
            }
            this.save();
        }
    },

    clearCart() {
        this.cart = [];
        this.save();
    },

    getTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.08;
        const shipping = subtotal > 0 ? 4.99 : 0.0;
        const grandTotal = subtotal + tax + shipping;
        return {
            subtotal,
            tax,
            shipping,
            grandTotal,
            totalItems: this.cart.reduce((sum, item) => sum + item.quantity, 0)
        };
    },

    render() {
        const totals = this.getTotals();
        
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = totals.totalItems;
        }

        const cartBody = document.getElementById('cartBody');
        if (cartBody) {
            if (this.cart.length === 0) {
                cartBody.innerHTML = `
                <div class="cart-empty-msg">
                    <i class="fas fa-shopping-basket"></i>
                    <h3>Your cart is empty</h3>
                    <p style="font-size:0.85rem; margin-top:6px;">Explore our Food and Dress items to get started!</p>
                </div>`;
            } else {
                cartBody.innerHTML = this.cart.map((item, idx) => `
                <div class="cart-item">
                    <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-info">
                        <div class="cart-item-title">${item.name}</div>
                        ${item.selected_options ? `<div class="cart-item-opt">${item.selected_options}</div>` : ''}
                        <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px;">$${(item.price * item.quantity).toFixed(2)}</div>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="CartModule.updateQuantity(${idx}, -1)">-</button>
                            <span style="font-size:0.85rem; font-weight:700;">${item.quantity}</span>
                            <button class="qty-btn" onclick="CartModule.updateQuantity(${idx}, 1)">+</button>
                        </div>
                    </div>
                    <button style="border:none; background:transparent; color:#ef4444; cursor:pointer;" onclick="CartModule.removeItem(${idx})" title="Remove">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </div>
                `).join('');
            }
        }

        const subtotalEl = document.getElementById('cartSubtotal');
        const taxEl = document.getElementById('cartTax');
        const shippingEl = document.getElementById('cartShipping');
        const totalEl = document.getElementById('cartGrandTotal');
        const checkoutBtn = document.getElementById('cartCheckoutBtn');

        if (subtotalEl) subtotalEl.textContent = `$${totals.subtotal.toFixed(2)}`;
        if (taxEl) taxEl.textContent = `$${totals.tax.toFixed(2)}`;
        if (shippingEl) shippingEl.textContent = `$${totals.shipping.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${totals.grandTotal.toFixed(2)}`;
        if (checkoutBtn) checkoutBtn.disabled = this.cart.length === 0;
    },

    bindEvents() {
        document.getElementById('cartIconBtn')?.addEventListener('click', () => this.openDrawer());
        document.getElementById('cartDrawerClose')?.addEventListener('click', () => this.closeDrawer());
        document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeDrawer());

        document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => {
            if (this.cart.length === 0) return;
            this.closeDrawer();
            this.openCheckoutModal();
        });

        document.getElementById('checkoutForm')?.addEventListener('submit', (e) => this.handleCheckoutSubmit(e));
        document.getElementById('checkoutModalClose')?.addEventListener('click', () => this.closeCheckoutModal());

        // Order Tracker Header Button
        document.getElementById('trackOrderBtn')?.addEventListener('click', () => this.openOrderTrackerModal());
        document.getElementById('orderTrackerModalClose')?.addEventListener('click', () => this.closeOrderTrackerModal());
        document.getElementById('orderTrackerForm')?.addEventListener('submit', (e) => this.handleOrderSearch(e));
    },

    openDrawer() {
        document.getElementById('cartDrawer')?.classList.add('active');
        document.getElementById('cartDrawerOverlay')?.classList.add('active');
    },

    closeDrawer() {
        document.getElementById('cartDrawer')?.classList.remove('active');
        document.getElementById('cartDrawerOverlay')?.classList.remove('active');
    },

    openCheckoutModal() {
        const modal = document.getElementById('checkoutModal');
        const overlay = document.getElementById('modalOverlay');
        
        const totals = this.getTotals();
        const summaryEl = document.getElementById('checkoutOrderSummary');
        if (summaryEl) {
            summaryEl.innerHTML = `
            <div style="background:#f8fafc; padding:1rem; border-radius:12px; margin-bottom:1rem; border:1px solid #e2e8f0;">
                <div style="font-weight:700; margin-bottom:6px;">Items in order (${totals.totalItems})</div>
                ${this.cart.map(i => `<div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#64748b;">
                    <span>${i.name} (x${i.quantity})</span>
                    <span>$${(i.price * i.quantity).toFixed(2)}</span>
                </div>`).join('')}
                <hr style="margin:8px 0; border:none; border-top:1px dashed #cbd5e1;">
                <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.05rem; color:#1e293b;">
                    <span>Grand Total:</span>
                    <span>$${totals.grandTotal.toFixed(2)}</span>
                </div>
            </div>
            `;
        }

        modal?.classList.add('active');
        overlay?.classList.add('active');
    },

    closeCheckoutModal() {
        document.getElementById('checkoutModal')?.classList.remove('active');
        document.getElementById('modalOverlay')?.classList.remove('active');
    },

    async handleCheckoutSubmit(e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Order...`;
        }

        const formData = {
            customer_name: document.getElementById('custName')?.value,
            customer_email: document.getElementById('custEmail')?.value,
            customer_phone: document.getElementById('custPhone')?.value,
            shipping_address: document.getElementById('custAddress')?.value,
            payment_method: document.getElementById('custPayment')?.value || 'Credit Card',
            cart_items: this.cart
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (data.success) {
                this.clearCart();
                window.location.href = `/order-confirmation/${data.order_id}`;
            } else {
                alert(data.message || 'Failed to process order.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `Place Order`;
                }
            }
        } catch (err) {
            console.error('Checkout error:', err);
            alert('An error occurred while placing your order. Please check network connection.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `Place Order`;
            }
        }
    },

    openOrderTrackerModal() {
        document.getElementById('orderTrackerModal')?.classList.add('active');
        document.getElementById('modalOverlay')?.classList.add('active');
    },

    closeOrderTrackerModal() {
        document.getElementById('orderTrackerModal')?.classList.remove('active');
        document.getElementById('modalOverlay')?.classList.remove('active');
    },

    async handleOrderSearch(e) {
        e.preventDefault();
        const query = document.getElementById('orderSearchInput')?.value.trim();
        const resultsEl = document.getElementById('orderSearchResults');
        if (!query || !resultsEl) return;

        resultsEl.innerHTML = `<div style="text-align:center; padding:1.5rem;"><i class="fas fa-spinner fa-spin"></i> Searching order status...</div>`;

        try {
            const res = await fetch(`/api/orders/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            if (data.success && data.order) {
                const order = data.order;
                const items = data.items || [];

                resultsEl.innerHTML = `
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; margin-top:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.8rem;">
                        <div>
                            <div style="font-size:0.75rem; color:#64748b; font-weight:700;">ORDER NUMBER</div>
                            <div style="font-weight:800; font-size:1.1rem; color:#1e293b;">${order.order_number}</div>
                        </div>
                        <span style="background:#dcfce7; color:#16a34a; padding:4px 12px; border-radius:20px; font-weight:700; font-size:0.85rem;">
                            <i class="fas fa-check-circle"></i> ${order.status}
                        </span>
                    </div>
                    <div style="font-size:0.85rem; color:#475569; margin-bottom:1rem;">
                        <div><strong>Customer:</strong> ${order.customer_name} (${order.customer_email})</div>
                        <div><strong>Address:</strong> ${order.shipping_address}</div>
                        <div><strong>Placed On:</strong> ${order.created_at}</div>
                    </div>
                    <div style="font-weight:700; font-size:0.9rem; margin-bottom:6px;">Items Purchased (${items.length}):</div>
                    ${items.map(i => `
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding:4px 0; border-bottom:1px dashed #e2e8f0;">
                            <span>${i.product_name} (x${i.quantity})</span>
                            <span style="font-weight:700;">$${parseFloat(i.total_price).toFixed(2)}</span>
                        </div>
                    `).join('')}
                    <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; margin-top:10px; color:#1e293b;">
                        <span>Total Paid:</span>
                        <span style="color:#e63946;">$${parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>
                </div>`;
            } else {
                resultsEl.innerHTML = `<div style="color:#ef4444; text-align:center; padding:1.5rem; font-weight:600;">${data.message || 'No order found matching your search.'}</div>`;
            }
        } catch (err) {
            console.error('Order search error:', err);
            resultsEl.innerHTML = `<div style="color:#ef4444; text-align:center; padding:1.5rem;">Failed to retrieve order. Please try again.</div>`;
        }
    },

    showToast(message) {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> ${message}`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    }
};

document.addEventListener('DOMContentLoaded', () => CartModule.init());