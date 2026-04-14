(function() {
    const vscode = acquireVsCodeApi();

    let currentData = null;
    let metadata = null;
    let filterState = {
        selectedVariables: [],
        whereClause: '',
        variableOrder: []
    };

    let currentStartRow = 0;
    let isLoading = false;
    let hasMoreData = true;
    let filteredVariables = [];

    // DOM Elements
    let elements = {};

    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Webview: DOM loaded, initializing...');
        initializeElements();
        setupEventListeners();
        console.log('Webview: Initialization complete');
    });

    function initializeElements() {
        elements = {
            fileTitle: document.getElementById('file-title'),
            datasetStats: document.getElementById('dataset-stats'),
            whereClause: document.getElementById('where-clause'),
            applyFilter: document.getElementById('apply-filter'),
            variableSearch: document.getElementById('variable-search'),
            selectAll: document.getElementById('select-all'),
            deselectAll: document.getElementById('deselect-all'),
            variableList: document.getElementById('variable-list'),
            metadataContent: document.getElementById('metadata-content'),
            rowInfo: document.getElementById('row-info'),
            loadingIndicator: document.getElementById('loading-indicator'),
            dataTable: document.getElementById('data-table'),
            dataTableContainer: document.getElementById('data-table-container')
        };
    }

    function setupEventListeners() {
        // WHERE clause filtering
        elements.applyFilter.addEventListener('click', applyWhereClause);
        elements.whereClause.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                applyWhereClause();
            }
        });

        // Variable search
        elements.variableSearch.addEventListener('input', searchVariables);

        // Variable selection buttons
        elements.selectAll.addEventListener('click', selectAllVariables);
        elements.deselectAll.addEventListener('click', deselectAllVariables);

        // Virtual scrolling
        elements.dataTableContainer.addEventListener('scroll', handleScroll);

        // Listen for messages from the extension
        window.addEventListener('message', handleMessage);
    }

    function handleMessage(event) {
        const message = event.data;
        console.log('Webview: Received message:', message);

        switch (message.command) {
            case 'metadata':
                console.log('Webview: Handling metadata');
                handleMetadata(message.data);
                break;
            case 'data':
                console.log('Webview: Handling data');
                handleData(message.data);
                break;
            case 'error':
                console.log('Webview: Handling error');
                handleError(message.data);
                break;
            case 'variableSearchResult':
                // Handle any server-side search results if needed
                break;
            default:
                console.log('Webview: Unknown message command:', message.command);
        }
    }

    function handleMetadata(data) {
        console.log('Webview: handleMetadata called with:', data);
        metadata = data.metadata;
        filterState = data.filterState;
        filteredVariables = [...metadata.variables];

        console.log('Webview: About to update UI components');
        updateFileInfo();
        updateVariableList();
        updateMetadataDisplay();
        console.log('Webview: Metadata handling complete');
    }

    function handleData(data) {
        currentData = data;
        isLoading = false;
        hasMoreData = data.returned_rows === 100; // Assuming 100 is the page size

        updateDataTable(data);
        updateRowInfo();
        hideLoading();
    }

    function handleError(data) {
        isLoading = false;
        hideLoading();
        console.error('Error:', data.message);
        // Show error to user
        elements.rowInfo.textContent = `Error: ${data.message}`;
    }

    function updateFileInfo() {
        if (!metadata) {
            console.log('Webview: updateFileInfo called but no metadata available');
            return;
        }

        console.log('Webview: Updating file info');
        const fileName = metadata.file_path.split(/[\\/]/).pop();
        elements.fileTitle.textContent = fileName;
        elements.datasetStats.textContent =
            `${metadata.total_rows.toLocaleString()} observations, ${metadata.total_variables} variables`;
    }

    function updateVariableList() {
        if (!metadata) return;

        elements.variableList.innerHTML = '';

        filteredVariables.forEach((variable, index) => {
            const item = document.createElement('div');
            item.className = 'variable-item';
            item.draggable = true;
            item.dataset.variableName = variable.name;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = filterState.selectedVariables.includes(variable.name);
            checkbox.addEventListener('change', (e) => {
                toggleVariable(variable.name, e.target.checked);
            });

            const nameSpan = document.createElement('span');
            nameSpan.className = 'variable-name';
            nameSpan.textContent = variable.name;

            const typeSpan = document.createElement('span');
            typeSpan.className = 'variable-type';
            typeSpan.textContent = variable.type.charAt(0).toUpperCase();

            item.appendChild(checkbox);
            item.appendChild(nameSpan);
            item.appendChild(typeSpan);

            // Drag and drop events
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragover', handleDragOver);
            item.addEventListener('drop', handleDrop);
            item.addEventListener('dragend', handleDragEnd);

            elements.variableList.appendChild(item);
        });
    }

    function updateMetadataDisplay() {
        if (!metadata) return;

        const totalVars = metadata.total_variables;
        const selectedVars = filterState.selectedVariables.length;
        const numericVars = metadata.variables.filter(v => v.type === 'numeric').length;
        const charVars = metadata.variables.filter(v => v.type === 'character').length;

        elements.metadataContent.innerHTML = `
            <div><strong>Total variables:</strong> ${totalVars}</div>
            <div><strong>Selected variables:</strong> ${selectedVars}</div>
            <div><strong>Numeric:</strong> ${numericVars}</div>
            <div><strong>Character:</strong> ${charVars}</div>
        `;
    }

    function updateDataTable(data) {
        const thead = elements.dataTable.querySelector('thead');
        const tbody = elements.dataTable.querySelector('tbody');

        // Update headers if this is the first load or columns changed
        if (currentStartRow === 0) {
            thead.innerHTML = '';
            const headerRow = document.createElement('tr');

            data.columns.forEach(column => {
                const th = document.createElement('th');
                th.textContent = column;
                headerRow.appendChild(th);
            });

            thead.appendChild(headerRow);
            tbody.innerHTML = ''; // Clear existing data for new filter/selection
        }

        // Add data rows
        data.data.forEach(row => {
            const tr = document.createElement('tr');

            data.columns.forEach(column => {
                const td = document.createElement('td');
                const value = row[column];

                if (value === null || value === undefined) {
                    td.textContent = '';
                    td.className = 'null-value';
                } else if (typeof value === 'number') {
                    td.textContent = value.toLocaleString();
                    td.className = 'numeric';
                } else {
                    td.textContent = value;
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        currentStartRow += data.returned_rows;
    }

    function updateRowInfo() {
        if (!currentData) return;

        const filteredRows = currentData.filtered_rows;
        const totalRows = currentData.total_rows;
        const displayedRows = elements.dataTable.querySelector('tbody').children.length;

        let infoText = `Showing ${displayedRows.toLocaleString()} of ${filteredRows.toLocaleString()} rows`;
        if (filteredRows !== totalRows) {
            infoText += ` (filtered from ${totalRows.toLocaleString()})`;
        }

        elements.rowInfo.textContent = infoText;
    }

    function searchVariables() {
        const searchTerm = elements.variableSearch.value.toLowerCase();

        if (searchTerm === '') {
            filteredVariables = [...metadata.variables];
        } else {
            filteredVariables = metadata.variables.filter(variable =>
                variable.name.toLowerCase().includes(searchTerm) ||
                variable.label.toLowerCase().includes(searchTerm)
            );
        }

        updateVariableList();
    }

    function selectAllVariables() {
        filterState.selectedVariables = filteredVariables.map(v => v.name);
        updateVariableList();
        updateMetadataDisplay();
        loadData(0);
    }

    function deselectAllVariables() {
        filterState.selectedVariables = [];
        updateVariableList();
        updateMetadataDisplay();
        loadData(0);
    }

    function toggleVariable(variableName, selected) {
        vscode.postMessage({
            command: 'toggleVariable',
            data: { variable: variableName, selected: selected }
        });

        // Update local state
        if (selected) {
            if (!filterState.selectedVariables.includes(variableName)) {
                filterState.selectedVariables.push(variableName);
            }
        } else {
            filterState.selectedVariables = filterState.selectedVariables.filter(v => v !== variableName);
        }

        updateMetadataDisplay();
    }

    function applyWhereClause() {
        const whereClause = elements.whereClause.value.trim();
        filterState.whereClause = whereClause;

        vscode.postMessage({
            command: 'applyWhereClause',
            data: { whereClause: whereClause }
        });

        currentStartRow = 0;
        hasMoreData = true;
    }

    function loadData(startRow) {
        if (isLoading) return;

        isLoading = true;
        showLoading();
        currentStartRow = startRow;

        vscode.postMessage({
            command: 'loadData',
            data: {
                startRow: startRow,
                numRows: 100
            }
        });
    }

    function handleScroll() {
        const container = elements.dataTableContainer;
        const threshold = 200; // pixels from bottom

        if (!isLoading && hasMoreData &&
            container.scrollTop + container.clientHeight >= container.scrollHeight - threshold) {
            loadData(currentStartRow);
        }
    }

    // Drag and drop functionality for variable reordering
    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    }

    function handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        if (draggedItem !== this) {
            const draggedVariable = draggedItem.dataset.variableName;
            const targetVariable = this.dataset.variableName;

            reorderVariables(draggedVariable, targetVariable);
        }

        return false;
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        draggedItem = null;
    }

    function reorderVariables(draggedVariable, targetVariable) {
        const newOrder = [...filterState.variableOrder];
        const draggedIndex = newOrder.indexOf(draggedVariable);
        const targetIndex = newOrder.indexOf(targetVariable);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            newOrder.splice(draggedIndex, 1);
            newOrder.splice(targetIndex, 0, draggedVariable);

            filterState.variableOrder = newOrder;

            vscode.postMessage({
                command: 'reorderVariables',
                data: { newOrder: newOrder }
            });

            updateVariableList();
        }
    }

    function showLoading() {
        elements.loadingIndicator.classList.remove('hidden');
    }

    function hideLoading() {
        elements.loadingIndicator.classList.add('hidden');
    }
})();