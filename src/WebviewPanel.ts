import * as vscode from 'vscode';
import { SASDatasetDocument } from './SasDataProvider';
import { WebviewMessage, FilterState, SASDataRequest, IDatasetDocument } from './types';
import { getPaginationHTML } from './PaginationWebview';
import { Logger } from './utils/logger';

/**
 * Manages the webview panel for displaying SAS dataset data
 * Handles communication between VS Code and the webview UI
 */
export class SASWebviewPanel {
    private readonly logger = Logger.createScoped('SASWebviewPanel');
    private filterState: FilterState;
    private disposed: boolean = false;
    private currentWhereClause: string = '';
    private webviewReady: boolean = false;
    private pendingInitialData: any = null;

    constructor(
        private readonly panel: vscode.WebviewPanel,
        private readonly document: IDatasetDocument,
        private readonly context: vscode.ExtensionContext
    ) {
        this.filterState = {
            selectedVariables: [],
            whereClause: '',
            variableOrder: []
        };

        this.logger.debug('WebviewPanel created');
        this.panel.onDidDispose(() => this.dispose(), null, this.context.subscriptions);
        this.panel.webview.onDidReceiveMessage(this.onDidReceiveMessage, this, this.context.subscriptions);
    }

    /**
     * Initializes the webview panel and loads the initial UI
     */
    public async initialize(): Promise<void> {
        try {
            this.logger.debug('Initializing webview panel');

            this.panel.webview.options = {
                enableScripts: true,
                localResourceRoots: []
            };

            await this.loadDataDirectly();
            this.logger.info('Webview panel initialized successfully');

        } catch (error) {
            this.logger.error('Error during initialization', error);
            throw error;
        }
    }

    /**
     * Sets up the webview with pagination HTML and initial state
     */
    private async loadDataDirectly(): Promise<void> {
        try {
            if (!this.document.metadata) {
                this.logger.error('No metadata available');
                return;
            }

            this.logger.debug('Setting up pagination view', {
                totalRows: this.document.metadata.total_rows,
                totalVariables: this.document.metadata.total_variables
            });

            // Set HTML for pagination view
            this.panel.webview.html = getPaginationHTML(this.document.metadata);

            // Store selected variables for later use
            this.filterState.selectedVariables = this.document.metadata.variables.map(v => v.name);

            // Let the pagination component handle data loading

        } catch (error) {
            this.logger.error('Error during setup', error);
            throw error;
        }
    }


    private async sendMetadata(): Promise<void> {
        if (!this.document.metadata) return;

        // Initialize filter state with all variables selected
        this.filterState.selectedVariables = this.document.metadata.variables.map(v => v.name);
        this.filterState.variableOrder = [...this.filterState.selectedVariables];

        await this.postMessage({
            command: 'metadata',
            data: {
                metadata: this.document.metadata,
                filterState: this.filterState
            }
        });
    }

    private async loadInitialData(): Promise<void> {
        const request: SASDataRequest = {
            filePath: this.document.uri.fsPath,
            startRow: 0,
            numRows: 100,
            selectedVars: this.filterState.selectedVariables,
            whereClause: this.filterState.whereClause
        };

        try {
            const data = await this.document.getData(request);
            await this.postMessage({
                command: 'data',
                data: data
            });
        } catch (error) {
            await this.postMessage({
                command: 'error',
                data: { message: `Failed to load data: ${error}` }
            });
        }
    }

    private async onDidReceiveMessage(message: WebviewMessage): Promise<void> {
        switch (message.command) {
            case 'loadData':
                await this.handleLoadData(message.data);
                break;

            case 'updateFilter':
                await this.handleUpdateFilter(message.data);
                break;

            case 'toggleVariable':
                await this.handleToggleVariable(message.data);
                break;

            case 'reorderVariables':
                await this.handleReorderVariables(message.data);
                break;

            case 'searchVariables':
                await this.handleSearchVariables(message.data);
                break;

            case 'applyWhereClause':
                await this.handleApplyWhereClause(message.data);
                break;

            case 'applyFilter':
                await this.handleApplyFilterPagination(message.data);
                break;

            case 'webviewReady':
                this.webviewReady = true;
                if (this.pendingInitialData) {
                    await this.panel.webview.postMessage(this.pendingInitialData);
                    this.pendingInitialData = null;
                }
                break;

            case 'getUniqueValues':
                await this.handleGetUniqueValues(message.data);
                break;

            default:
                // Unknown command
                break;
        }
    }

