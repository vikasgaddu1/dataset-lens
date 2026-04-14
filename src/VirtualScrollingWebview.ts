export function getVirtualScrollingHTML(metadata: any): string {
    const fileName = metadata.file_path.split(/[\\/]/).pop();

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
                display: flex;
                flex-direction: column;
                height: 100vh;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background: var(--vscode-sideBar-background);
                border-radius: 4px;
                margin-bottom: 10px;
            }

            .stats {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }

            .controls {
                display: flex;
                gap: 10px;
            }

            .btn {
                padding: 4px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
            }

            .btn:hover {
                background: var(--vscode-button-hoverBackground);
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
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 13px;
            }

            th {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 8px;
                text-align: left;
                position: sticky;
                top: 0;
                z-index: 10;
                font-weight: 600;
            }

            td {
                border: 1px solid var(--vscode-panel-border);
                padding: 6px 8px;
            }

            tr:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .loading-indicator {
                text-align: center;
                padding: 20px;
                display: none;
            }

            .loading-indicator.active {
                display: block;
            }

            .filter-section {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .where-input {
                padding: 4px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                width: 300px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="stats">
                <strong>${fileName}</strong> -
                <span id="row-count">Loading...</span> rows,
                ${metadata.total_variables} variables
            </div>
            <div class="controls">
                <div class="filter-section">
                    <input type="text" class="where-input" placeholder="e.g., age > 30 and country = 'USA'" id="where-clause">
                    <button class="btn" id="apply-filter-btn">Apply Filter</button>
                    <button class="btn" id="clear-filter-btn">Clear</button>
                </div>
            </div>
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

        <script>
            // Acquire VS Code API
            const vscode = acquireVsCodeApi();

            // Virtual Scrolling Implementation
            class VirtualScroller {
                constructor() {
                    this.rowHeight = 30; // Estimated row height
                    this.viewportHeight = 600;
                    this.bufferSize = 20;
                    this.chunkSize = 100;
                    this.totalRows = 0;
                    this.loadedData = new Map(); // Cache loaded chunks
                    this.visibleRange = { start: 0, end: 0 };
                    this.isLoading = false;
                    this.columns = [];
                    this.metadata = null;
                    this.filteredData = null; // For client-side filtering

                    this.scroller = document.getElementById('data-scroller');
                    this.spacer = document.getElementById('virtual-spacer');
                    this.content = document.getElementById('virtual-content');
                    this.tbody = document.getElementById('table-body');
                    this.header = document.getElementById('table-header').querySelector('tr');
                    this.loadingIndicator = document.getElementById('loading-indicator');

                    this.setupScrollHandler();
                }

                setupScrollHandler() {
                    let scrollTimeout;
                    this.scroller.addEventListener('scroll', () => {
                        clearTimeout(scrollTimeout);
                        scrollTimeout = setTimeout(() => this.handleScroll(), 50);
                    });

                    // Calculate viewport height
                    this.viewportHeight = this.scroller.clientHeight;
                    new ResizeObserver(() => {
                        this.viewportHeight = this.scroller.clientHeight;
                        this.handleScroll();
                    }).observe(this.scroller);
                }

                handleScroll() {
                    const scrollTop = this.scroller.scrollTop;
                    const startRow = Math.floor(scrollTop / this.rowHeight);
                    const endRow = Math.ceil((scrollTop + this.viewportHeight) / this.rowHeight);

                    this.visibleRange = {
                        start: Math.max(0, startRow - this.bufferSize),
                        end: Math.min(this.totalRows, endRow + this.bufferSize)
                    };

                    this.loadVisibleData();
                }

                async loadVisibleData() {
                    if (this.isLoading) return;

                    const { start, end } = this.visibleRange;
                    const missingRanges = this.findMissingRanges(start, end);

                    if (missingRanges.length === 0) {
                        this.renderVisibleRows();
                        return;
                    }

                    this.isLoading = true;
                    this.loadingIndicator.classList.add('active');

                    for (const range of missingRanges) {
                        await this.loadChunk(range.start, range.end - range.start);
                    }

                    this.loadingIndicator.classList.remove('active');
                    this.isLoading = false;
                    this.renderVisibleRows();
                }

                findMissingRanges(start, end) {
                    const ranges = [];
                    let currentStart = null;

                    for (let i = start; i < end; i++) {
                        if (!this.loadedData.has(i)) {
                            if (currentStart === null) currentStart = i;
                        } else if (currentStart !== null) {
                            ranges.push({ start: currentStart, end: i });
                            currentStart = null;
                        }
                    }

                    if (currentStart !== null) {
                        ranges.push({ start: currentStart, end: end });
                    }

                    return ranges;
                }

                async loadChunk(startRow, numRows) {
                    // Request data from extension
                    vscode.postMessage({
                        command: 'loadData',
                        data: {
                            startRow: startRow,
                            numRows: Math.min(numRows, this.chunkSize)
                        }
                    });

                    // Wait for response
                    return new Promise(resolve => {
                        const handler = (event) => {
                            if (event.data.type === 'dataChunk' &&
                                event.data.startRow === startRow) {
                                event.data.data.forEach((row, index) => {
                                    this.loadedData.set(startRow + index, row);
                                });
                                window.removeEventListener('message', handler);
                                resolve();
                            }
                        };
                        window.addEventListener('message', handler);

                        // Timeout after 5 seconds
                        setTimeout(() => {
                            window.removeEventListener('message', handler);
                            resolve();
                        }, 5000);
                    });
                }

                renderVisibleRows() {
                    const { start, end } = this.visibleRange;
                    this.tbody.innerHTML = '';

                    // Position content at correct offset
                    this.content.style.transform = 'translateY(' + (start * this.rowHeight) + 'px)';

                    for (let i = start; i < end; i++) {
                        const rowData = this.loadedData.get(i);
                        if (rowData) {
                            const tr = this.createTableRow(rowData);
                            this.tbody.appendChild(tr);
                        }
                    }
                }

                createTableRow(rowData) {
                    const tr = document.createElement('tr');
                    this.columns.forEach(col => {
                        const td = document.createElement('td');
                        let value = rowData[col];

                        // Format value
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

                setTotalRows(total) {
                    this.totalRows = total;
                    // Set spacer height to create scrollbar
                    this.spacer.style.height = (total * this.rowHeight) + 'px';
                    document.getElementById('row-count').textContent = total.toLocaleString();
                }

                setColumns(columns) {
                    this.columns = columns;
                    // Update header
                    this.header.innerHTML = '';
                    columns.forEach(col => {
                        const th = document.createElement('th');
                        th.textContent = col;
                        this.header.appendChild(th);
                    });
                }

                setMetadata(metadata) {
                    this.metadata = metadata;
                }

                applyClientFilter(whereClause) {
                    // Implement client-side filtering if needed
                    // This would filter the loaded data
                    console.log('Applying filter:', whereClause);
                }

                clearData() {
                    this.loadedData.clear();
                    this.tbody.innerHTML = '';
                }
            }

            // Initialize virtual scroller
            const virtualScroller = new VirtualScroller();

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;

                switch (message.type) {
                    case 'initialData':
                        // Store initial data
                        virtualScroller.setColumns(message.columns);
                        virtualScroller.setMetadata(message.metadata);
                        virtualScroller.setTotalRows(message.totalRows);

                        // Load initial data into cache
                        message.data.forEach((row, index) => {
                            virtualScroller.loadedData.set(index, row);
                        });

                        // Initial render
                        virtualScroller.handleScroll();
                        break;

                    case 'dataChunk':
                        // Handled in loadChunk promise
                        break;

                    case 'error':
                        console.error('Error:', message.message);
                        alert('Error loading data: ' + message.message);
                        break;
                }
            });

            // Setup filter controls
            document.getElementById('apply-filter-btn').addEventListener('click', () => {
                const whereClause = document.getElementById('where-clause').value;
                virtualScroller.applyClientFilter(whereClause);
            });

            document.getElementById('clear-filter-btn').addEventListener('click', () => {
                document.getElementById('where-clause').value = '';
                virtualScroller.applyClientFilter('');
            });

            document.getElementById('where-clause').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    virtualScroller.applyClientFilter(e.target.value);
                }
            });

            // Log ready state
            console.log('Virtual scroller initialized and ready');
        </script>
    </body>
    </html>`;
}