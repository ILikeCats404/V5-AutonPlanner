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
