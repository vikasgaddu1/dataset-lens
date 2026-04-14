import * as vscode from 'vscode';
import * as path from 'path';
import { SASWebviewPanel } from './WebviewPanel';
import { SASMetadata, SASDataResponse, SASDataRequest, IDatasetDocument } from './types';
import { Logger } from './utils/logger';
import { EnhancedSASReader, DatasetMetadata, DataRow } from './readers/EnhancedSASReader';
import { PythonEnvironment } from './utils/pythonEnvironment';

/**
 * VS Code custom editor provider for SAS dataset files (.sas7bdat)
 * Handles the lifecycle of SAS dataset documents and their associated webview editors
 */
export class SASDatasetProvider implements vscode.CustomReadonlyEditorProvider<SASDatasetDocument> {
    private static readonly viewType = 'sasDataExplorer.sas7bdat';
    private readonly logger = Logger.createScoped('SASDatasetProvider');

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger.debug('SASDatasetProvider V2 initialized - TypeScript mode');
    }

    /**
     * Creates a custom document for a SAS dataset file
     */
    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<SASDatasetDocument> {
        this.logger.info(`Opening SAS dataset: ${uri.fsPath}`);
        const document = await SASDatasetDocument.create(uri, this.context);
        return document;
    }

    /**
     * Resolves a custom editor for a SAS dataset document
     */
    public async resolveCustomEditor(
        document: SASDatasetDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.debug(`Resolving custom editor for: ${document.uri.fsPath}`);
        const sasWebviewPanel = new SASWebviewPanel(webviewPanel, document, this.context);
        await sasWebviewPanel.initialize();
    }
}

/**
 * Represents a SAS dataset document with metadata and data access capabilities
 */
export class SASDatasetDocument implements IDatasetDocument {
    private readonly logger = Logger.createScoped('SASDatasetDocument');
    private reader: EnhancedSASReader | null = null;
    private usePythonFallback = false;

    private constructor(
        public readonly uri: vscode.Uri,
        public metadata: SASMetadata | null = null,
        private readonly context: vscode.ExtensionContext
    ) {}

    /**
     * Factory method to create a SAS dataset document
     */
    public static async create(
        uri: vscode.Uri,
        context: vscode.ExtensionContext
    ): Promise<SASDatasetDocument> {
        const document = new SASDatasetDocument(uri, null, context);
        await document.loadMetadata();
        return document;
    }

    /**
     * Loads metadata for the SAS dataset file
     */
    private async loadMetadata(): Promise<void> {
        try {
            this.logger.info(`Loading metadata using TypeScript reader: ${this.uri.fsPath}`);

            // Try TypeScript reader first
            try {
                this.reader = new EnhancedSASReader(this.uri.fsPath);
                const tsMetadata = await this.reader.getMetadata();

                // Convert to existing format for compatibility
                this.metadata = this.convertMetadata(tsMetadata);

                // If TypeScript reader doesn't provide a label, try to get it from Python
                if (!tsMetadata.label || tsMetadata.label === '') {
                    try {
                        const pythonMetadata = await this.executePythonCommand('metadata', this.uri.fsPath);
                        if (pythonMetadata?.dataset_label) {
                            this.metadata.dataset_label = pythonMetadata.dataset_label;
                            this.logger.info('Got dataset label from Python:', pythonMetadata.dataset_label);
                        }
                    } catch (labelError) {
                        this.logger.debug('Could not get dataset label from Python', labelError);
                    }
                }

                this.logger.info('Metadata loaded successfully with TypeScript reader', {
                    totalRows: this.metadata?.total_rows,
                    totalVariables: this.metadata?.total_variables,
                    mode: 'TypeScript',
                    dataset_label: this.metadata?.dataset_label
                });

            } catch (tsError) {
                this.logger.warn('TypeScript reader failed, falling back to Python', tsError);
                this.usePythonFallback = true;

                // Fallback to Python
                this.metadata = await this.executePythonCommand('metadata', this.uri.fsPath);

                this.logger.info('Metadata loaded successfully with Python fallback', {
                    totalRows: this.metadata?.total_rows,
                    totalVariables: this.metadata?.total_variables,
                    mode: 'Python'
                });
            }

        } catch (error) {
            this.logger.error('Failed to load metadata', error);
            throw error;
        }
    }

