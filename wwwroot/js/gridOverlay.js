(function() {
    function adjustGridOverlays() {
        document.querySelectorAll('.grid-container').forEach(container => {
            const img = container.querySelector('img');
            const overlay = container.querySelector('.grid-overlay');
            if (!img || !overlay) return;

            // Use rendered dimensions
            const width = img.clientWidth;
            const height = img.clientHeight;
            if (width === 0 || height === 0) return;

            // Ensure container matches the image size
            container.style.width = width + 'px';
            container.style.height = height + 'px';

            // Position and size overlay exactly over the image
            overlay.style.position = 'absolute';
            overlay.style.left = '0px';
            overlay.style.top = '0px';
            overlay.style.width = width + 'px';
            overlay.style.height = height + 'px';
            overlay.style.pointerEvents = 'auto';

            // Compute cell size and set explicit px grid so we avoid fractional rounding issues
            const cols = overlay.dataset.cols ? parseInt(overlay.dataset.cols) : 144;
            const rows = overlay.dataset.rows ? parseInt(overlay.dataset.rows) : 144;
            // Compute integer cell sizes so the columns/rows sum exactly to the image size
            const baseCellW = Math.floor(width / cols);
            const baseCellH = Math.floor(height / rows);
            const remW = width - (baseCellW * cols);
            const remH = height - (baseCellH * rows);

            // Build explicit column widths: use baseCellW for all but distribute remainder to the last column
            const colsArr = new Array(cols).fill(baseCellW);
            if (remW > 0) colsArr[cols - 1] = baseCellW + remW;
            const rowsArr = new Array(rows).fill(baseCellH);
            if (remH > 0) rowsArr[rows - 1] = baseCellH + remH;

            overlay.style.gridTemplateColumns = colsArr.map(w => w + 'px').join(' ');
            overlay.style.gridTemplateRows = rowsArr.map(h => h + 'px').join(' ');
            overlay.style.overflow = 'hidden';
        });
    }

    // Run after images load
    function init() {
        adjustGridOverlays();

        // Recalculate on window resize
        window.addEventListener('resize', () => {
            // small timeout to allow layout to stabilize
            setTimeout(adjustGridOverlays, 50);
        });

        // Also observe DOM changes in case image src changes
        const observer = new MutationObserver(() => adjustGridOverlays());
        observer.observe(document.body, { childList: true, subtree: true });

        // If images load later, ensure we recalc
        document.querySelectorAll('.grid-container img').forEach(img => {
            if (!img.complete) {
                img.addEventListener('load', adjustGridOverlays);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// Expose helper to Blazor for converting inch coordinates to pixel coordinates
window.gridOverlay = {
    // points: array of { x: number, y: number } in inches (1..144)
    // selector: CSS selector for the image (defaults to first '.grid-container img')
    computePoints: function (points, selector) {
        var img = null;
        if (selector) img = document.querySelector(selector);
        if (!img) img = document.querySelector('.grid-container img');
        if (!img) return null;

        var container = img.closest('.grid-container');
        var overlay = container ? container.querySelector('.grid-overlay') : null;
        var rect = img.getBoundingClientRect();
        var width = rect.width;
        var height = rect.height;

        // determine field size (inches per side) from overlay dataset or default to 144
        var fieldSize = 144.0;
        if (overlay && overlay.dataset && overlay.dataset.cols) {
            var parsed = parseInt(overlay.dataset.cols);
            if (!isNaN(parsed) && parsed > 0) fieldSize = parsed;
        }

        var out = [];
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            // treat coordinates as 1-based inches and map to cell centers: clamp to [0.5, fieldSize-0.5]
            var xIn = Number(p.x);
            var yIn = Number(p.y);
            if (isNaN(xIn)) xIn = 0.5;
            if (isNaN(yIn)) yIn = 0.5;
            xIn = Math.max(0.5, Math.min(fieldSize - 0.5, xIn));
            yIn = Math.max(0.5, Math.min(fieldSize - 0.5, yIn));

            // map inches to pixels using cell centers
            var xPx = ((xIn - 0.5) / fieldSize) * width;
            var yPx = ((yIn - 0.5) / fieldSize) * height;

            out.push([xPx, yPx]);
        }

        return { width: width, height: height, points: out };
    },

    // Compute a safe menu position so the inline menu fits inside the grid container.
    // col and row are 1-based grid coordinates (inches). selector optional to target image.
    computeMenuPosition: function (col, row, selector) {
        var img = null;
        if (selector) img = document.querySelector(selector);
        if (!img) img = document.querySelector('.grid-container img');
        if (!img) return null;

        var container = img.closest('.grid-container');
        if (!container) return null;
        var overlay = container.querySelector('.grid-overlay');
        if (!overlay) return null;

        var cols = overlay.dataset.cols ? parseInt(overlay.dataset.cols) : 144;
        var rows = overlay.dataset.rows ? parseInt(overlay.dataset.rows) : 144;

        var ovRect = overlay.getBoundingClientRect();
        var cellW = ovRect.width / cols;
        var cellH = ovRect.height / rows;

        // Allow callers to pass 0..cols; clamp to valid cell-center range [0.5, cols-0.5]
        var c = Number(col);
        var r = Number(row);
        if (isNaN(c)) c = 0.5;
        if (isNaN(r)) r = 0.5;
        c = Math.max(0.5, Math.min(cols - 0.5, c));
        r = Math.max(0.5, Math.min(rows - 0.5, r));

        // center of the clicked cell in pixels relative to overlay
        var centerX = (c - 0.5) * cellW;
        var centerY = (r - 0.5) * cellH;

        var menuEl = container.querySelector('.cell-menu');
        var menuW = menuEl ? menuEl.offsetWidth : Math.min(220, ovRect.width * 0.25);
        var menuH = menuEl ? menuEl.offsetHeight : 160;

        // Clamp horizontal center so menu fits after translate(-50%)
        var clampedCenterX = Math.max(menuW / 2, Math.min(ovRect.width - menuW / 2, centerX));
        var leftPercent = (clampedCenterX / ovRect.width) * 100.0;

        // Decide whether to place above or below based on available space around the center
        var spaceAbove = centerY;
        var spaceBelow = ovRect.height - centerY;
        var placeAbove = false;
        if (spaceBelow >= menuH + 8) {
            placeAbove = false; // place below
        } else if (spaceAbove >= menuH + 8) {
            placeAbove = true; // place above
        } else {
            // Neither side has full space: pick side with more room and we'll clamp the position so it fits
            placeAbove = (spaceAbove > spaceBelow);
        }

        var topPercent;
        if (placeAbove) {
            // We want the menu's bottom to be at (centerY - 8)
            var bottomPx = centerY - 8;
            // Ensure bottomPx is at least menuH (so menu top >= 0) and not above the overlay
            bottomPx = Math.max(menuH, Math.min(ovRect.height, bottomPx));
            topPercent = (bottomPx / ovRect.height) * 100.0;
        } else {
            // We want the menu's top to be at (centerY + 8)
            var topPx = centerY + 8;
            // Ensure topPx + menuH <= ovRect.height
            topPx = Math.max(0, Math.min(ovRect.height - menuH, topPx));
            topPercent = (topPx / ovRect.height) * 100.0;
        }

        return { leftPercent: leftPercent, topPercent: topPercent, placeAbove: placeAbove };
    }
};
