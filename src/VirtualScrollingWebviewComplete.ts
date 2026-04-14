export function getVirtualScrollingHTMLComplete(metadata: any): string {
    const fileName = metadata.file_path.split(/[\\/]/).pop();

    // Generate variable list HTML
    const variableList = metadata.variables.map((variable: any, index: number) => {
        const icon = getVariableIcon(variable);
        const varName = escapeHtml(variable.name);
        const varLabel = variable.label ? escapeHtml(variable.label) : '';
        const tooltipText = escapeHtml(getVariableTooltipText(variable));
        return `
            <div class="variable-item">
                <input type="checkbox" checked id="var-${index}" data-column-index="${index}" class="column-toggle">
                <span class="variable-text show-both" title="${tooltipText}">${icon} ${varName}${varLabel && varLabel !== varName ? ` (${varLabel})` : ''}</span>
            </div>`;
    }).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval';">
        <title>${fileName} - Dataset Lens</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-foreground);
                margin: 0;
                padding: 10px;
                overflow: hidden;
                height: 100vh; /* Ensure full height */
            }

            .header {
                display: grid;
                grid-template-columns: minmax(250px, 1fr) minmax(300px, 1fr) minmax(200px, 1fr);
                gap: 20px;
                padding: 15px 20px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
                border: 1px solid var(--vscode-panel-border);
                margin-bottom: 10px;
            }

            .header-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .section-title {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 4px;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                font-size: 13px;
            }

            .stat-item {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .dropdown {
                padding: 4px 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 2px;
                font-size: 12px;
                cursor: pointer;
            }

            .btn {
                padding: 4px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
            }

            .btn:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .btn-secondary {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .btn-secondary:hover {
                background: var(--vscode-button-secondaryHoverBackground);
            }

            .main-container {
                display: flex;
                gap: 10px;
                height: calc(100vh - 180px);
                min-height: 400px; /* Add minimum height */
            }

            .sidebar {
                width: 300px;
                min-width: 250px; /* Add minimum width */
                flex-shrink: 0; /* Prevent shrinking */
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                z-index: 10; /* Ensure visibility */
            }

            .sidebar-header {
                padding: 12px;
                background: var(--vscode-sideBarSectionHeader-background);
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .sidebar-title {
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 8px;
            }

            .selected-count {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 10px;
            }

            .variables-container {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }

            .variable-item {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 6px;
                border-radius: 3px;
                font-size: 12px;
                cursor: pointer;
                user-select: none; /* Prevent text selection when clicking */
            }

            .variable-item:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .variable-item input[type="checkbox"] {
                cursor: pointer;
            }

            .variable-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .data-area {
                flex: 1;
                display: flex;
                flex-direction: column;
            }

            .data-stats {
                margin-bottom: 10px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .virtual-scroller {
                flex: 1;
                overflow-y: auto;
                position: relative;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 3px;
            }

            .virtual-spacer {
                position: absolute;
                top: 0;
                left: 0;
                width: 1px;
                pointer-events: none;
            }

            .virtual-content {
                position: relative; /* Changed from absolute to relative */
                min-height: 100%;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
                min-width: max-content;
            }

            thead {
                position: sticky;
                top: 0;
                z-index: 20;
                background: var(--vscode-editor-background);
            }

            th {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 8px;
                text-align: left;
                font-weight: 600;
                position: relative; /* Ensure proper stacking */
            }

            td {
                border: 1px solid var(--vscode-panel-border);
                padding: 6px 8px;
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            tr:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .loading-indicator {
                text-align: center;
                padding: 20px;
                display: none;
                background: var(--vscode-editor-background);
                border-top: 1px solid var(--vscode-panel-border);
            }

            .loading-indicator.active {
                display: block;
            }

            .filter-section {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .filter-input {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .where-input {
                flex: 1;
                padding: 4px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                font-size: 12px;
            }

            .where-input:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-section">
                <div class="section-title">Dataset Info</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span>📁</span>
                        <span title="${fileName}">${fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName}</span>
                    </div>
                    <div class="stat-item">
                        <span>📊</span>
                        <span id="row-count">${metadata.total_rows.toLocaleString()}</span> rows
                    </div>
                    <div class="stat-item">
                        <span>📋</span>
                        <span>${metadata.total_variables}</span> variables
                    </div>
                    <div class="stat-item">
                        <span>🔍</span>
                        <span id="filtered-count">All rows</span>
                    </div>
                </div>
                ${metadata.dataset_label ? '<div style="grid-column: span 2; font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px;">📝 ' + escapeHtml(metadata.dataset_label) + '</div>' : ''}
            </div>

            <div class="header-section center">
                <div class="section-title">Filtering</div>
                <div class="filter-section">
                    <div class="filter-input">
                        <input type="text" class="where-input" placeholder="e.g., age > 30 and country = 'USA'" id="where-clause">
                    </div>
                    <div class="filter-input">
                        <button class="btn" id="apply-filter-btn">Apply</button>
                        <button class="btn btn-secondary" id="clear-filter-btn">Clear</button>
                    </div>
                </div>
            </div>

            <div class="header-section">
                <div class="section-title">View Options</div>
                <div class="controls">
                    <select class="dropdown" id="display-mode">
                        <option value="both">Name + Label</option>
                        <option value="name">Name Only</option>
                        <option value="label">Label Only</option>
                    </select>
                    <button class="btn" id="metadata-btn">📊 Metadata</button>
                </div>
            </div>
        </div>

        <div class="main-container">
            <div class="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-title">Variables</div>
                    <div class="selected-count" id="selected-count">
                        ${metadata.total_variables} selected
                    </div>
                    <div style="margin-bottom: 15px;">
                        <button class="btn" id="select-all-btn" style="margin-right: 8px;">Select All</button>
                        <button class="btn btn-secondary" id="deselect-all-btn">Deselect All</button>
                    </div>
                </div>
                <div class="variables-container">
                    ${variableList}
                </div>
            </div>

            <div class="data-area">
                <div class="data-stats" id="data-stats">
                    Showing <span id="visible-rows">0</span> of <span id="total-data-rows">${metadata.total_rows.toLocaleString()}</span> rows
                </div>
                <div class="virtual-scroller" id="data-scroller">
                    <div class="virtual-spacer" id="virtual-spacer"></div>
                    <div class="virtual-content" id="virtual-content">
                        <table id="data-table">
                            <thead id="table-header">
                                <tr></tr>
                            </thead>
                            <tbody id="table-body"></tbody>
                        </table>
                    </div>
                    <div class="loading-indicator" id="loading-indicator">
                        Loading more data...
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Acquire VS Code API
            const vscode = acquireVsCodeApi();

            // Global state
            let allData = []; // This will store ALL loaded data
            let columns = [];
            let metadata = {};
            let selectedColumns = [];
            let filteredData = [];
            let displayMode = 'both';
            let totalDataRows = 0; // Track total rows in dataset

            // Virtual Scrolling Implementation
            class VirtualScroller {
                constructor() {
                    this.rowHeight = 30;
                    this.viewportHeight = 600;
                    this.bufferSize = 20;
                    this.chunkSize = 100;
                    this.totalRows = 0;
                    this.loadedData = new Map();
                    this.visibleRange = { start: 0, end: 0 };
                    this.isLoading = false;
                    this.whereClause = '';

                    this.scroller = document.getElementById('data-scroller');
                    this.spacer = document.getElementById('virtual-spacer');
                    this.content = document.getElementById('virtual-content');
                    this.tbody = document.getElementById('table-body');
                    this.header = document.getElementById('table-header')?.querySelector('tr');
                    this.loadingIndicator = document.getElementById('loading-indicator');
                    
                    // CRITICAL FIX: Check if elements exist, if not, the HTML wasn't loaded properly
                    if (!this.scroller || !this.tbody) {
                        console.error('CRITICAL ERROR: DOM elements not found!');
                        console.error('Scroller:', !!this.scroller, 'TBody:', !!this.tbody);
                        console.error('Available elements:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
                        
                        // Try to create basic structure as fallback
                        this.createFallbackDOM();
                    }

                    this.setupScrollHandler();
                }

                createFallbackDOM() {
                    console.log('Creating fallback DOM structure...');
                    
                    // Create basic structure if missing
                    if (!document.getElementById('data-scroller')) {
                        const container = document.createElement('div');
                        container.innerHTML = 
                            '<div class="virtual-scroller" id="data-scroller" style="height: 600px; overflow-y: auto; border: 1px solid #ccc;">' +
                                '<div class="virtual-spacer" id="virtual-spacer"></div>' +
                                '<div class="virtual-content" id="virtual-content">' +
                                    '<table id="data-table" style="width: 100%; border-collapse: collapse;">' +
                                        '<thead id="table-header"><tr></tr></thead>' +
                                        '<tbody id="table-body"></tbody>' +
                                    '</table>' +
                                '</div>' +
                                '<div class="loading-indicator" id="loading-indicator">Loading...</div>' +
                            '</div>';
                        document.body.appendChild(container);
                        
                        // Re-initialize elements
                        this.scroller = document.getElementById('data-scroller');
                        this.spacer = document.getElementById('virtual-spacer');
                        this.content = document.getElementById('virtual-content');
                        this.tbody = document.getElementById('table-body');
                        this.header = document.getElementById('table-header').querySelector('tr');
                        this.loadingIndicator = document.getElementById('loading-indicator');
                        
                        console.log('Fallback DOM created successfully');
                    }
                }

                setupScrollHandler() {
                    let scrollTimeout;
                    this.scroller.addEventListener('scroll', () => {
                        clearTimeout(scrollTimeout);
                        scrollTimeout = setTimeout(() => this.handleScroll(), 50);
                    });

                    // Calculate viewport height after DOM is ready
                    setTimeout(() => {
                        this.viewportHeight = this.scroller.clientHeight || 600;
                        console.log('Viewport height calculated:', this.viewportHeight);
                        this.handleScroll(); // Trigger initial render
                    }, 100);

                    // Update on resize
                    new ResizeObserver(() => {
                        const newHeight = this.scroller.clientHeight;
                        if (newHeight > 0) {
                            this.viewportHeight = newHeight;
                            console.log('Viewport height updated:', this.viewportHeight);
                            this.handleScroll();
                        }
                    }).observe(this.scroller);
                }

                handleScroll() {
                    const scrollTop = this.scroller.scrollTop || 0;
                    const viewHeight = this.viewportHeight || this.scroller.clientHeight || 600;

                    const startRow = Math.floor(scrollTop / this.rowHeight);
                    const endRow = Math.ceil((scrollTop + viewHeight) / this.rowHeight);

                    // Expand range to trigger chunk loading earlier
                    this.visibleRange = {
                        start: Math.max(0, startRow - this.bufferSize),
                        end: Math.min(this.totalRows, endRow + this.bufferSize) // Normal buffer size
                    };

                    const maxLoadedKey = this.loadedData.size > 0 ? Math.max(...Array.from(this.loadedData.keys())) : -1;
                    console.log('handleScroll: scrollTop=', scrollTop, 'viewHeight=', viewHeight,
                              'visibleRange=', this.visibleRange.start, '-', this.visibleRange.end,
                              'maxLoaded=', maxLoadedKey);

                    // Additional debugging for the specific issue
                    if (this.visibleRange.start > 172) {
                        console.log('SCROLL DEBUG: Requesting data beyond row 172');
                        console.log('LoadedData has keys:', Array.from(this.loadedData.keys()).slice(0, 10), '...', Array.from(this.loadedData.keys()).slice(-10));
                        
                        // Check if we have data in the range we think we do
                        let actualDataCount = 0;
                        for (let i = 0; i <= maxLoadedKey; i++) {
                            const data = this.loadedData.get(i);
                            if (data && Object.keys(data).length > 0) {
                                actualDataCount++;
                            }
                        }
                        console.log('Actual data rows with content:', actualDataCount);
                    }

                    this.loadVisibleData();
                }

                async loadVisibleData() {
                    if (this.isLoading) {
                        console.log('Already loading, skipping loadVisibleData');
                        return;
                    }

                    const { start, end } = this.visibleRange;
                    console.log('=== CHUNK LOADING DEBUG ===');
                    console.log('loadVisibleData: checking range', start, 'to', end);
                    console.log('Total rows:', this.totalRows);
                    console.log('Loaded data size:', this.loadedData.size);
                    console.log('Sample loaded keys:', Array.from(this.loadedData.keys()).slice(0, 10));

                    // For client-side filtering, use filtered data
                    if (this.whereClause && filteredData.length > 0) {
                        console.log('Using filtered data, skipping chunk loading');
                        this.renderFilteredRows();
                        return;
                    }

                    // Check for missing data and load chunks
                    const missingRanges = this.findMissingRanges(start, end);
                    console.log('Missing ranges found:', missingRanges);

                    if (missingRanges.length === 0) {
                        console.log('No missing data, rendering visible rows');
                        this.renderVisibleRows();
                        return;
                    }

                    console.log('NEED TO LOAD', missingRanges.length, 'chunks:', missingRanges);
                    this.isLoading = true;
                    this.loadingIndicator.classList.add('active');

                    try {
                        for (const range of missingRanges) {
                            console.log('=== LOADING CHUNK ===');
                            console.log('Range:', range.start, '-', range.end, '(', range.end - range.start, 'rows )');
                            await this.loadChunk(range.start, range.end - range.start);
                            console.log('Chunk completed. Loaded data size now:', this.loadedData.size);
                        }
                    } catch (error) {
                        console.error('ERROR LOADING CHUNKS:', error);
                    }

                    this.loadingIndicator.classList.remove('active');
                    this.isLoading = false;
                    console.log('=== CHUNK LOADING COMPLETE ===');
                    this.renderVisibleRows();
                }

                findMissingRanges(start, end) {
                    const ranges = [];
                    let currentStart = null;
                    let missingCount = 0;

                    // Debug: Check what's actually in loadedData for this range
                    let actuallyLoaded = 0;
                    const maxLoadedKey = Math.max(...Array.from(this.loadedData.keys()));
                    
                    console.log('=== MISSING RANGE DEBUG ===');
                    console.log('Checking range:', start, '-', end);
                    console.log('Total dataset rows:', this.totalRows);
                    console.log('LoadedData size:', this.loadedData.size);
                    console.log('Max loaded key:', maxLoadedKey);
                    
                    // Check if we're asking for data beyond what's loaded
                    if (start > maxLoadedKey) {
                        console.log('REQUESTING DATA BEYOND LOADED RANGE! start:', start, 'maxLoaded:', maxLoadedKey);
                        // This should trigger chunk loading
                        ranges.push({ start: start, end: Math.min(end, this.totalRows) });
                        return ranges;
                    }
                    
                    // TARGETED FIX: Force chunk loading for rows beyond 152 (where data stops showing)
                    if (start > 152) {
                        console.log('🔥 FORCING CHUNK LOAD beyond row 152 - start:', start, 'end:', end);
                        ranges.push({ start: Math.max(start, 153), end: Math.min(end, this.totalRows) });
                        return ranges;
                    }

                    for (let i = start; i < end && i < this.totalRows; i++) {
                        const hasRow = this.loadedData.has(i);
                        const rowData = this.loadedData.get(i);

                        // Check if we actually have data (not just a key)
                        if (hasRow && rowData !== undefined && rowData !== null) {
                            actuallyLoaded++;
                        } else {
                            missingCount++;
                            if (currentStart === null) currentStart = i;
                        }

                        // If we have data and were tracking missing range, close it
                        if (hasRow && rowData !== undefined && currentStart !== null) {
                            ranges.push({ start: currentStart, end: i });
                            currentStart = null;
                        }
                    }

                    if (currentStart !== null) {
                        ranges.push({ start: currentStart, end: Math.min(end, this.totalRows) });
                    }

                    console.log('findMissingRanges: range', start, '-', end,
                              'actuallyLoaded:', actuallyLoaded, 'missing:', missingCount,
                              'ranges found:', ranges.length);
                    
                    // Additional debugging for the specific issue - ALWAYS check when beyond 172
                    if (start > 172) {
                        console.log('=== DATA CONTENT DEBUG (beyond row 172) ===');
                        console.log('Checking actual data content for rows', start, 'to', Math.min(start + 5, end));
                        for (let i = start; i < Math.min(start + 5, end); i++) {
                            const data = this.loadedData.get(i);
                            console.log('Row', i, ':', data ? Object.keys(data) : 'NO DATA', data ? Object.values(data).slice(0, 3) : 'N/A');
                        }
                        
                        // Also check some earlier rows that should be visible
                        console.log('Comparison - checking rows around 170-175:');
                        for (let i = 170; i <= 175; i++) {
                            const data = this.loadedData.get(i);
                            console.log('Row', i, ':', data ? 'HAS DATA' : 'NO DATA', data ? Object.keys(data).length + ' columns' : 'N/A');
                        }
                    }

                    return ranges;
                }

                async loadChunk(startRow, numRows) {
                    console.log('loadChunk called for rows', startRow, 'to', startRow + numRows);

                    // Check if we already have all data for this range
                    let hasAllData = true;
                    for (let i = startRow; i < startRow + numRows && i < this.totalRows; i++) {
                        if (!this.loadedData.has(i)) {
                            hasAllData = false;
                            break;
                        }
                    }

                    if (hasAllData) {
                        console.log('All data already in cache for range', startRow, '-', startRow + numRows);
                        return;
                    }

                    // For filtered data, use local array
                    if (filteredData && filteredData.length > 0 && startRow < filteredData.length) {
                        console.log('Using local filtered data for chunk:', startRow);
                        for (let i = 0; i < numRows && (startRow + i) < filteredData.length; i++) {
                            const rowIndex = startRow + i;
                            if (!this.loadedData.has(rowIndex)) {
                                this.loadedData.set(rowIndex, filteredData[rowIndex]);
                            }
                        }
                        return;
                    }

                    // Need to load from backend
                    console.log('Loading chunk from backend:', startRow, 'to', startRow + numRows);

                    // Otherwise, try to load from backend
                    const MAX_RETRIES = 2;
                    let retries = 0;

                    while (retries < MAX_RETRIES) {
                        try {
                            await this.loadChunkWithTimeout(startRow, numRows);
                            return; // Success
                        } catch (error) {
                            retries++;
                            console.warn('Chunk load failed (attempt ' + retries + '/' + MAX_RETRIES + '):', error);

                            if (retries === MAX_RETRIES) {
                                console.error('Failed to load chunk after max retries:', startRow);
                                // Generate placeholder data as last resort
                                this.generatePlaceholderData(startRow, numRows);
                                return;
                            }

                            // Shorter delay between retries
                            await new Promise(resolve => setTimeout(resolve, 500 * retries));
                        }
                    }
                }

                async loadChunkWithTimeout(startRow, numRows) {
                    console.log('=== CHUNK REQUEST DEBUG ===');
                    console.log('loadChunkWithTimeout: requesting rows', startRow, 'to', startRow + numRows);
                    console.log('Chunk size limit:', this.chunkSize);
                    console.log('Actual rows to request:', Math.min(numRows, this.chunkSize));

                    return new Promise((resolve, reject) => {
                        let handler;
                        let timeoutId;
                        let requestSent = false;

                        // Setup handler BEFORE sending request
                        handler = (event) => {
                            console.log('=== MESSAGE RECEIVED ===');
                            console.log('Message type:', event.data.type);
                            console.log('Message startRow:', event.data.startRow);
                            console.log('Expected startRow:', startRow);
                            
                            if (event.data.type === 'dataChunk') {
                                console.log('DataChunk message details:', {
                                    startRow: event.data.startRow,
                                    dataLength: event.data.data ? event.data.data.length : 0,
                                    totalRows: event.data.totalRows,
                                    columns: event.data.columns ? event.data.columns.length : 0
                                });
                            }

                            if (event.data.type === 'dataChunk' && event.data.startRow === startRow) {
                                clearTimeout(timeoutId);
                                console.log('=== PROCESSING CHUNK ===');
                                console.log('Processing chunk data for row', startRow, 'with', event.data.data.length, 'rows');

                                // Store the received data
                                event.data.data.forEach((row, index) => {
                                    const rowIndex = startRow + index;
                                    this.loadedData.set(rowIndex, row);
                                    console.log('Stored row', rowIndex, ':', Object.keys(row).length, 'columns');

                                    // Also update allData array if within bounds
                                    if (allData && rowIndex < allData.length) {
                                        allData[rowIndex] = row;
                                    }
                                });

                                console.log('Chunk processed. Cache now has', this.loadedData.size, 'total rows');
                                console.log('New max loaded key:', Math.max(...Array.from(this.loadedData.keys())));
                                window.removeEventListener('message', handler);
                                resolve();
                            } else if (event.data.type === 'error') {
                                clearTimeout(timeoutId);
                                console.error('=== CHUNK ERROR ===');
                                console.error('Error message:', event.data.message);
                                window.removeEventListener('message', handler);
                                reject(new Error(event.data.message));
                            }
                        };

                        // Add listener first
                        window.addEventListener('message', handler);

                        // Then send request
                        console.log('=== SENDING REQUEST ===');
                        console.log('Sending loadData request to extension for rows', startRow, '-', startRow + numRows);
                        
                        try {
                            vscode.postMessage({
                                command: 'loadData',
                                data: {
                                    startRow: startRow,
                                    numRows: Math.min(numRows, this.chunkSize)
                                }
                            });
                            requestSent = true;
                            console.log('Request sent successfully');
                        } catch (error) {
                            console.error('Failed to send request:', error);
                            window.removeEventListener('message', handler);
                            reject(error);
                            return;
                        }

                        // Set timeout
                        timeoutId = setTimeout(() => {
                            console.error('=== TIMEOUT ERROR ===');
                            console.error('TIMEOUT: No response for chunk at row', startRow, 'after 3 seconds');
                            console.error('Request was sent:', requestSent);
                            console.error('Current loaded data size:', this.loadedData.size);
                            window.removeEventListener('message', handler);
                            reject(new Error('Timeout loading chunk at row ' + startRow));
                        }, 3000);
                    });
                }

                generatePlaceholderData(startRow, numRows) {
                    console.log('Generating placeholder data for rows:', startRow, '-', startRow + numRows);
                    // Generate empty rows as placeholder
                    for (let i = 0; i < Math.min(numRows, this.bufferSize); i++) {
                        const rowIndex = startRow + i;
                        if (rowIndex < this.totalRows) {
                            const placeholderRow = {};
                            selectedColumns.forEach(col => {
                                placeholderRow[col] = '';
                            });
                            this.loadedData.set(rowIndex, placeholderRow);
                        }
                    }
                }

                renderVisibleRows() {
                    const { start, end } = this.visibleRange;
                    console.log('=== RENDER DEBUG ===');
                    console.log('renderVisibleRows: rendering rows', start, 'to', end);
                    console.log('Total rows in dataset:', this.totalRows);
                    console.log('LoadedData size:', this.loadedData.size);

                    // Clear tbody
                    this.tbody.innerHTML = '';

                    // Use padding for virtual scrolling
                    const topPadding = start * this.rowHeight;
                    const bottomPadding = Math.max(0, (this.totalRows - end) * this.rowHeight);
                    this.tbody.style.paddingTop = topPadding + 'px';
                    this.tbody.style.paddingBottom = bottomPadding + 'px';
                    
                    console.log('Padding: top=', topPadding, 'bottom=', bottomPadding);
                    
                    // Critical debug for positioning issue
                    if (start > 170) {
                        console.log('🚨 POSITION DEBUG: Row', start, 'should be at', topPadding, 'px from top');
                        console.log('🚨 Row height:', this.rowHeight, '| Expected row 173 position:', 173 * this.rowHeight, 'px');
                    }

                    let renderedCount = 0;
                    let missingCount = 0;
                    const fragment = document.createDocumentFragment();

                    // Build rows in fragment for better performance
                    for (let i = start; i < end && i < this.totalRows; i++) {
                        const rowData = this.loadedData.get(i);
                        
                        // Improved validation: check if row has any non-null values
                        const hasValidData = rowData && Object.keys(rowData).length > 0 && 
                            Object.values(rowData).some(val => val !== null && val !== undefined && val !== '');
                        
                        if (hasValidData) {
                            const tr = this.createTableRow(rowData);
                            fragment.appendChild(tr);
                            renderedCount++;
                        } else {
                            missingCount++;
                            // Log first few missing rows for debugging
                            if (missingCount <= 5 && i > 150) {
                                console.log('Row', i, 'has empty/null data:', rowData);
                                if (rowData) {
                                    console.log('Row', i, 'values:', Object.values(rowData).slice(0, 5));
                                }
                            }
                            
                            // For missing data beyond initial load, create placeholder row
                            if (i > 152) {
                                const placeholderTr = this.createPlaceholderRow(i);
                                fragment.appendChild(placeholderTr);
                                renderedCount++;
                            }
                        }
                    }

                    // Append all rows at once
                    this.tbody.appendChild(fragment);

                    console.log('renderVisibleRows: rendered', renderedCount, 'rows, missing', missingCount, 'rows');
                    
                    // IMMEDIATE DEBUG - check if this is a CSS/positioning issue
                    if (start > 170) {
                        console.log('🔍 DEBUG: Rendering beyond row 170');
                        console.log('🔍 Range:', start, 'to', end, '| Rendered:', renderedCount);
                        console.log('🔍 Top padding:', topPadding + 'px', '| Bottom padding:', bottomPadding + 'px');
                        console.log('🔍 TBody children count:', this.tbody.children.length);
                        console.log('🔍 First few data samples:');
                        for (let i = start; i < Math.min(start + 3, end); i++) {
                            const data = this.loadedData.get(i);
                            console.log('🔍   Row', i, ':', data ? 'EXISTS' : 'MISSING', data ? '(' + Object.keys(data).length + ' cols)' : '');
                        }
                    }
                    
                    // Additional debugging for the visibility issue
                    if (start > 172) {
                        console.log('=== RENDER CONTENT DEBUG (beyond row 172) ===');
                        console.log('Rendered count:', renderedCount, 'Missing count:', missingCount);
                        console.log('Range:', start, 'to', end);
                        
                        // Check the first few rows in the range
                        for (let i = start; i < Math.min(start + 3, end); i++) {
                            const data = this.loadedData.get(i);
                            const hasValidData = data && Object.keys(data).length > 0;
                            console.log('Row', i, '- Valid data:', hasValidData, 'Keys:', data ? Object.keys(data).length : 0);
                            if (data && !hasValidData) {
                                console.log('Row', i, '- Empty data object:', data);
                            }
                        }
                        
                        if (renderedCount === 0) {
                            console.log('ERROR: No rows rendered beyond row 172!');
                        }
                    }
                    
                    if (document.getElementById('visible-rows')) {
                        document.getElementById('visible-rows').textContent = this.loadedData.size.toLocaleString();
                    }
                }

                renderFilteredRows() {
                    const { start, end } = this.visibleRange;
                    const fragment = document.createDocumentFragment();

                    // Clear tbody
                    this.tbody.innerHTML = '';

                    // Use padding instead of transform for proper sticky header
                    this.tbody.style.paddingTop = (start * this.rowHeight) + 'px';
                    this.tbody.style.paddingBottom = Math.max(0, (filteredData.length - end) * this.rowHeight) + 'px';

                    // Build rows in fragment for better performance
                    for (let i = start; i < end && i < filteredData.length; i++) {
                        const rowData = filteredData[i];
                        if (rowData) {
                            const tr = this.createTableRow(rowData);
                            fragment.appendChild(tr);
                        }
                    }

                    // Append all rows at once
                    this.tbody.appendChild(fragment);

                    document.getElementById('visible-rows').textContent = filteredData.length.toLocaleString();
                }

                createTableRow(rowData) {
                    const tr = document.createElement('tr');
                    selectedColumns.forEach(col => {
                        const td = document.createElement('td');
                        let value = rowData[col];

                        if (value === null || value === undefined) {
                            td.textContent = '';
                            td.style.color = 'var(--vscode-disabledForeground)';
                        } else if (typeof value === 'number') {
                            td.textContent = value.toLocaleString();
                        } else {
                            td.textContent = String(value);
                        }

                        tr.appendChild(td);
                    });
                    return tr;
                }

                createPlaceholderRow(rowIndex) {
                    const tr = document.createElement('tr');
                    tr.style.backgroundColor = 'var(--vscode-list-inactiveSelectionBackground)';
                    selectedColumns.forEach((col, colIndex) => {
                        const td = document.createElement('td');
                        if (colIndex === 0) {
                            td.textContent = 'Loading row ' + rowIndex + '...';
                            td.style.fontStyle = 'italic';
                            td.style.color = 'var(--vscode-descriptionForeground)';
                        } else {
                            td.textContent = '...';
                            td.style.color = 'var(--vscode-disabledForeground)';
                        }
                        tr.appendChild(td);
                    });
                    return tr;
                }

                setTotalRows(total) {
                    this.totalRows = total;
                    const totalHeight = total * this.rowHeight;
                    this.spacer.style.height = totalHeight + 'px';
                    console.log('setTotalRows:', total, 'rows, spacer height:', totalHeight, 'px');
                    document.getElementById('total-data-rows').textContent = total.toLocaleString();
                }

                updateHeaders() {
                    this.header.innerHTML = '';
                    selectedColumns.forEach(col => {
                        const th = document.createElement('th');
                        const variable = metadata.variables.find(v => v.name === col);
                        if (variable) {
                            th.innerHTML = getVariableDisplayText(variable);
                        } else {
                            th.textContent = col;
                        }
                        th.title = variable ? getVariableTooltipText(variable) : col;
                        this.header.appendChild(th);
                    });
                }

                applyFilter(whereClause) {
                    this.whereClause = whereClause;
                    if (whereClause) {
                        // Only filter loaded data for now
                        const loadedRows = [];
                        this.loadedData.forEach((row, index) => {
                            if (evaluateWhereClause(whereClause, row)) {
                                loadedRows.push(row);
                            }
                        });
                        filteredData = loadedRows;
                        this.setTotalRows(filteredData.length);
                        document.getElementById('filtered-count').textContent = filteredData.length.toLocaleString() + ' filtered (from loaded data)';
                    } else {
                        filteredData = [];
                        this.setTotalRows(totalDataRows || metadata.total_rows);
                        document.getElementById('filtered-count').textContent = 'All rows';
                    }
                    this.handleScroll();
                }

                clearCache() {
                    this.loadedData.clear();
                    this.tbody.innerHTML = '';
                }
            }

            // Initialize virtual scroller
            const virtualScroller = new VirtualScroller();

            // Helper functions
            function escapeHtml(text) {
                if (!text) return '';
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function getVariableIcon(variable) {
                if (variable.format) {
                    const format = variable.format.toUpperCase();
                    if (format.includes('DATE')) return '📅';
                    if (format.includes('TIME')) return '🕐';
                    if (format.includes('DOLLAR') || format.includes('CURRENCY')) return '💰';
                    if (format.includes('PERCENT')) return '%';
                }

                const nameUpper = variable.name.toUpperCase();
                if (nameUpper.includes('DATE') || nameUpper.includes('DT')) return '📅';
                if (nameUpper.includes('TIME') || nameUpper.includes('TM')) return '🕐';

                if (variable.type === 'character') return '📝';
                if (variable.type === 'numeric') return '#';

                return '?';
            }

            function getVariableDisplayText(variable) {
                const icon = getVariableIcon(variable);
                if (displayMode === 'name') {
                    return icon + ' ' + variable.name;
                } else if (displayMode === 'label' && variable.label) {
                    return icon + ' ' + variable.label;
                } else if (displayMode === 'both' && variable.label && variable.label !== variable.name) {
                    return icon + ' ' + variable.name + ' (' + variable.label + ')';
                } else {
                    return icon + ' ' + variable.name;
                }
            }

            function getVariableTooltipText(variable) {
                let tooltip = variable.name + ' (' + variable.type + ')';
                if (variable.label) tooltip += ' - ' + variable.label;
                if (variable.format) tooltip += ' [Format: ' + variable.format + ']';
                return tooltip;
            }

            function evaluateWhereClause(expression, row) {
                if (!expression || !expression.trim()) return true;

                try {
                    // Replace SAS operators
                    expression = expression.replace(/\\bAND\\b/gi, ' && ');
                    expression = expression.replace(/\\bOR\\b/gi, ' || ');
                    expression = expression.replace(/\\bEQ\\b/gi, ' == ');
                    expression = expression.replace(/\\bNE\\b/gi, ' != ');
                    expression = expression.replace(/\\bGT\\b/gi, ' > ');
                    expression = expression.replace(/\\bLT\\b/gi, ' < ');
                    expression = expression.replace(/\\bGE\\b/gi, ' >= ');
                    expression = expression.replace(/\\bLE\\b/gi, ' <= ');

                    let evalExpression = expression;
                    const sortedColumns = [...columns].sort((a, b) => b.length - a.length);

                    sortedColumns.forEach(col => {
                        const value = row[col];
                        const regex = new RegExp('\\\\b' + col + '\\\\b', 'gi');
                        if (typeof value === 'string') {
                            const escapedValue = value.replace(/'/g, "\\\\'");
                            evalExpression = evalExpression.replace(regex, "'" + escapedValue + "'");
                        } else if (value === null || value === undefined) {
                            evalExpression = evalExpression.replace(regex, 'null');
                        } else {
                            evalExpression = evalExpression.replace(regex, String(value));
                        }
                    });

                    evalExpression = evalExpression.replace(/([^!<>=])=([^=])/g, '$1==$2');

                    // Handle IN operator
                    evalExpression = evalExpression.replace(/('(?:[^'\\\\]|\\\\.)*')\\s+in\\s+\\((.*?)\\)/gi, (match, value, list) => {
                        return '[' + list + '].includes(' + value + ')';
                    });

                    return eval(evalExpression);
                } catch (error) {
                    console.error('Filter evaluation error:', error);
                    return false;
                }
            }

            function updateSelectedCount() {
                const checkedCount = document.querySelectorAll('.column-toggle:checked').length;
                document.getElementById('selected-count').textContent = checkedCount + ' selected';
            }

            function showMetadata() {
                const metadataHTML = '<div style="overflow: auto; max-height: 70vh;"><table style="width: 100%; border-collapse: collapse;">' +
                    '<tr><th>Variable</th><th>Type</th><th>Label</th><th>Format</th><th>Length</th></tr>' +
                    metadata.variables.map(v =>
                        '<tr>' +
                        '<td>' + getVariableIcon(v) + ' ' + v.name + '</td>' +
                        '<td>' + v.type + '</td>' +
                        '<td>' + (v.label || '') + '</td>' +
                        '<td>' + (v.format || '') + '</td>' +
                        '<td>' + (v.length || '') + '</td>' +
                        '</tr>'
                    ).join('') +
                    '</table></div>';

                const overlay = document.createElement('div');
                overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;';

                const modal = document.createElement('div');
                modal.style.cssText = 'background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 20px; border-radius: 4px; max-width: 80%; max-height: 80%;';

                modal.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">' +
                    '<h3 style="margin: 0;">Variable Metadata</h3>' +
                    '<button onclick="document.body.removeChild(document.body.lastElementChild)" style="padding: 4px 12px;">Close</button>' +
                    '</div>' + metadataHTML;

                overlay.appendChild(modal);
                document.body.appendChild(overlay);

                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        document.body.removeChild(overlay);
                    }
                });
            }

            // Setup event listeners
            function setupEventListeners() {
                // Variable selection - make entire row clickable
                document.querySelectorAll('.variable-item').forEach((item, index) => {
                    const checkbox = item.querySelector('.column-toggle');

                    // Handle checkbox change
                    checkbox.addEventListener('change', function(e) {
                        const idx = parseInt(this.dataset.columnIndex);
                        const columnName = columns[idx];

                        if (this.checked && !selectedColumns.includes(columnName)) {
                            selectedColumns.push(columnName);
                        } else if (!this.checked) {
                            selectedColumns = selectedColumns.filter(col => col !== columnName);
                        }

                        virtualScroller.updateHeaders();
                        virtualScroller.handleScroll();
                        updateSelectedCount();
                    });

                    // Make entire row clickable
                    item.addEventListener('click', function(e) {
                        // Don't double-toggle if clicking directly on checkbox
                        if (e.target.type !== 'checkbox') {
                            checkbox.checked = !checkbox.checked;
                            checkbox.dispatchEvent(new Event('change'));
                        }
                    });
                });

                // Select/Deselect all
                document.getElementById('select-all-btn').addEventListener('click', () => {
                    document.querySelectorAll('.column-toggle').forEach(cb => cb.checked = true);
                    selectedColumns = [...columns];
                    virtualScroller.updateHeaders();
                    virtualScroller.handleScroll();
                    updateSelectedCount();
                });

                document.getElementById('deselect-all-btn').addEventListener('click', () => {
                    document.querySelectorAll('.column-toggle').forEach(cb => cb.checked = false);
                    selectedColumns = [];
                    virtualScroller.updateHeaders();
                    virtualScroller.handleScroll();
                    updateSelectedCount();
                });

                // Filter controls
                document.getElementById('apply-filter-btn').addEventListener('click', () => {
                    const whereClause = document.getElementById('where-clause').value;
                    virtualScroller.applyFilter(whereClause);
                });

                document.getElementById('clear-filter-btn').addEventListener('click', () => {
                    document.getElementById('where-clause').value = '';
                    virtualScroller.applyFilter('');
                });

                document.getElementById('where-clause').addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        virtualScroller.applyFilter(e.target.value);
                    }
                });

                // Display mode
                document.getElementById('display-mode').addEventListener('change', (e) => {
                    displayMode = e.target.value;

                    // Update variable list display
                    document.querySelectorAll('.variable-text').forEach((span, index) => {
                        const variable = metadata.variables[index];
                        if (variable) {
                            const icon = getVariableIcon(variable);
                            if (displayMode === 'name') {
                                span.innerHTML = icon + ' ' + variable.name;
                            } else if (displayMode === 'label' && variable.label) {
                                span.innerHTML = icon + ' ' + variable.label;
                            } else if (displayMode === 'both' && variable.label && variable.label !== variable.name) {
                                span.innerHTML = icon + ' ' + variable.name + ' (' + variable.label + ')';
                            } else {
                                span.innerHTML = icon + ' ' + variable.name;
                            }
                        }
                    });

                    // Update table headers
                    virtualScroller.updateHeaders();
                });

                // Metadata button
                document.getElementById('metadata-btn').addEventListener('click', showMetadata);
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                console.log('Webview received message:', message.type, message);

                switch (message.type) {
                    case 'initialData':
                        console.log('Processing initial data with', message.data ? message.data.length : 0, 'rows of', message.totalRows, 'total');
                        // Store initial data
                        columns = message.columns;
                        metadata = message.metadata;
                        selectedColumns = [...columns];
                        totalDataRows = message.totalRows || metadata.total_rows;

                        // Set the correct total rows for virtual scrolling
                        virtualScroller.setTotalRows(totalDataRows);

                        // CRITICAL FIX: Pre-allocate full array with correct size
                        allData = new Array(totalDataRows);

                        // Fill in the initial data with validation
                        let validRowCount = 0;
                        let invalidRowCount = 0;
                        message.data.forEach((row, index) => {
                            allData[index] = row;
                            
                            // Check if row has valid content
                            const hasValidContent = row && Object.keys(row).length > 0 && 
                                Object.values(row).some(val => val !== null && val !== undefined && val !== '');
                            
                            if (hasValidContent) {
                                virtualScroller.loadedData.set(index, row);
                                validRowCount++;
                            } else {
                                invalidRowCount++;
                                if (index > 150 && invalidRowCount <= 10) {
                                    console.log('Invalid row data at index', index, ':', row);
                                }
                            }
                        });
                        
                        console.log('Data validation: valid rows =', validRowCount, 'invalid rows =', invalidRowCount);
                        console.log('Initialized allData array with size:', allData.length);
                        console.log('Cached', message.data.length, 'rows from initial load');
                        console.log('LoadedData.size after initial load:', virtualScroller.loadedData.size);
                        console.log('Highest key in loadedData:', Math.max(...Array.from(virtualScroller.loadedData.keys())));

                        // Setup UI
                        virtualScroller.updateHeaders();
                        setupEventListeners();

                        // Force initial render with debug
                        console.log('Initial data loaded, forcing render...');
                        console.log('LoadedData size:', virtualScroller.loadedData.size);
                        console.log('Total rows:', virtualScroller.totalRows);
                        console.log('Scroller element:', virtualScroller.scroller);
                        console.log('Scroller height:', virtualScroller.scroller.clientHeight);

                        // Ensure viewport is calculated
                        if (!virtualScroller.viewportHeight || virtualScroller.viewportHeight === 0) {
                            virtualScroller.viewportHeight = virtualScroller.scroller.clientHeight || 600;
                            console.log('Forced viewport height:', virtualScroller.viewportHeight);
                        }

                        // Force immediate render
                        virtualScroller.handleScroll();

                        // Also trigger after a short delay to ensure visibility
                        setTimeout(() => {
                            console.log('Secondary render trigger');
                            console.log('Tbody children count:', virtualScroller.tbody.children.length);
                            // Force recalculate if needed
                            if (virtualScroller.tbody.children.length === 0) {
                                console.warn('No rows rendered! Forcing render with default viewport');
                                virtualScroller.viewportHeight = 600;
                                virtualScroller.handleScroll();
                            }
                        }, 200);
                        break;

                    case 'dataChunk':
                        // Handled in loadChunk promise
                        break;

                    case 'error':
                        console.error('Error:', message.message);
                        break;
                }
            });

            console.log('Virtual scroller with full features initialized');

            // Signal that webview is ready to receive data
            vscode.postMessage({
                command: 'webviewReady'
            });
        </script>
    </body>
    </html>`;
}

// Helper functions that need to be included
function escapeHtml(text: string): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/\//g, '&#x2F;');
}

function getVariableIcon(variable: any): string {
    if (variable.format) {
        const format = variable.format.toUpperCase();
        if (format.includes('DATE')) return '📅';
        if (format.includes('TIME')) return '🕐';
        if (format.includes('DOLLAR') || format.includes('CURRENCY')) return '💰';
        if (format.includes('PERCENT')) return '%';
    }

    const nameUpper = variable.name.toUpperCase();
    if (nameUpper.includes('DATE') || nameUpper.includes('DT')) return '📅';
    if (nameUpper.includes('TIME') || nameUpper.includes('TM')) return '🕐';

    if (variable.type === 'character') return '📝';
    if (variable.type === 'numeric') return '#';

    return '?';
}

function getVariableTooltipText(variable: any): string {
    let tooltip = `${variable.name} (${variable.type})`;
    if (variable.label) {
        const cleanLabel = variable.label.replace(/[\n\r]/g, ' ').replace(/['"]/g, '');
        tooltip += ` - ${cleanLabel}`;
    }
    if (variable.format) tooltip += ` [Format: ${variable.format}]`;
    return tooltip;
}