    /**
     * Converts TypeScript reader metadata to existing format
     */
    private convertMetadata(tsMetadata: DatasetMetadata): SASMetadata {
        return {
            total_rows: tsMetadata.rowCount,
            total_variables: tsMetadata.columnCount,
            variables: tsMetadata.variables.map(v => ({
                name: v.name,
                type: v.type === 'string' ? 'character' : 'numeric',
                label: v.label,
                format: v.format || '',
                length: v.length,
                dtype: v.type
            })),
            file_path: this.uri.fsPath,
            dataset_label: tsMetadata.label || this.metadata?.dataset_label || path.basename(this.uri.fsPath, '.sas7bdat')
        };
    }

    /**
     * Get the count of rows matching a filter without loading data
     * Much faster than loading data just for counting
     */
    public async getFilteredRowCount(whereClause: string): Promise<number> {
        if (!this.usePythonFallback && this.reader) {
            try {
                return await this.reader.getFilteredRowCount(whereClause);
            } catch (error) {
                this.logger.warn('Failed to get filtered row count', error);
            }
        }
        
        // Fallback: load one row to get the count (less efficient but works)
        const result = await this.getData({
            filePath: this.uri.fsPath,
            startRow: 0,
            numRows: 1,
            selectedVars: this.metadata?.variables.map(v => v.name) || [],
            whereClause: whereClause
        });
        
        return result.filtered_rows || 0;
    }

    /**
     * Retrieves data from the SAS dataset based on the request parameters
     */
    public async getData(request: SASDataRequest): Promise<SASDataResponse> {
        this.logger.debug('Getting data', {
            startRow: request.startRow,
            numRows: request.numRows,
            selectedVarsCount: request.selectedVars?.length || 0,
            hasWhereClause: !!request.whereClause,
            mode: this.usePythonFallback ? 'Python' : 'TypeScript'
        });

        if (!this.usePythonFallback && this.reader) {
            // Use TypeScript reader
            try {
                const startTime = Date.now();

                // Get data with TypeScript reader
                let data: DataRow[];
                let filteredRowCount: number;

                if (request.whereClause) {
                    // Get filtered row count efficiently
                    filteredRowCount = await this.reader.getFilteredRowCount(request.whereClause);
                    
                    // Log the request parameters for debugging
                    this.logger.debug(`getData request params: startRow=${request.startRow}, numRows=${request.numRows}`);
                    
                    // Now get the actual data page
                    data = await this.reader.getData({
                        startRow: request.startRow,
                        numRows: request.numRows,
                        variables: request.selectedVars,
                        whereClause: request.whereClause
                    });
                    
                    this.logger.info(`Filter applied, ${filteredRowCount} rows match, returned ${data.length} rows for current page (requested: ${request.numRows})`);
                } else {
                    data = await this.reader.getData({
                        startRow: request.startRow,
                        numRows: request.numRows,
                        variables: request.selectedVars
                    });
                    filteredRowCount = this.metadata?.total_rows || 0;
                }

                const elapsed = Date.now() - startTime;
                this.logger.debug(`Data retrieved in ${elapsed}ms using TypeScript reader`);

                // Convert to existing response format
                return {
                    data: data,
                    total_rows: this.metadata?.total_rows || 0,
                    filtered_rows: filteredRowCount,
                    start_row: request.startRow,
                    returned_rows: data.length,
                    columns: request.selectedVars || this.metadata?.variables.map(v => v.name) || []
                };

            } catch (tsError) {
                this.logger.warn('TypeScript reader failed for data, falling back to Python', tsError);
                // Fall through to Python
            }
        }

        // Use Python fallback
        const args = [
            'data',
            request.filePath,
            request.startRow.toString(),
            request.numRows.toString(),
            request.selectedVars ? request.selectedVars.join(',') : '',
            request.whereClause || ''
        ];

        return await this.executePythonCommand('data', ...args.slice(1));
    }

