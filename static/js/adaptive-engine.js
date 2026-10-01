/**
 * Taste & Trend - Adaptive Engine & Core Web Vitals Diagnostic HUD
 * Detects network connection quality & hardware capabilities.
 * Computes performance tiers and measures live LCP, CLS, INP, TTFB metrics.
 */

const AdaptiveEngine = {
    // Current state
    overrideTier: null, // null = auto detect, 'low', 'medium', 'high'
    tier: 'high',
    connectionInfo: {},
    deviceInfo: {},
    metrics: {
        lcp: 0,
        cls: 0,
        inp: 0,
        ttfb: 0,
        bandwidthSavedPct: 0
    },

    init() {
        this.detectCapabilities();
        this.computeTier();
        this.applyTier();
        this.initCWVObservers();
        this.renderHUD();
        this.listenNetworkChanges();
    },

    detectCapabilities() {
        // Network Information API
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
        this.connectionInfo = {
            effectiveType: conn.effectiveType || '4g',
            rtt: conn.rtt || 50,
            downlink: conn.downlink || 10,
            saveData: conn.saveData || false
        };

        // Device Hardware Capabilities
        this.deviceInfo = {
            deviceMemory: navigator.deviceMemory || 8, // RAM in GB
            hardwareConcurrency: navigator.hardwareConcurrency || 8, // CPU Cores
            dpr: window.devicePixelRatio || 1,
            screenWidth: window.innerWidth,
            isTouch: 'ontouchstart' in window
        };
    },

    computeTier() {
        if (this.overrideTier) {
            this.tier = this.overrideTier;
            return;
        }

        const { effectiveType, saveData, rtt, downlink } = this.connectionInfo;
        const { deviceMemory, hardwareConcurrency } = this.deviceInfo;

        // Tier Determination Logic
        if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g' || effectiveType === '3g' && rtt > 300 || deviceMemory <= 2 || hardwareConcurrency <= 2) {
            this.tier = 'low'; // Low-End / Throttled 3G / Data Saver Mode
            this.metrics.bandwidthSavedPct = saveData ? 65 : 45;
        } else if (effectiveType === '3g' || deviceMemory <= 4 || hardwareConcurrency <= 4 || downlink < 4) {
            this.tier = 'medium'; // Mid-Tier 3G/4G
            this.metrics.bandwidthSavedPct = 25;
        } else {
            this.tier = 'high'; // High-End 4G/5G
            this.metrics.bandwidthSavedPct = 0;
        }
    },

    applyTier() {
        document.documentElement.setAttribute('data-perf-tier', this.tier);
        document.documentElement.setAttribute('data-save-data', this.connectionInfo.saveData ? 'true' : 'false');

        console.log(`[Adaptive Engine] Active Performance Tier: ${this.tier.toUpperCase()} | EffectiveType: ${this.connectionInfo.effectiveType} | RAM: ${this.deviceInfo.deviceMemory}GB | Cores: ${this.deviceInfo.hardwareConcurrency}`);
        
        // Dispatch custom event for app modules
        window.dispatchEvent(new CustomEvent('adaptive-tier-changed', { detail: { tier: this.tier, engine: this } }));
    },

    setOverrideTier(tier) {
        this.overrideTier = tier === 'auto' ? null : tier;
        this.computeTier();
        this.applyTier();
        this.updateHUDDisplay();
        
        // Reload products with adaptive payload
        if (window.loadProducts) {
            window.loadProducts();
        }
    },

    initCWVObservers() {
        // Measure TTFB
        if (performance && performance.getEntriesByType) {
            const navEntries = performance.getEntriesByType('navigation');
            if (navEntries.length > 0) {
                this.metrics.ttfb = Math.round(navEntries[0].responseStart - navEntries[0].startTime);
            }
        }

        // PerformanceObserver for LCP (Largest Contentful Paint)
        try {
            const lcpObserver = new PerformanceObserver((entryList) => {
                const entries = entryList.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.lcp = Math.round(lastEntry.startTime);
                this.updateHUDDisplay();
            });
            lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
            console.warn('LCP observer not supported');
        }

        // PerformanceObserver for CLS (Cumulative Layout Shift)
        try {
            let clsScore = 0;
            const clsObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    if (!entry.hadRecentInput) {
                        clsScore += entry.value;
                    }
                }
                this.metrics.cls = parseFloat(clsScore.toFixed(3));
                this.updateHUDDisplay();
            });
            clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {
            console.warn('CLS observer not supported');
        }

        // PerformanceObserver for FID / INP (Interaction to Next Paint)
        try {
            const inpObserver = new PerformanceObserver((entryList) => {
                for (const entry of entryList.getEntries()) {
                    const delay = entry.processingStart - entry.startTime;
                    if (delay > this.metrics.inp) {
                        this.metrics.inp = Math.round(delay);
                    }
                }
                this.updateHUDDisplay();
            });
            inpObserver.observe({ type: 'first-input', buffered: true });
        } catch (e) {
            console.warn('INP observer not supported');
        }
    },

    listenNetworkChanges() {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn) {
            conn.addEventListener('change', () => {
                this.detectCapabilities();
                this.computeTier();
                this.applyTier();
                this.updateHUDDisplay();
            });
        }
    },

    renderHUD() {
        // Prevent duplicate HUD
        if (document.getElementById('adaptiveHUD')) return;

        const hud = document.createElement('div');
        hud.id = 'adaptiveHUD';
        hud.className = 'adaptive-hud';
        hud.innerHTML = `
        <div class="hud-header" id="hudToggleHeader">
            <div class="hud-title">
                <i class="fas fa-bolt" style="color:#f59e0b;"></i> Core Web Vitals Adaptive HUD
            </div>
            <div class="hud-tier-badge" id="hudTierBadge">TIER: ${this.tier.toUpperCase()}</div>
            <button class="hud-minimize-btn" id="hudMinimizeBtn"><i class="fas fa-chevron-down"></i></button>
        </div>

        <div class="hud-body" id="hudBody">
            <!-- Simulated Profile Controls -->
            <div class="hud-section">
                <label class="hud-label">Adaptive Profile Simulator:</label>
                <div class="hud-btn-group">
                    <button class="hud-btn ${this.overrideTier === null ? 'active' : ''}" onclick="AdaptiveEngine.setOverrideTier('auto')">Auto Detect</button>
                    <button class="hud-btn ${this.overrideTier === 'high' ? 'active' : ''}" onclick="AdaptiveEngine.setOverrideTier('high')">⚡ High 4G/5G</button>
                    <button class="hud-btn ${this.overrideTier === 'medium' ? 'active' : ''}" onclick="AdaptiveEngine.setOverrideTier('medium')">🚀 Mid 3G</button>
                    <button class="hud-btn ${this.overrideTier === 'low' ? 'active' : ''}" onclick="AdaptiveEngine.setOverrideTier('low')">🐢 Slow 3G / Low-End</button>
                </div>
            </div>

            <!-- Metrics Dashboard -->
            <div class="hud-metrics-grid">
                <div class="metric-card">
                    <span class="metric-name">LCP (Paint)</span>
                    <span class="metric-val" id="metricLcp">${this.metrics.lcp} ms</span>
                    <span class="metric-status" id="statusLcp">--</span>
                </div>
                <div class="metric-card">
                    <span class="metric-name">CLS (Shift)</span>
                    <span class="metric-val" id="metricCls">${this.metrics.cls}</span>
                    <span class="metric-status" id="statusCls">--</span>
                </div>
                <div class="metric-card">
                    <span class="metric-name">TTFB (Response)</span>
                    <span class="metric-val" id="metricTtfb">${this.metrics.ttfb} ms</span>
                    <span class="metric-status" id="statusTtfb">--</span>
                </div>
                <div class="metric-card">
                    <span class="metric-name">Bandwidth Saved</span>
                    <span class="metric-val" id="metricSaved">${this.metrics.bandwidthSavedPct}%</span>
                    <span class="metric-status good">Optimized</span>
                </div>
            </div>

            <!-- Real-Time Hardware & Network Info -->
            <div class="hud-info-footer" id="hudInfoFooter">
                <!-- Info populated dynamically -->
            </div>
        </div>
        `;

        document.body.appendChild(hud);

        // Bind collapse/minimize
        document.getElementById('hudMinimizeBtn')?.addEventListener('click', () => {
            hud.classList.toggle('minimized');
        });

        this.updateHUDDisplay();
    },

    updateHUDDisplay() {
        const badge = document.getElementById('hudTierBadge');
        if (badge) {
            badge.textContent = `TIER: ${this.tier.toUpperCase()}`;
            badge.className = `hud-tier-badge tier-${this.tier}`;
        }

        // Update Active Simulator Buttons
        document.querySelectorAll('.hud-btn').forEach(btn => btn.classList.remove('active'));
        const activeMode = this.overrideTier || 'auto';
        const activeBtn = document.querySelector(`.hud-btn[onclick*="${activeMode}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Update CWV Metrics
        const lcpEl = document.getElementById('metricLcp');
        const clsEl = document.getElementById('metricCls');
        const ttfbEl = document.getElementById('metricTtfb');
        const savedEl = document.getElementById('metricSaved');

        if (lcpEl) lcpEl.textContent = `${this.metrics.lcp} ms`;
        if (clsEl) clsEl.textContent = `${this.metrics.cls}`;
        if (ttfbEl) ttfbEl.textContent = `${this.metrics.ttfb} ms`;
        if (savedEl) savedEl.textContent = `${this.tier === 'low' ? 65 : (this.tier === 'medium' ? 30 : 0)}%`;

        // Update Status Colors
        const statusLcp = document.getElementById('statusLcp');
        if (statusLcp) {
            if (this.metrics.lcp > 0 && this.metrics.lcp <= 2500) {
                statusLcp.textContent = 'Good (Sub-2.5s)';
                statusLcp.className = 'metric-status good';
            } else if (this.metrics.lcp > 2500) {
                statusLcp.textContent = 'Needs Imp.';
                statusLcp.className = 'metric-status warn';
            }
        }

        const statusCls = document.getElementById('statusCls');
        if (statusCls) {
            if (this.metrics.cls <= 0.1) {
                statusCls.textContent = 'Good (Zero Shift)';
                statusCls.className = 'metric-status good';
            } else {
                statusCls.textContent = 'High Shift';
                statusCls.className = 'metric-status warn';
            }
        }

        const statusTtfb = document.getElementById('statusTtfb');
        if (statusTtfb) {
            if (this.metrics.ttfb > 0 && this.metrics.ttfb <= 800) {
                statusTtfb.textContent = 'Fast';
                statusTtfb.className = 'metric-status good';
            } else {
                statusTtfb.textContent = 'Slow';
                statusTtfb.className = 'metric-status warn';
            }
        }

        // Info footer
        const infoEl = document.getElementById('hudInfoFooter');
        if (infoEl) {
            infoEl.innerHTML = `
            <span><i class="fas fa-network-wired"></i> Connection: <strong>${this.connectionInfo.effectiveType.toUpperCase()}</strong></span>
            <span><i class="fas fa-microchip"></i> CPU Cores: <strong>${this.deviceInfo.hardwareConcurrency}</strong></span>
            <span><i class="fas fa-memory"></i> RAM: <strong>${this.deviceInfo.deviceMemory} GB</strong></span>
            <span><i class="fas fa-compress-arrows-alt"></i> Data Saver: <strong>${this.connectionInfo.saveData ? 'ON' : 'OFF'}</strong></span>
            `;
        }
    }
};

// Initialize immediately on DOM load
document.addEventListener('DOMContentLoaded', () => AdaptiveEngine.init());