    /**
     * Handles data loading requests from the webview
     */
    private async handleLoadData(data: any): Promise<void> {
        const request: SASDataRequest = {
            filePath: this.document.uri.fsPath,
            startRow: data.startRow || 0,
            numRows: data.numRows || 100,
            selectedVars: data.selectedVars && data.selectedVars.length > 0 ?
                         data.selectedVars :
                         this.document.metadata?.variables.map(v => v.name) || [],
            whereClause: data.whereClause || this.filterState.whereClause || ''
        };

        this.logger.debug('Handling load data request', {
            startRow: request.startRow,
            numRows: request.numRows,
            varsCount: request.selectedVars?.length
        });

        try {
            const result = await this.document.getData(request);

            // Send chunk back to webview for virtual scrolling
            const response = {
                type: 'dataChunk',
                startRow: data.startRow,
                data: result.data,
                totalRows: result.total_rows,
                columns: result.columns
            };

            await this.panel.webview.postMessage(response);
        } catch (error) {
            this.logger.error('Error loading data', error);

            await this.panel.webview.postMessage({
                type: 'error',
                message: `Failed to load data: ${error}`
            });
        }
    }

    private async handleUpdateFilter(data: any): Promise<void> {
        this.filterState = { ...this.filterState, ...data };
        await this.loadInitialData();
    }

    private async handleToggleVariable(data: { variable: string, selected: boolean }): Promise<void> {
        if (data.selected) {
            if (!this.filterState.selectedVariables.includes(data.variable)) {
                this.filterState.selectedVariables.push(data.variable);
                // Add to the end of variable order if not already there
                if (!this.filterState.variableOrder.includes(data.variable)) {
                    this.filterState.variableOrder.push(data.variable);
                }
            }
        } else {
            this.filterState.selectedVariables = this.filterState.selectedVariables.filter(v => v !== data.variable);
        }

        await this.loadInitialData();
    }

    private async handleReorderVariables(data: { newOrder: string[] }): Promise<void> {
        this.filterState.variableOrder = data.newOrder;
        // Update selected variables to maintain the new order
        this.filterState.selectedVariables = data.newOrder.filter(v =>
            this.filterState.selectedVariables.includes(v)
        );

        await this.loadInitialData();
    }

    private async handleSearchVariables(data: { searchTerm: string }): Promise<void> {
        // This is handled on the frontend, but we could do server-side filtering here if needed
        await this.postMessage({
            command: 'variableSearchResult',
            data: { searchTerm: data.searchTerm }
        });
    }

    private async handleApplyWhereClause(data: { whereClause: string }): Promise<void> {
        this.filterState.whereClause = data.whereClause;
        await this.loadInitialData();
    }

    /**
     * Handles filter application for pagination mode
     */
    private async handleApplyFilterPagination(data: any): Promise<void> {
        const whereClause = data.whereClause || '';
        this.filterState.whereClause = whereClause;

        this.logger.debug('Applying filter', { whereClause: whereClause.substring(0, 100) });

        try {
            let filteredRowCount: number;
            
            if (whereClause.trim() === '') {
                // Clearing filter - return to full dataset
                this.logger.debug('Clearing filter - returning to full dataset');
                filteredRowCount = this.document.metadata?.total_rows || 0;
            } else {
                // Validate column names referenced in WHERE clause
                if (this.document.metadata) {
                    const knownVars = this.document.metadata.variables.map(v => v.name.toUpperCase());
                    // Extract variable names from WHERE clause (word before operator)
                    const referencedVars = whereClause.match(/\b(\w+)\s*(?:>=|<=|!=|<>|=|>|<|\bEQ\b|\bNE\b|\bGT\b|\bLT\b|\bGE\b|\bLE\b|\bIN\b)/gi) || [];
                    const varNames = referencedVars.map((m: string) => m.replace(/\s*(?:>=|<=|!=|<>|=|>|<|EQ|NE|GT|LT|GE|LE|IN)\s*$/i, '').trim().toUpperCase());
                    const invalidVars = varNames.filter((v: string) => v && !knownVars.includes(v));
                    if (invalidVars.length > 0) {
                        await this.panel.webview.postMessage({
                            type: 'error',
                            message: `WHERE clause references unknown variable(s): ${[...new Set(invalidVars)].join(', ')}. Check spelling and try again.`
                        });
                        return;
                    }
                }

                // Use the optimized getFilteredRowCount method
                // This is much faster as it doesn't load any actual data
                filteredRowCount = await this.document.getFilteredRowCount(whereClause);
                this.logger.info(`Filter applied: ${filteredRowCount} rows match the filter`);
            }

            // Send filter result back to webview
            await this.panel.webview.postMessage({
                type: 'filterResult',
                filteredRows: filteredRowCount,
                whereClause: whereClause
            });

        } catch (error) {
            this.logger.error('Filter error', error);
            await this.panel.webview.postMessage({
                type: 'error',
                message: `Failed to apply filter: ${error}`
            });
        }
    }

