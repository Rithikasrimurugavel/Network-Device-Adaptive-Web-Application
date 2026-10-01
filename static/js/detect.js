(function () {
    // 1. Detect Network Capabilities
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const ect = connection ? connection.effectiveType : '4g'; // 'slow-2g', '2g', '3g', '4g'
    const saveData = connection ? connection.saveData : false;

    // 2. Detect Hardware Capabilities
    const memory = navigator.deviceMemory || 4; // Memory in GB
    const cores = navigator.hardwareConcurrency || 4; // CPU cores

    // 3. Classify Device Profile Tier
    let profile = 'high';
    if (saveData || ect === 'slow-2g' || ect === '2g' || ect === '3g' || memory <= 2 || cores <= 2) {
        profile = 'low';
    } else if (memory <= 4 || cores <= 4) {
        profile = 'medium';
    }

    // 4. Save state to cookies for server-side delivery optimization
    document.cookie = `device_profile=${profile}; path=/; SameSite=Lax`;
    document.cookie = `ect=${ect}; path=/; SameSite=Lax`;

    // 5. Expose globally on client
    window.ClientCapabilities = { profile, ect, saveData, memory, cores };
})();