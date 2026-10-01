/**
 * Taste & Trend - Adaptive Image & Media Optimizer
 * Dynamically adjusts image format/quality parameters, LQIP placeholders,
 * and controls background prefetching based on active performance tier.
 */

const ImageOptimizer = {
    init() {
        window.addEventListener('adaptive-tier-changed', (e) => {
            this.onTierChange(e.detail.tier);
        });
    },

    getOptimizedImageUrl(originalUrl, tier) {
        if (!originalUrl) return '';

        // Check if Unsplash or remote URL
        if (originalUrl.includes('unsplash.com')) {
            let width = 600;
            let quality = 80;
            let format = 'auto';

            if (tier === 'low') {
                width = 320; // Reduced dimensions for low tier & 3G
                quality = 35; // High compression to save bandwidth
                format = 'webp';
            } else if (tier === 'medium') {
                width = 450;
                quality = 60;
                format = 'webp';
            } else {
                width = 600;
                quality = 85;
                format = 'auto';
            }

            return `${originalUrl.split('?')[0]}?auto=format&fit=crop&w=${width}&q=${quality}&fm=${format}`;
        }

        return originalUrl;
    },

    onTierChange(tier) {
        console.log(`[ImageOptimizer] Updating media rendering strategy for ${tier.toUpperCase()} tier.`);
        
        if (tier === 'high') {
            this.enablePrefetching();
        } else {
            this.disablePrefetching();
        }
    },

    enablePrefetching() {
        if (document.getElementById('prefetchLinks')) return;

        console.log('[ImageOptimizer] High-End tier detected: Eager prefetching active categories...');
        const container = document.createElement('div');
        container.id = 'prefetchLinks';
        container.style.display = 'none';
        
        const categoriesLink = document.createElement('link');
        categoriesLink.rel = 'prefetch';
        categoriesLink.href = '/api/categories';
        categoriesLink.as = 'fetch';
        
        container.appendChild(categoriesLink);
        document.head.appendChild(container);
    },

    disablePrefetching() {
        const existing = document.getElementById('prefetchLinks');
        if (existing) {
            existing.remove();
            console.log('[ImageOptimizer] Low-End / Data-Saver tier detected: Background prefetching disabled to preserve quota.');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => ImageOptimizer.init());