    /**
     * Legacy filter handler (deprecated - client-side filtering)
     */
    private async handleApplyFilter(data: any): Promise<void> {
        // Client-side filtering now, no need for this
        this.logger.debug('Legacy filter method called - client-side filtering used instead');
    }

    /**
     * Handle get unique values request
     */
    private async handleGetUniqueValues(data: { variables: string[] }): Promise<void> {
        const { variables } = data;

        this.logger.debug('Getting unique values for variables:', variables);

        // Validate that requested variables exist in metadata
        if (this.document.metadata) {
            const knownVars = this.document.metadata.variables.map(v => v.name.toUpperCase());
            const invalidVars = variables.filter(v => !knownVars.includes(v.toUpperCase()));
            if (invalidVars.length > 0) {
                await this.panel.webview.postMessage({
                    type: 'error',
                    message: `Variable(s) not found: ${invalidVars.join(', ')}. Check spelling and try again.`
                });
                return;
            }
        }

        try {
            let result: any;
            let formattedValues: any[] = [];

            if (variables.length === 1) {
                // Single variable - get unique values
                result = await this.document.getUniqueValues(variables[0], true);
                // Format for frontend - result is already in the correct format
                formattedValues = result;
            } else {
                // Multiple variables - get unique combinations
                result = await this.document.getUniqueCombinations(variables, true);
                // Format for frontend - convert from column-based objects to expected format
                formattedValues = result.map((row: any) => {
                    const combination: any = {};
                    variables.forEach(v => {
                        combination[v] = row[v];
                    });
                    return {
                        combination: combination,
                        count: row._count || row.count || 0
                    };
                });
            }

            // Format response for webview
            const response = {
                variables: variables,
                values: formattedValues,
                totalUnique: formattedValues.length
            };

            await this.panel.webview.postMessage({
                type: 'uniqueValuesResult',
                data: response
            });

        } catch (error) {
            this.logger.error('Error getting unique values', error);
            await this.panel.webview.postMessage({
                type: 'error',
                message: `Failed to get unique values: ${error}`
            });
        }
    }

    private async postMessage(message: WebviewMessage): Promise<void> {
        await this.panel.webview.postMessage(message);
    }

    private getDataStats(data: any, metadata: any): string {
        const filtered = data.filtered_rows !== data.total_rows;
        if (filtered) {
            return `${data.filtered_rows} of ${data.total_rows} observations (filtered), ${metadata.total_variables} variables`;
        } else {
            return `${data.total_rows} observations, ${metadata.total_variables} variables`;
        }
    }

    private getVariableIcon(variable: any): string {
        // Only check for date/time formats on NUMERIC variables
        if (variable.type === 'numeric' && variable.format) {
            const format = variable.format.toUpperCase();
            if (format.includes('DATETIME')) return '🕐';
            if (format.includes('DATE')) return '📅';
            if (format.includes('TIME')) return '🕐';
            if (format.includes('DOLLAR') || format.includes('CURRENCY')) return '💰';
            if (format.includes('PERCENT')) return '%';
        }

        // For numeric variables without special formats, check name patterns
        if (variable.type === 'numeric') {
            const nameUpper = variable.name.toUpperCase();
            if (nameUpper.includes('DATETIME') || nameUpper.includes('DTTM')) return '🕐';
            if (nameUpper.includes('DATE') || nameUpper.includes('DT')) return '📅';
            if (nameUpper.includes('TIME') || nameUpper.includes('TM')) return '🕐';
            return '#'; // Default numeric icon
        }

        // Character variables are always shown as text, regardless of name
        if (variable.type === 'character') return '📝';

        return '?';
    }

    private getVariableTooltipText(variable: any): string {
        let tooltip = `${variable.name} (${variable.type})`;
        if (variable.label) {
            // Clean up label - remove problematic characters
            const cleanLabel = variable.label.replace(/[\n\r]/g, ' ').replace(/['"]/g, '');
            tooltip += ` - ${cleanLabel}`;
        }
        if (variable.format) tooltip += ` [Format: ${variable.format}]`;
        return tooltip;
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\//g, '&#x2F;');
    }

    // Removed unused methods - data loading handled by pagination component
    /**
     * Dispose of the webview panel and clean up resources
     */
    public dispose(): void {
        this.logger.debug('Disposing webview panel');
        this.disposed = true;
    }
}