    /**
     * Gets unique values for a column (new feature)
     */
    public async getUniqueValues(columnName: string, includeCount: boolean = false): Promise<any[]> {
        if (!this.usePythonFallback && this.reader) {
            return await this.reader.getUniqueValues(columnName, includeCount);
        }

        // Python fallback - implement manually
        const allData = await this.getData({
            filePath: this.uri.fsPath,
            startRow: 0,
            numRows: this.metadata?.total_rows || 10000,
            selectedVars: [columnName]
        });

        const uniqueMap = new Map<any, number>();
        for (const row of allData.data) {
            const value = row[columnName];
            uniqueMap.set(value, (uniqueMap.get(value) || 0) + 1);
        }

        if (includeCount) {
            return Array.from(uniqueMap.entries()).map(([value, count]) => ({ value, count }));
        } else {
            return Array.from(uniqueMap.keys());
        }
    }

    /**
     * Gets unique combinations for multiple columns (new feature)
     */
    public async getUniqueCombinations(columnNames: string[], includeCount: boolean = false): Promise<any[]> {
        if (!this.usePythonFallback && this.reader) {
            return await this.reader.getUniqueCombinations(columnNames, includeCount);
        }

        // Python fallback - implement manually
        const allData = await this.getData({
            filePath: this.uri.fsPath,
            startRow: 0,
            numRows: this.metadata?.total_rows || 10000,
            selectedVars: columnNames
        });

        const uniqueMap = new Map<string, any>();

        for (const row of allData.data) {
            const values = columnNames.map(col => row[col]);
            const key = JSON.stringify(values);

            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, includeCount ? { ...row, _count: 1 } : row);
            } else if (includeCount) {
                uniqueMap.get(key)._count++;
            }
        }

        return Array.from(uniqueMap.values());
    }

    /**
     * Executes a Python command and returns the parsed result
     */
    private async executePythonCommand(command: string, ...args: string[]): Promise<any> {
        const pythonScript = path.join(this.context.extensionPath, 'python', 'sas_reader.py');
        const fullArgs = [pythonScript, command, ...args];

        this.logger.debug(`Executing Python fallback: ${fullArgs.join(' ')}`);

        const pyEnv = PythonEnvironment.getInstance();
        await pyEnv.ensureReady(this.context);

        return new Promise((resolve, reject) => {
            const pythonProcess = pyEnv.spawnPython(fullArgs, this.context.extensionPath);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                this.logger.debug(`Python process exited with code ${code}`);

                if (code !== 0) {
                    this.logger.error('Python process failed', { code, stderr });
                    reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.error) {
                        this.logger.error('Python script returned error', result.error);
                        reject(new Error(result.error));
                    } else {
                        resolve(result.metadata || result);
                    }
                } catch (parseError) {
                    this.logger.error('Failed to parse Python output', {
                        parseError: parseError instanceof Error ? parseError.message : parseError,
                        stdout: stdout.substring(0, 500) // Limit output for logging
                    });
                    reject(new Error(`Failed to parse Python output: ${parseError}. Output was: ${stdout}`));
                }
            });

            pythonProcess.on('error', (error) => {
                this.logger.error('Failed to spawn Python process', error);
                reject(new Error(`Failed to spawn Python process: ${error.message}`));
            });
        });
    }

    /**
     * Disposes of the document and cleans up resources
     */
    dispose(): void {
        this.logger.debug(`Disposing document: ${this.uri.fsPath}`);
        if (this.reader) {
            this.reader.dispose();
            this.reader = null;
        }
    }
}