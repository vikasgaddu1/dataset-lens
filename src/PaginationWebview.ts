// Helper function for variable icons in HTML generation
function getVariableIconString(variable: any): string {
    if (variable.type === 'character') {
        return '📝';
    } else if (variable.type === 'numeric') {
        if (variable.format === 'DATE' || variable.format === 'DATETIME') {
            return '📅';
        } else if (variable.format === 'TIME') {
            return '🕐';
        } else if (variable.format === 'DOLLAR') {
            return '💰';
        } else if (variable.format === 'PERCENT') {
            return '📊';
        } else {
            return '🔢';
        }
    } else {
        return '❓';
    }
}

export function getPaginationHTML(metadata: any): string {
    const fileName = metadata.file_path.split(/[\\/]/).pop();

    // Debug: Log metadata to see what we have
    console.log('[PaginationWebview] Metadata received:', {
        dataset_label: metadata.dataset_label,
        fileName: fileName,
        hasLabel: !!metadata.dataset_label,
        labelNotFileName: metadata.dataset_label !== fileName
    });

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
                height: 100vh;
                display: flex;
                flex-direction: column;
            }

            .main-container {
                display: flex;
                gap: 15px;
                flex: 1;
                min-height: 0;
            }

            .sidebar {
                width: 320px;
                min-width: 280px;
                flex-shrink: 0;
                background: var(--vscode-sideBar-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }

            .sidebar-header {
                padding: 15px;
                background: var(--vscode-sideBarSectionHeader-background);
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .sidebar-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 12px;
            }

            .dataset-label {
                font-size: 13px;
                color: var(--vscode-descriptionForeground);
                margin-bottom: 10px;
                font-style: italic;
            }

            .variable-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .selected-count {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }

            .display-mode {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 11px;
            }

            .display-select {
                padding: 2px 6px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 2px;
                font-size: 11px;
            }

            .variables-container {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }

            .variable-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                border-radius: 3px;
                font-size: 12px;
                cursor: pointer;
                user-select: none;
                margin-bottom: 2px;
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
                cursor: help;
            }

            /* Custom tooltip styles for sidebar variables */
            .variable-text[data-tooltip]:hover::after {
                content: attr(data-tooltip);
                position: fixed;
                background: var(--vscode-editorHoverWidget-background);
                color: var(--vscode-editorHoverWidget-foreground);
                border: 1px solid var(--vscode-editorHoverWidget-border);
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: pre-line;
                z-index: 10000;
                min-width: 200px;
                max-width: 400px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                pointer-events: none;
                transform: translateY(5px);
            }

            .variable-text[data-tooltip] {
                position: relative;
            }

            .variable-item {
                position: relative;
            }

            /* JavaScript will set these dynamically */
            .variable-text[data-tooltip]:hover::after {
                left: var(--tooltip-x, 350px);
                top: var(--tooltip-y, 50%);
            }

            /* Type badge removed - using icons instead */

            .content-area {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-width: 0;
            }


            .table-container {
                flex: 1;
                overflow: auto;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                margin-bottom: 15px;
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
                z-index: 10;
                background: var(--vscode-editor-background);
            }

            th {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 8px;
                text-align: left;
                font-weight: 600;
                white-space: nowrap;
                cursor: help;
                position: relative;
            }

            /* Table header tooltips */
            th[data-tooltip]:hover::after {
                content: attr(data-tooltip);
                position: absolute;
                background: var(--vscode-editorHoverWidget-background);
                color: var(--vscode-editorHoverWidget-foreground);
                border: 1px solid var(--vscode-editorHoverWidget-border);
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: pre-line;
                z-index: 1000;
                min-width: 200px;
                max-width: 400px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                pointer-events: none;
                top: 100%;
                left: 0;
                margin-top: 5px;
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

            .filter-section {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
                border: 1px solid var(--vscode-panel-border);
                margin-bottom: 15px;
            }

            .where-input {
                padding: 6px 12px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 3px;
                font-size: 13px;
            }

            .where-input:focus {
                outline: 1px solid var(--vscode-focusBorder);
            }

            .filter-info {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                font-style: italic;
            }

            .pagination-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                background: var(--vscode-sideBar-background);
                border-radius: 6px;
                border: 1px solid var(--vscode-panel-border);
            }

            .page-info {
                display: flex;
                align-items: center;
                gap: 15px;
                font-size: 13px;
            }

            .page-size-control {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .btn {
                padding: 6px 12px;
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
                min-width: 80px;
            }

            .btn:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .btn:disabled {
                background: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                cursor: not-allowed;
                opacity: 0.6;
            }

            .btn-nav {
                min-width: 100px;
            }

            .page-input {
                width: 60px;
                padding: 4px 8px;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 2px;
                text-align: center;
            }

            .page-size-select {
                padding: 4px 8px;
                background: var(--vscode-dropdown-background);
                color: var(--vscode-dropdown-foreground);
                border: 1px solid var(--vscode-dropdown-border);
                border-radius: 2px;
            }

            .loading {
                text-align: center;
                padding: 40px;
                font-style: italic;
                color: var(--vscode-descriptionForeground);
            }

            .error {
                text-align: center;
                padding: 40px;
                color: var(--vscode-errorForeground);
                background: var(--vscode-errorBackground);
                border-radius: 4px;
                margin: 20px;
            }

            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 18px;
                border-radius: 6px;
                font-size: 13px;
                z-index: 2000;
                max-width: 420px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.25s, transform 0.25s;
                pointer-events: none;
            }
            .toast.show {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .toast-error {
                color: var(--vscode-errorForeground, #f44);
                background: var(--vscode-notifications-background, #1e1e1e);
                border: 1px solid var(--vscode-errorForeground, #f44);
            }
            .toast-warning {
                color: var(--vscode-editorWarning-foreground, #cca700);
                background: var(--vscode-notifications-background, #1e1e1e);
                border: 1px solid var(--vscode-editorWarning-foreground, #cca700);
            }
            .toast-info {
                color: var(--vscode-editorInfo-foreground, #3794ff);
                background: var(--vscode-notifications-background, #1e1e1e);
                border: 1px solid var(--vscode-editorInfo-foreground, #3794ff);
            }

            /* Metadata Modal Styles */
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
            }

            .modal-content {
                background-color: var(--vscode-editor-background);
                margin: 5% auto;
                padding: 0;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 6px;
                width: 80%;
                max-width: 800px;
                max-height: 80vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .modal-header {
                padding: 15px 20px;
                background: var(--vscode-sideBarSectionHeader-background);
                border-bottom: 1px solid var(--vscode-panel-border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .modal-title {
                font-size: 16px;
                font-weight: 600;
            }

            .modal-close {
                font-size: 24px;
                font-weight: bold;
                cursor: pointer;
                background: none;
                border: none;
                color: var(--vscode-foreground);
                opacity: 0.6;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .modal-close:hover {
                opacity: 1;
            }

            .modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }

            .metadata-section {
                margin-bottom: 20px;
            }

            .metadata-section h3 {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 10px;
                color: var(--vscode-foreground);
            }

            .metadata-table {
                width: 100%;
                font-size: 12px;
            }

            .metadata-table tr {
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .metadata-table td {
                padding: 8px 12px;
            }

            .metadata-table td:first-child {
                font-weight: 500;
                color: var(--vscode-descriptionForeground);
                width: 150px;
            }
        </style>
    </head>
    <body>

        <div class="main-container">
            <div class="sidebar">
                <div class="sidebar-header">
                    <div class="sidebar-title">Dataset Variables</div>
                    <div class="variable-controls">
                        <div class="selected-count" id="selected-count">33 selected</div>
                    </div>

                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border);">
                        <div style="margin-bottom: 8px;">
                            <label style="font-size: 11px; display: block; margin-bottom: 4px;">KEEP variables:</label>
                            <div style="display: flex; gap: 4px;">
                                <input type="text" id="keep-input" class="variable-input"
                                       placeholder="e.g., VAR1 VAR2 VAR3"
                                       title="Space-separated list of variables to keep"
                                       style="flex: 1; padding: 3px 6px; font-size: 11px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px;">
                                <button class="btn" id="keep-btn" style="padding: 3px 8px; font-size: 11px; min-width: 50px;">Keep</button>
                            </div>
                        </div>

                        <div>
                            <label style="font-size: 11px; display: block; margin-bottom: 4px;">DROP variables:</label>
                            <div style="display: flex; gap: 4px;">
                                <input type="text" id="drop-input" class="variable-input"
                                       placeholder="e.g., VAR1 VAR2 VAR3"
                                       title="Space-separated list of variables to drop"
                                       style="flex: 1; padding: 3px 6px; font-size: 11px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px;">
                                <button class="btn" id="drop-btn" style="padding: 3px 8px; font-size: 11px; min-width: 50px;">Drop</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Select/Clear All buttons above checkboxes -->
                <div style="display: flex; gap: 8px; margin: 12px 0 8px 0;">
                    <button class="btn" id="select-all-btn" style="flex: 1; font-size: 11px; padding: 4px 8px;">Select All</button>
                    <button class="btn" id="deselect-all-btn" style="flex: 1; font-size: 11px; padding: 4px 8px;">Clear All</button>
                </div>

                <div class="variables-container" id="variables-container">
                    <!-- Variables will be populated by JavaScript -->
                </div>
            </div>

            <div class="content-area">
                <div class="filter-section" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; align-items: center;">
                    <!-- Left section: WHERE filter -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label for="where-input" style="white-space: nowrap;">WHERE:</label>
                        <input type="text" id="where-input" class="where-input"
                               placeholder="e.g., AGE > 30"
                               title="Filter the dataset using SAS-style WHERE conditions"
                               style="flex: 1;">
                        <button class="btn" id="apply-filter-btn" style="padding: 6px 12px;">Apply</button>
                        <button class="btn" id="clear-filter-btn" style="padding: 6px 12px;">Clear</button>
                    </div>

                    <!-- Middle section: Unique values -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label for="unique-input" style="white-space: nowrap;">Unique:</label>
                        <input type="text" id="unique-input"
                               placeholder="VAR1 VAR2"
                               title="Space-separated variables for unique values"
                               style="flex: 1; padding: 6px 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; font-size: 13px;">
                        <button class="btn" id="unique-btn" style="padding: 6px 12px;">Show</button>
                    </div>

                    <!-- Right section: Dataset Metadata, Variables button and display mode -->
                    <div style="display: flex; align-items: center; gap: 12px; justify-content: flex-end;">
                        <button class="btn" id="dataset-metadata-btn" style="padding: 6px 12px;" title="View dataset metadata">📄 Dataset Metadata</button>
                        <button class="btn" id="metadata-btn" style="padding: 6px 12px;" title="View variable metadata">📊 Variables</button>
                        <div class="display-mode" style="display: flex; align-items: center; gap: 6px;">
                            <label style="font-size: 12px; white-space: nowrap;">Show:</label>
                            <select id="display-mode" class="display-select" style="padding: 4px 8px; font-size: 12px;">
                                <option value="name" selected>Names</option>
                                <option value="label">Labels</option>
                                <option value="both">Both</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="filter-info" id="filter-info" style="font-size: 12px; color: var(--vscode-descriptionForeground); padding: 0 15px; margin-bottom: 8px;">
                    <span id="current-range">Loading...</span> | No filter applied - showing all rows
                </div>

                <div class="table-container">
                    <div id="loading-message" class="loading">Loading data...</div>
                    <div id="error-message" class="error" style="display: none;"></div>
                    <div id="toast" class="toast" aria-live="polite"></div>
                    <table id="data-table" style="display: none;">
                        <thead id="table-header">
                            <tr></tr>
                        </thead>
                        <tbody id="table-body"></tbody>
                    </table>
                </div>

                <div class="pagination-controls">
                    <div class="page-info">
                        <button class="btn btn-nav" id="first-btn" disabled>⏮️ First</button>
                        <button class="btn btn-nav" id="prev-btn" disabled>⬅️ Previous</button>
                        <span>Page <input type="number" id="page-input" class="page-input" value="1" min="1"> of <span id="total-pages">1</span></span>
                        <button class="btn btn-nav" id="next-btn">Next ➡️</button>
                        <button class="btn btn-nav" id="last-btn">Last ⏭️</button>
                    </div>
                    
                    <div class="page-size-control">
                        <label>Rows per page:</label>
                        <select id="page-size-select" class="page-size-select">
                            <option value="50">50</option>
                            <option value="100" selected>100</option>
                            <option value="200">200</option>
                            <option value="500">500</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dataset Metadata Modal -->
        <div id="dataset-metadata-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Dataset Metadata</div>
                    <button class="modal-close" id="close-dataset-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="metadata-section">
                        <h3>Dataset Information</h3>
                        <table class="metadata-table">
                            <tr>
                                <td>Filename:</td>
                                <td>${fileName}</td>
                            </tr>
                            ${metadata.dataset_label && metadata.dataset_label !== fileName ? `
                            <tr>
                                <td>Dataset Label:</td>
                                <td>${metadata.dataset_label}</td>
                            </tr>` : ''}
                            <tr>
                                <td>Total Rows:</td>
                                <td id="dataset-total-rows">${metadata.total_rows.toLocaleString()}</td>
                            </tr>
                            <tr>
                                <td>Total Variables:</td>
                                <td>${metadata.total_variables}</td>
                            </tr>
                            <tr>
                                <td>File Path:</td>
                                <td style="word-break: break-all; font-family: monospace; font-size: 11px;">${metadata.file_path}</td>
                            </tr>
                            ${metadata.created_date ? `
                            <tr>
                                <td>Created Date:</td>
                                <td>${metadata.created_date}</td>
                            </tr>` : ''}
                            ${metadata.modified_date ? `
                            <tr>
                                <td>Modified Date:</td>
                                <td>${metadata.modified_date}</td>
                            </tr>` : ''}
                            ${metadata.sas_version ? `
                            <tr>
                                <td>SAS Version:</td>
                                <td>${metadata.sas_version}</td>
                            </tr>` : ''}
                            ${metadata.os_version ? `
                            <tr>
                                <td>OS Version:</td>
                                <td>${metadata.os_version}</td>
                            </tr>` : ''}
                            ${metadata.encoding ? `
                            <tr>
                                <td>Encoding:</td>
                                <td>${metadata.encoding}</td>
                            </tr>` : ''}
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Variable Metadata Modal -->
        <div id="metadata-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Variable Metadata</div>
                    <button class="modal-close" id="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="metadata-section">
                        <h3>Variables Details (${metadata.total_variables} total)</h3>
                        <div style="overflow-x: auto;">
                            <table class="metadata-table" style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: var(--vscode-editor-lineHighlightBackground);">
                                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Name</th>
                                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Label</th>
                                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Type</th>
                                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Format</th>
                                        <th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Length</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${metadata.variables.map((v: any) => `
                                    <tr>
                                        <td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">
                                            ${v.type === 'character' ? '📝' : '🔢'} ${v.name}
                                        </td>
                                        <td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">${v.label || '-'}</td>
                                        <td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">${v.type}</td>
                                        <td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">${v.format || '-'}</td>
                                        <td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">${v.length || '-'}</td>
                                    </tr>`).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Unique Values Modal -->
        <div id="unique-values-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Unique Values</div>
                    <button class="modal-close" id="close-unique-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="metadata-section">
                        <h3 id="unique-modal-title">Unique Values</h3>
                        <div id="unique-modal-summary" style="margin-bottom: 10px; color: var(--vscode-descriptionForeground); font-size: 12px;"></div>
                        <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
                            <table class="metadata-table" id="unique-values-table" style="width: 100%; border-collapse: collapse;">
                                <!-- Table will be populated by JavaScript -->
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <script>
            // Helper function to get variable icons
            function getVariableIcon(variable) {
                if (variable.type === 'character') {
                    return '📝';
                } else if (variable.type === 'numeric') {
                    if (variable.format === 'DATE' || variable.format === 'DATETIME') {
                        return '📅';
                    } else if (variable.format === 'TIME') {
                        return '🕐';
                    } else if (variable.format === 'DOLLAR') {
                        return '💰';
                    } else if (variable.format === 'PERCENT') {
                        return '📊';
                    } else {
                        return '🔢';
                    }
                } else {
                    return '❓';
                }
            }
            // Debug metadata
            console.log('Metadata in webview:', {
                dataset_label: '${metadata.dataset_label}',
                fileName: '${fileName}',
                labelCondition: ${metadata.dataset_label && metadata.dataset_label.trim() && metadata.dataset_label !== fileName}
            });

            // Acquire VS Code API
            const vscode = acquireVsCodeApi();

            // Pagination state
            let currentPage = 1;
            let pageSize = 100;
            let totalRows = ${metadata.total_rows};
            let filteredRows = totalRows; // Total rows after filtering
            let totalPages = Math.ceil(filteredRows / pageSize);
            let currentData = [];
            let columns = [];
            let selectedColumns = [];
            let allVariables = ${JSON.stringify(metadata.variables)};
            let displayMode = 'name';
            let isLoading = false;
            let currentWhereClause = '';

            // DOM elements
            const table = document.getElementById('data-table');
            const tbody = document.getElementById('table-body');
            const header = document.getElementById('table-header').querySelector('tr');
            const loadingMessage = document.getElementById('loading-message');
            const errorMessage = document.getElementById('error-message');
            
            const firstBtn = document.getElementById('first-btn');
            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            const lastBtn = document.getElementById('last-btn');
            const pageInput = document.getElementById('page-input');
            const totalPagesSpan = document.getElementById('total-pages');
            const pageSizeSelect = document.getElementById('page-size-select');
            const currentRangeSpan = document.getElementById('current-range');
            const totalRowsDisplay = document.getElementById('total-rows-display');
            
            // Filter elements
            const whereInput = document.getElementById('where-input');
            const applyFilterBtn = document.getElementById('apply-filter-btn');
            const clearFilterBtn = document.getElementById('clear-filter-btn');
            const filterInfo = document.getElementById('filter-info');
            
            // Variable selection elements
            const selectedCountSpan = document.getElementById('selected-count');
            const displayModeSelect = document.getElementById('display-mode');
            const selectAllBtn = document.getElementById('select-all-btn');
            const deselectAllBtn = document.getElementById('deselect-all-btn');
            const variablesContainer = document.getElementById('variables-container');

            // Unique values elements
            const uniqueInput = document.getElementById('unique-input');
            const uniqueBtn = document.getElementById('unique-btn');
            const uniqueValuesModal = document.getElementById('unique-values-modal');
            const closeUniqueModal = document.getElementById('close-unique-modal');

            // Initialize
            function init() {
                console.log('Pagination viewer initialized');
                
                // Debug: Check if elements exist
                console.log('Elements found:');
                console.log('- selectAllBtn:', !!selectAllBtn);
                console.log('- deselectAllBtn:', !!deselectAllBtn);
                console.log('- variablesContainer:', !!variablesContainer);
                
                // Populate variables list dynamically
                populateVariablesList();
                
                // Initialize selected columns with all variables
                selectedColumns = allVariables.map(v => v.name);
                updateSelectedCount();
                updatePaginationInfo();
                setupEventListeners();
                
                // Set initial display mode explicitly
                displayMode = 'name';
                displayModeSelect.value = 'name';
                console.log('Initial display mode set to:', displayMode);
                
                loadPage(1);
            }

            function populateVariablesList() {
                console.log('Populating variables list with', allVariables.length, 'variables');
                
                if (!variablesContainer) {
                    console.error('Variables container not found');
                    return;
                }
                
                variablesContainer.innerHTML = '';
                
                allVariables.forEach((variable, index) => {
                    const item = document.createElement('div');
                    item.className = 'variable-item';
                    item.setAttribute('data-variable', variable.name);
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'variable-checkbox';
                    checkbox.setAttribute('data-variable', variable.name);
                    checkbox.checked = true;
                    
                    const span = document.createElement('span');
                    span.className = 'variable-text';
                    span.setAttribute('data-name', variable.name);
                    span.setAttribute('data-label', variable.label || '');
                    
                    // Create tooltip content
                    let tooltip = 'Variable: ' + variable.name;
                    if (variable.label && variable.label !== variable.name) {
                        tooltip += '\\nLabel: ' + variable.label;
                    }
                    tooltip += '\\nType: ' + variable.type;
                    if (variable.format) {
                        tooltip += '\\nFormat: ' + variable.format;
                    }
                    if (variable.length) {
                        tooltip += '\\nLength: ' + variable.length;
                    }
                    
                    span.setAttribute('data-tooltip', tooltip);
                    span.innerHTML = getVariableIcon(variable) + ' ' + variable.name;
                    
                    item.appendChild(checkbox);
                    item.appendChild(span);
                    
                    variablesContainer.appendChild(item);
                });
                
                console.log('Variables list populated. Checking first tooltip:', 
                    document.querySelector('.variable-text')?.getAttribute('data-tooltip')?.substring(0, 50));
            }

            function setupEventListeners() {
                // Dataset metadata modal elements
                const datasetMetadataBtn = document.getElementById('dataset-metadata-btn');
                const datasetMetadataModal = document.getElementById('dataset-metadata-modal');
                const closeDatasetModalBtn = document.getElementById('close-dataset-modal');

                // Variable metadata modal elements
                const metadataBtn = document.getElementById('metadata-btn');
                const metadataModal = document.getElementById('metadata-modal');
                const closeModalBtn = document.getElementById('close-modal');

                // Dataset metadata modal event listeners
                if (datasetMetadataBtn) {
                    datasetMetadataBtn.addEventListener('click', () => {
                        datasetMetadataModal.style.display = 'block';
                    });
                }

                if (closeDatasetModalBtn) {
                    closeDatasetModalBtn.addEventListener('click', () => {
                        datasetMetadataModal.style.display = 'none';
                    });
                }

                // Variable metadata modal event listeners
                if (metadataBtn) {
                    metadataBtn.addEventListener('click', () => {
                        metadataModal.style.display = 'block';
                    });
                }

                if (closeModalBtn) {
                    closeModalBtn.addEventListener('click', () => {
                        metadataModal.style.display = 'none';
                    });
                }

                // Close modals when clicking outside
                window.addEventListener('click', (e) => {
                    if (e.target === metadataModal) {
                        metadataModal.style.display = 'none';
                    }
                    if (e.target === datasetMetadataModal) {
                        datasetMetadataModal.style.display = 'none';
                    }
                });

                firstBtn.addEventListener('click', () => goToPage(1));
                prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
                nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
                lastBtn.addEventListener('click', () => goToPage(totalPages));
                
                pageInput.addEventListener('change', () => {
                    const page = parseInt(pageInput.value);
                    if (page >= 1 && page <= totalPages) {
                        goToPage(page);
                    } else {
                        pageInput.value = currentPage;
                    }
                });
                
                pageInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const page = parseInt(pageInput.value);
                        if (page >= 1 && page <= totalPages) {
                            goToPage(page);
                        } else {
                            pageInput.value = currentPage;
                        }
                    }
                });
                
                pageSizeSelect.addEventListener('change', () => {
                    pageSize = parseInt(pageSizeSelect.value);
                    totalPages = Math.ceil(filteredRows / pageSize);
                    currentPage = 1;
                    updatePaginationInfo();
                    loadPage(1);
                });
                
                // Filter event listeners
                applyFilterBtn.addEventListener('click', applyFilter);
                clearFilterBtn.addEventListener('click', clearFilter);
                whereInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        applyFilter();
                    }
                });
                
                // Variable selection event listeners with debugging
                selectAllBtn.addEventListener('click', () => {
                    console.log('Select All button clicked');
                    selectAllVariables();
                });
                deselectAllBtn.addEventListener('click', () => {
                    console.log('Clear All button clicked');
                    deselectAllVariables();
                });

                // KEEP and DROP functionality
                const keepInput = document.getElementById('keep-input');
                const keepBtn = document.getElementById('keep-btn');
                const dropInput = document.getElementById('drop-input');
                const dropBtn = document.getElementById('drop-btn');

                if (keepBtn && keepInput) {
                    keepBtn.addEventListener('click', () => {
                        const varsToKeep = keepInput.value.trim().toUpperCase().split(/\\s+/).filter(v => v);
                        if (varsToKeep.length > 0) {
                            console.log('Keeping variables:', varsToKeep);
                            applyKeepVariables(varsToKeep);
                        }
                    });
                    keepInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            keepBtn.click();
                        }
                    });
                }

                if (dropBtn && dropInput) {
                    dropBtn.addEventListener('click', () => {
                        const varsToDrop = dropInput.value.trim().toUpperCase().split(/\\s+/).filter(v => v);
                        if (varsToDrop.length > 0) {
                            console.log('Dropping variables:', varsToDrop);
                            applyDropVariables(varsToDrop);
                        }
                    });
                    dropInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            dropBtn.click();
                        }
                    });
                }

                // Unique values handlers
                if (uniqueBtn && uniqueInput) {
                    uniqueBtn.addEventListener('click', () => {
                        const varsForUnique = uniqueInput.value.trim().toUpperCase().split(/\\s+/).filter(v => v);
                        if (varsForUnique.length > 0) {
                            console.log('Getting unique values for:', varsForUnique);
                            getUniqueValues(varsForUnique);
                        }
                    });
                    uniqueInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            uniqueBtn.click();
                        }
                    });
                }

                // Unique values modal handlers
                if (closeUniqueModal) {
                    closeUniqueModal.addEventListener('click', () => {
                        if (uniqueValuesModal) {
                            uniqueValuesModal.style.display = 'none';
                        }
                    });
                }

                displayModeSelect.addEventListener('change', () => {
                    console.log('Display mode changed to:', displayModeSelect.value);
                    updateDisplayMode();
                });
                
                // Variable checkbox listeners - use event delegation
                variablesContainer.addEventListener('change', (e) => {
                    if (e.target.classList.contains('variable-checkbox')) {
                        console.log('Variable checkbox changed:', e.target.dataset.variable, e.target.checked);
                        handleVariableSelection();
                    }
                });
                
                // Make variable items clickable
                variablesContainer.addEventListener('click', (e) => {
                    const item = e.target.closest('.variable-item');
                    if (item && e.target.type !== 'checkbox') {
                        const checkbox = item.querySelector('.variable-checkbox');
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked;
                            console.log('Variable item clicked:', checkbox.dataset.variable, checkbox.checked);
                            handleVariableSelection();
                        }
                    }
                });

                // Add tooltip positioning for sidebar variables
                variablesContainer.addEventListener('mousemove', (e) => {
                    const variableText = e.target.closest('.variable-text');
                    if (variableText && variableText.hasAttribute('data-tooltip')) {
                        const rect = variableText.getBoundingClientRect();
                        // Position tooltip to the right of the sidebar
                        variableText.style.setProperty('--tooltip-x', (rect.right + 10) + 'px');
                        variableText.style.setProperty('--tooltip-y', rect.top + 'px');
                    }
                });
            }

            function goToPage(page) {
                if (page >= 1 && page <= totalPages && page !== currentPage && !isLoading) {
                    loadPage(page);
                }
            }

            function loadPage(page) {
                if (isLoading) return;
                
                console.log('Loading page', page, 'with', pageSize, 'rows per page');
                isLoading = true;
                currentPage = page;
                
                showLoading();
                updatePaginationInfo();
                
                const startRow = (page - 1) * pageSize;
                
                // Request data from extension with current filter and selected variables
                console.log('Requesting data with selectedVars:', selectedColumns);
                vscode.postMessage({
                    command: 'loadData',
                    data: {
                        startRow: startRow,
                        numRows: pageSize,
                        whereClause: currentWhereClause,
                        selectedVars: selectedColumns
                    }
                });
            }

            function showLoading() {
                table.style.display = 'none';
                errorMessage.style.display = 'none';
                loadingMessage.style.display = 'block';
                loadingMessage.textContent = 'Loading page ' + currentPage + '...';
            }

            function showError(message) {
                table.style.display = 'none';
                loadingMessage.style.display = 'none';
                errorMessage.style.display = 'block';
                errorMessage.textContent = 'Error: ' + message;
                isLoading = false;
            }

            let toastTimer = null;
            function showToast(message, type) {
                type = type || 'error';
                const toast = document.getElementById('toast');
                if (!toast) return;
                toast.className = 'toast toast-' + type;
                toast.textContent = message;
                // Trigger show
                requestAnimationFrame(() => { toast.classList.add('show'); });
                if (toastTimer) clearTimeout(toastTimer);
                toastTimer = setTimeout(() => {
                    toast.classList.remove('show');
                }, 5000);
            }

            function showData() {
                loadingMessage.style.display = 'none';
                errorMessage.style.display = 'none';
                table.style.display = 'table';
                isLoading = false;
            }

            function showNoColumnsMessage() {
                table.style.display = 'none';
                loadingMessage.style.display = 'none';
                errorMessage.style.display = 'block';
                errorMessage.textContent = 'No variables selected. Please select at least one variable to display data.';
                errorMessage.style.backgroundColor = 'var(--vscode-inputValidation-warningBackground)';
                errorMessage.style.color = 'var(--vscode-inputValidation-warningForeground)';
                isLoading = false;
            }

            function hideNoColumnsMessage() {
                if (errorMessage.textContent.includes('No variables selected')) {
                    errorMessage.style.display = 'none';
                    errorMessage.style.backgroundColor = 'var(--vscode-errorBackground)';
                    errorMessage.style.color = 'var(--vscode-errorForeground)';
                }
            }

            function applyFilter() {
                const whereClause = whereInput.value.trim();
                console.log('Applying filter:', whereClause);
                
                currentWhereClause = whereClause;
                currentPage = 1;
                
                // Update filter info
                if (whereClause) {
                    filterInfo.textContent = 'Filter: ' + whereClause;
                    filterInfo.style.fontWeight = 'bold';
                } else {
                    filterInfo.textContent = 'No filter applied - showing all rows';
                    filterInfo.style.fontWeight = 'normal';
                }
                
                // Request filtered data count first, then load page 1
                vscode.postMessage({
                    command: 'applyFilter',
                    data: {
                        whereClause: whereClause
                    }
                });
            }

            function clearFilter() {
                console.log('Clearing filter...');
                whereInput.value = '';
                currentWhereClause = '';
                filteredRows = totalRows;
                totalPages = Math.ceil(filteredRows / pageSize);
                currentPage = 1;
                
                filterInfo.innerHTML = '<span id="current-range">Loading...</span> | No filter applied - showing all rows';
                filterInfo.style.fontWeight = 'normal';
                const datasetTotalRows = document.getElementById('dataset-total-rows');
                if (datasetTotalRows) {
                    datasetTotalRows.textContent = totalRows.toLocaleString();
                }
                
                // Send clear filter command to backend
                vscode.postMessage({
                    command: 'applyFilter',
                    data: {
                        whereClause: '' // Empty where clause = no filter
                    }
                });
                
                updatePaginationInfo();
            }

            function updatePaginationInfo() {
                const startRow = (currentPage - 1) * pageSize + 1;
                const endRow = Math.min(currentPage * pageSize, filteredRows);
                
                currentRangeSpan.textContent = 'Showing ' + startRow.toLocaleString() + '-' + endRow.toLocaleString() + ' of ' + filteredRows.toLocaleString();
                pageInput.value = currentPage;
                totalPagesSpan.textContent = totalPages.toLocaleString();
                
                // Update button states
                firstBtn.disabled = currentPage === 1;
                prevBtn.disabled = currentPage === 1;
                nextBtn.disabled = currentPage === totalPages;
                lastBtn.disabled = currentPage === totalPages;
                
                pageInput.max = totalPages;
            }

            function renderTable(data, cols) {
                // Update columns - use selected columns if available, otherwise use all
                columns = selectedColumns.length > 0 ? selectedColumns : cols;
                console.log('Rendering table with columns:', columns);
                
                // Update headers using the display mode
                updateTableHeaders();

                // Clear and rebuild body
                tbody.innerHTML = '';
                data.forEach((row, index) => {
                    const tr = document.createElement('tr');
                    
                    columns.forEach(col => {
                        const td = document.createElement('td');
                        let value = row[col];

                        // Format value based on variable metadata
                        const variable = allVariables.find(v => v.name === col);
                        if (value === null || value === undefined) {
                            td.textContent = '';
                            td.style.color = 'var(--vscode-disabledForeground)';
                        } else if (typeof value === 'number') {
                            // Format numbers based on variable metadata
                            if (variable && variable.format) {
                                if (variable.format === 'DOLLAR') {
                                    td.textContent = '$' + value.toLocaleString();
                                } else if (variable.format === 'PERCENT') {
                                    td.textContent = (value * 100).toFixed(2) + '%';
                                } else {
                                    td.textContent = value.toLocaleString();
                                }
                            } else {
                                td.textContent = value.toLocaleString();
                            }
                        } else {
                            td.textContent = String(value);
                        }

                        td.title = td.textContent; // Tooltip for truncated content
                        tr.appendChild(td);
                    });
                    
                    tbody.appendChild(tr);
                });

                console.log('Rendered', data.length, 'rows with', columns.length, 'selected columns');
                showData();
            }

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                console.log('Received message:', message.type);

                switch (message.type) {
                    case 'initialData':
                        console.log('Processing initial data:', message.data.length, 'rows');
                        renderTable(message.data, message.columns);
                        break;

                    case 'dataChunk':
                        console.log('Processing data chunk:', message.data.length, 'rows for page', currentPage);
                        renderTable(message.data, message.columns);
                        break;

                    case 'filterResult':
                        console.log('Filter applied. Filtered rows:', message.filteredRows);
                        filteredRows = message.filteredRows;
                        totalPages = Math.ceil(filteredRows / pageSize);
                        currentPage = 1;
                        
                        // Update display
                        const datasetTotalRows = document.getElementById('dataset-total-rows');
                        if (datasetTotalRows) {
                            datasetTotalRows.textContent = filteredRows.toLocaleString();
                        }
                        if (currentWhereClause) {
                            filterInfo.textContent = 'Filter: ' + currentWhereClause + ' (' + filteredRows.toLocaleString() + ' rows match)';
                        }
                        
                        updatePaginationInfo();
                        loadPage(1);
                        break;

                    case 'error':
                        console.error('Error:', message.message);
                        showToast(message.message, 'error');
                        break;

                    case 'uniqueValuesResult':
                        console.log('Received unique values result');
                        displayUniqueValues(message.data);
                        break;
                }
            });

            // Variable selection functions
            function handleVariableSelection() {
                console.log('Handling variable selection change...');
                updateSelectedColumns();
                updateSelectedCount();
                
                // Reload current page with new column selection
                if (selectedColumns.length > 0) {
                    console.log('Reloading page', currentPage, 'with', selectedColumns.length, 'selected columns');
                    loadPage(currentPage);
                } else {
                    console.log('No columns selected, showing message');
                }
            }

            function selectAllVariables() {
                document.querySelectorAll('.variable-checkbox').forEach(cb => cb.checked = true);
                updateSelectedColumns();
                updateSelectedCount();
                loadPage(currentPage);
            }

            function deselectAllVariables() {
                console.log('Deselecting all variables...');
                const checkboxes = document.querySelectorAll('.variable-checkbox');
                console.log('Found', checkboxes.length, 'checkboxes to deselect');
                
                checkboxes.forEach((cb, index) => {
                    if (cb.dataset && cb.dataset.variable) {
                        console.log('Deselecting checkbox', index, ':', cb.dataset.variable);
                        cb.checked = false;
                    }
                });
                
                updateSelectedColumns();
                updateSelectedCount();
                
                console.log('After deselect all, selected columns:', selectedColumns.length);
            }

            function updateSelectedColumns() {
                selectedColumns = [];
                document.querySelectorAll('.variable-checkbox:checked').forEach(cb => {
                    if (cb.dataset && cb.dataset.variable) {
                        selectedColumns.push(cb.dataset.variable);
                    }
                });
                console.log('Selected columns updated:', selectedColumns.length, selectedColumns);
                
                // If no columns selected, show a message but don't auto-select
                if (selectedColumns.length === 0) {
                    console.log('No columns selected - will show message');
                    showNoColumnsMessage();
                } else {
                    hideNoColumnsMessage();
                }
            }

            function updateSelectedCount() {
                const count = document.querySelectorAll('.variable-checkbox:checked').length;
                selectedCountSpan.textContent = count + ' selected';
            }

            // KEEP functionality - select only specified variables
            function applyKeepVariables(varsToKeep) {
                const checkboxes = document.querySelectorAll('.variable-checkbox');
                checkboxes.forEach(cb => {
                    const varName = cb.dataset.variable?.toUpperCase();
                    if (varName) {
                        cb.checked = varsToKeep.includes(varName);
                    }
                });

                updateSelectedColumns();
                updateSelectedCount();
                loadPage(currentPage);

                // Clear the input after applying
                const keepInput = document.getElementById('keep-input');
                if (keepInput) keepInput.value = '';
            }

            // DROP functionality - deselect specified variables
            function applyDropVariables(varsToDrop) {
                const checkboxes = document.querySelectorAll('.variable-checkbox');
                checkboxes.forEach(cb => {
                    const varName = cb.dataset.variable?.toUpperCase();
                    if (varName && varsToDrop.includes(varName)) {
                        cb.checked = false;
                    }
                });

                updateSelectedColumns();
                updateSelectedCount();
                loadPage(currentPage);

                // Clear the input after applying
                const dropInput = document.getElementById('drop-input');
                if (dropInput) dropInput.value = '';
            }

            // Get unique values for specified variables
            function getUniqueValues(variables) {
                // Validate that all variables exist
                const invalidVars = variables.filter(v => !allVariables.some(av => av.name.toUpperCase() === v));
                if (invalidVars.length > 0) {
                    showToast('Variable(s) not found: ' + invalidVars.join(', ') + '. Check spelling and try again.', 'warning');
                    return;
                }

                // Send request to extension
                vscode.postMessage({
                    command: 'getUniqueValues',
                    data: { variables: variables }
                });
            }

            // Display unique values in modal
            function displayUniqueValues(data) {
                const { variables, values, totalUnique } = data;

                // Update modal title
                const modalTitle = document.getElementById('unique-modal-title');
                const modalSummary = document.getElementById('unique-modal-summary');
                const table = document.getElementById('unique-values-table');

                if (modalTitle) {
                    modalTitle.textContent = variables.length === 1
                        ? 'Unique Values for ' + variables[0]
                        : 'Unique Combinations for ' + variables.join(', ');
                }

                if (modalSummary) {
                    modalSummary.textContent = 'Found ' + totalUnique + ' unique ' + (variables.length === 1 ? 'values' : 'combinations');
                }

                // Build table
                if (table) {
                    // Create header
                    let headerHtml = '<thead><tr style="background: var(--vscode-editor-lineHighlightBackground);">';
                    variables.forEach(v => {
                        headerHtml += '<th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">' + v + '</th>';
                    });
                    headerHtml += '<th style="text-align: left; padding: 8px; border-bottom: 2px solid var(--vscode-panel-border);">Count</th></tr></thead>';

                    // Create body
                    let bodyHtml = '<tbody>';
                    values.forEach(row => {
                        bodyHtml += '<tr>';
                        if (variables.length === 1) {
                            bodyHtml += '<td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">' + (row.value !== null ? row.value : '(null)') + '</td>';
                        } else {
                            variables.forEach(v => {
                                const val = row.combination[v];
                                bodyHtml += '<td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">' + (val !== null ? val : '(null)') + '</td>';
                            });
                        }
                        bodyHtml += '<td style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border);">' + row.count + '</td>';
                        bodyHtml += '</tr>';
                    });
                    bodyHtml += '</tbody>';

                    table.innerHTML = headerHtml + bodyHtml;
                }

                // Show modal
                if (uniqueValuesModal) {
                    uniqueValuesModal.style.display = 'block';
                }
            }

            function updateDisplayMode() {
                displayMode = displayModeSelect.value;
                console.log('updateDisplayMode called - mode:', displayMode);
                console.log('Variable text elements found:', document.querySelectorAll('.variable-text').length);
                
                // Update variable text display
                document.querySelectorAll('.variable-text').forEach((span, index) => {
                    const name = span.dataset.name;
                    const label = span.dataset.label;
                    const variable = allVariables.find(v => v.name === name);
                    
                    if (variable) {
                        const icon = getVariableIcon(variable);
                        let newText;
                        
                        if (displayMode === 'name') {
                            newText = icon + ' ' + name;
                        } else if (displayMode === 'label' && label) {
                            newText = icon + ' ' + label;
                        } else if (displayMode === 'both' && label && label !== name) {
                            newText = icon + ' ' + name + ' (' + label + ')';
                        } else {
                            newText = icon + ' ' + name;
                        }
                        
                        span.innerHTML = newText;
                        
                        // Add comprehensive tooltip
                        let tooltip = 'Variable: ' + name;
                        if (label && label !== name) {
                            tooltip += '\\nLabel: ' + label;
                        }
                        tooltip += '\\nType: ' + variable.type;
                        if (variable.format) {
                            tooltip += '\\nFormat: ' + variable.format;
                        }
                        if (variable.length) {
                            tooltip += '\\nLength: ' + variable.length;
                        }
                        
                        span.setAttribute('data-tooltip', tooltip);
                        span.removeAttribute('title'); // Remove title to prevent default tooltip
                        
                        // Debug tooltip setting
                        if (index < 3) {
                            console.log('Set tooltip for', name, ':', tooltip);
                        }
                        
                        // Debug first few items
                        if (index < 3) {
                            console.log('Updated variable', index, ':', name, '→', newText);
                        }
                    }
                });
                
                // Update table headers
                updateTableHeaders();
            }

            function updateTableHeaders() {
                if (selectedColumns.length === 0) return;
                
                header.innerHTML = '';
                selectedColumns.forEach(colName => {
                    const variable = allVariables.find(v => v.name === colName);
                    const th = document.createElement('th');
                    
                    if (variable) {
                        if (displayMode === 'name') {
                            th.textContent = variable.name;
                        } else if (displayMode === 'label' && variable.label) {
                            th.textContent = variable.label;
                        } else if (displayMode === 'both' && variable.label && variable.label !== variable.name) {
                            th.textContent = variable.name + ' (' + variable.label + ')';
                        } else {
                            th.textContent = variable.name;
                        }
                        // Create comprehensive tooltip for table headers
                        let headerTooltip = 'Variable: ' + variable.name;
                        if (variable.label && variable.label !== variable.name) {
                            headerTooltip += '\\nLabel: ' + variable.label;
                        }
                        headerTooltip += '\\nType: ' + variable.type;
                        if (variable.format) {
                            headerTooltip += '\\nFormat: ' + variable.format;
                        }
                        if (variable.length) {
                            headerTooltip += '\\nLength: ' + variable.length;
                        }
                        th.setAttribute('data-tooltip', headerTooltip);
                        th.removeAttribute('title'); // Remove title to prevent default tooltip
                    } else {
                        th.textContent = colName;
                    }
                    
                    header.appendChild(th);
                });
            }

            // Initialize when DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            } else {
                init();
            }

            console.log('Pagination Dataset Lens initialized');
        </script>
    </body>
    </html>`;
}
