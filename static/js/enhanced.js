// Enhanced UI Features (Only loaded on high-speed / high-tier devices)
console.log("Loading Enhanced JS Features: 3D/Hover Previews, Rich Analytics, Mouse-Track Animations");

document.addEventListener('DOMContentLoaded', () => {
    // Hover Zoom Effect for Product Cards
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'scale(1.03) translateY(-4px)';
            card.style.transition = 'transform 0.2s ease-in-out';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'scale(1) translateY(0)';
        });
    });
});