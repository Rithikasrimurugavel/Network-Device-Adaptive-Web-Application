/**
 * Taste & Trend - AI Store Assistant ("Chef & Stylist AI")
 * Interactive AI Chat Widget for Food & Fashion Recommendations
 */

const AIAssistant = {
    isOpen: false,

    init() {
        this.renderWidget();
        this.bindEvents();
    },

    renderWidget() {
        if (document.getElementById('aiAssistantContainer')) return;

        const container = document.createElement('div');
        container.id = 'aiAssistantContainer';
        container.innerHTML = `
        <!-- Floating Launcher Button -->
        <button class="ai-launcher-btn" id="aiLauncherBtn" title="Ask Chef & Stylist AI Assistant">
            <i class="fas fa-robot"></i>
            <span class="ai-launcher-text">Ask AI Assistant</span>
        </button>

        <!-- Slide-Up AI Chat Drawer -->
        <div class="ai-chat-drawer" id="aiChatDrawer">
            <div class="ai-chat-header">
                <div class="ai-brand-info">
                    <div class="ai-avatar"><i class="fas fa-brain"></i></div>
                    <div>
                        <div class="ai-title">Chef &amp; Stylist AI</div>
                        <div class="ai-subtitle"><span class="online-dot"></span> Online Assistant</div>
                    </div>
                </div>
                <button class="modal-close-btn" id="aiChatCloseBtn" style="position:static; width:28px; height:28px;"><i class="fas fa-times"></i></button>
            </div>

            <!-- Quick Suggestion Chips -->
            <div class="ai-quick-chips">
                <button class="ai-chip" onclick="AIAssistant.sendPrompt('Recommend a dinner and outfit combo')">✨ Recommend Combo</button>
                <button class="ai-chip" onclick="AIAssistant.sendPrompt('Show vegetarian dishes')">🌱 Veg Dishes</button>
                <button class="ai-chip" onclick="AIAssistant.sendPrompt('Show silk party dresses')">👗 Party Dresses</button>
                <button class="ai-chip" onclick="AIAssistant.sendPrompt('Show items under $50')">💰 Under $50</button>
            </div>

            <!-- Chat Messages Log -->
            <div class="ai-chat-log" id="aiChatLog">
                <div class="ai-msg bot">
                    <div class="msg-bubble">
                        👋 Hi! I am your <strong>Taste &amp; Trend Chef &amp; Stylist AI</strong>. Ask me anything about gourmet dishes, dietary recommendations, fashion outfits, or budget picks!
                    </div>
                </div>
            </div>

            <!-- Input Area -->
            <form class="ai-chat-input-row" id="aiChatForm">
                <input type="text" id="aiChatInput" placeholder="Ask AI: 'veg pizza under $20' or 'evening dress'..." required autocomplete="off">
                <button type="submit" class="ai-send-btn" id="aiSendBtn"><i class="fas fa-paper-plane"></i></button>
            </form>
        </div>
        `;

        document.body.appendChild(container);
    },

    bindEvents() {
        document.getElementById('aiLauncherBtn')?.addEventListener('click', () => this.toggleDrawer());
        document.getElementById('aiChatCloseBtn')?.addEventListener('click', () => this.closeDrawer());
        
        document.getElementById('aiChatForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('aiChatInput');
            if (input && input.value.trim()) {
                const prompt = input.value.trim();
                input.value = '';
                this.sendPrompt(prompt);
            }
        });
    },

    toggleDrawer() {
        this.isOpen ? this.closeDrawer() : this.openDrawer();
    },

    openDrawer() {
        this.isOpen = true;
        document.getElementById('aiChatDrawer')?.classList.add('active');
        document.getElementById('aiLauncherBtn')?.classList.add('active');
    },

    closeDrawer() {
        this.isOpen = false;
        document.getElementById('aiChatDrawer')?.classList.remove('active');
        document.getElementById('aiLauncherBtn')?.classList.remove('active');
    },

    async sendPrompt(promptText) {
        this.openDrawer();
        const log = document.getElementById('aiChatLog');
        if (!log) return;

        // Render User Message Bubble
        const userMsg = document.createElement('div');
        userMsg.className = 'ai-msg user';
        userMsg.innerHTML = `<div class="msg-bubble">${promptText}</div>`;
        log.appendChild(userMsg);
        log.scrollTop = log.scrollHeight;

        // Render Typing Indicator
        const typingMsg = document.createElement('div');
        typingMsg.className = 'ai-msg bot typing';
        typingMsg.id = 'aiTypingIndicator';
        typingMsg.innerHTML = `<div class="msg-bubble"><i class="fas fa-spinner fa-spin"></i> AI is thinking...</div>`;
        log.appendChild(typingMsg);
        log.scrollTop = log.scrollHeight;

        try {
            const res = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: promptText })
            });
            const data = await res.json();
            
            document.getElementById('aiTypingIndicator')?.remove();

            if (data.success) {
                this.renderBotReply(data.reply, data.recommended_products);
            } else {
                this.renderBotReply('Sorry, I encountered an issue fetching recommendations.');
            }
        } catch (err) {
            console.error('AI error:', err);
            document.getElementById('aiTypingIndicator')?.remove();
            this.renderBotReply('Network error connecting to AI Assistant.');
        }
    },

    renderBotReply(replyText, products = []) {
        const log = document.getElementById('aiChatLog');
        if (!log) return;

        const botMsg = document.createElement('div');
        botMsg.className = 'ai-msg bot';

        let productsCardsHtml = '';
        if (products && products.length > 0) {
            productsCardsHtml = `
            <div class="ai-products-mini-grid">
                ${products.map(p => `
                <div class="ai-prod-card">
                    <img src="${p.image_url}" alt="${p.name}">
                    <div class="ai-prod-info">
                        <div class="ai-prod-title">${p.name}</div>
                        <div class="ai-prod-price">$${parseFloat(p.price).toFixed(2)}</div>
                        <div class="ai-prod-actions">
                            <button class="ai-card-add-btn" onclick="AIAssistant.quickAdd(${p.id})">+ Cart</button>
                            <button class="ai-card-buy-btn" onclick="AIAssistant.quickBuy(${p.id})">⚡ Buy</button>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>`;
        }

        botMsg.innerHTML = `
            <div class="msg-bubble">
                <div>${replyText}</div>
                ${productsCardsHtml}
            </div>
        `;

        log.appendChild(botMsg);
        log.scrollTop = log.scrollHeight;
    },

    async quickAdd(prodId) {
        try {
            const res = await fetch(`/api/products/${prodId}`);
            const data = await res.json();
            if (data.success && data.product) {
                CartModule.addItem(data.product, 1);
            }
        } catch (e) { console.error(e); }
    },

    async quickBuy(prodId) {
        try {
            const res = await fetch(`/api/products/${prodId}`);
            const data = await res.json();
            if (data.success && data.product) {
                CartModule.buyNow(data.product);
                this.closeDrawer();
            }
        } catch (e) { console.error(e); }
    }
};

document.addEventListener('DOMContentLoaded', () => AIAssistant.init());
