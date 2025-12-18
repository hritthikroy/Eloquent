// Shared utilities for Eloquent
// This file contains common functions used across multiple files

// Time formatting
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

// Color constants - single source of truth
const COLORS = {
    gradients: {
        primary: 'linear-gradient(90deg, #00d4ff, #0099ff)',
        purple: 'linear-gradient(135deg, #a855f7, #7c3aed)',
        red: 'linear-gradient(90deg, #ff3b30, #cc0000)',
        orange: 'linear-gradient(90deg, #ffaa00, #ff8800)'
    },
    primary: {
        cyan: '#00d4ff',
        blue: '#0099ff'
    },
    ai: {
        purple: '#a855f7',
        darkPurple: '#7c3aed'
    },
    warning: {
        red: '#ff3b30',
        darkRed: '#cc0000',
        orange: '#ffaa00',
        darkOrange: '#ff8800'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatTime, COLORS };
}
