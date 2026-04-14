import * as vscode from 'vscode';
import * as path from 'path';
import { SASWebviewPanel } from './WebviewPanel';
import { SASMetadata, SASDataResponse, SASDataRequest, IDatasetDocument } from './types';
import { Logger } from './utils/logger';
import { XPTReader, DatasetMetadata, DataRow } from './readers/XPTReader';
import { PythonEnvironment } from './utils/pythonEnvironment';

/**
 * VS Code custom editor provider for XPT files (.xpt)
 * Handles the lifecycle of XPT dataset documents and their associated webview editors
 */
export class XPTDatasetProvider implements vscode.CustomReadonlyEditorProvider<XPTDatasetDocument> {
    private static readonly viewType = 'sasDataExplorer.xpt';
    private readonly logger = Logger.createScoped('XPTDatasetProvider');

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger.debug('XPTDatasetProvider initialized');
    }

    /**
     * Creates a custom document for an XPT file
     */
    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<XPTDatasetDocument> {
        this.logger.info(`Opening XPT file: ${uri.fsPath}`);
        const document = await XPTDatasetDocument.create(uri, this.context);
        return document;
    }

    /**
     * Resolves a custom editor for an XPT dataset document
     */
    public async resolveCustomEditor(
        document: XPTDatasetDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.debug(`Resolving custom editor for: ${document.uri.fsPath}`);
        const sasWebviewPanel = new SASWebviewPanel(webviewPanel, document, this.context);
        await sasWebviewPanel.initialize();
    }
}

/**
 * Represents an XPT dataset document with metadata and data access capabilities
 */
export class XPTDatasetDocument implements IDatasetDocument {
    private readonly logger = Logger.createScoped('XPTDatasetDocument');
    private reader: XPTReader | null = null;
    private static v8NotificationShown = false; // Track if we've shown the v8 notification this session

    private constructor(
        public readonly uri: vscode.Uri,
        public metadata: SASMetadata | null = null,
        private readonly context: vscode.ExtensionContext
    ) {}

    /**
     * Factory method to create an XPT dataset document
     */
    public static async create(
        uri: vscode.Uri,
        context: vscode.ExtensionContext
    ): Promise<XPTDatasetDocument> {
        const document = new XPTDatasetDocument(uri, null, context);
        await document.loadMetadata();
        return document;
    }

    /**
     * Loads metadata for the XPT file
     */
    private async loadMetadata(): Promise<void> {
        try {
            this.logger.info(`Loading metadata for XPT file: ${this.uri.fsPath}`);

            // Try TypeScript reader first (works for v5/v6)
            try {
                this.reader = new XPTReader(this.uri.fsPath);
                const xptMetadata = await this.reader.getMetadata();

                // Convert to existing format for compatibility
                this.metadata = this.convertMetadata(xptMetadata);

                this.logger.info('XPT metadata loaded successfully with TypeScript reader', {
                    totalRows: this.metadata?.total_rows,
                    totalVariables: this.metadata?.total_variables,
                    dataset_label: this.metadata?.dataset_label
                });

            } catch (tsError: any) {
                // Check if this is a v8 file (expected behavior)
                const isV8File = tsError?.message?.includes('v8/v9 XPT file');

                if (isV8File) {
                    this.logger.info('XPT v8/v9 format detected - using Python reader for full compatibility');

                    // Show a friendly info message to the user (only once per session)
                    if (!XPTDatasetDocument.v8NotificationShown) {
                        XPTDatasetDocument.v8NotificationShown = true;
                        vscode.window.showInformationMessage(
                            'XPT v8/v9 format detected. Using Python reader for compatibility (this may take a moment to load).'
                        );
                    }
                } else {
                    // Unexpected error - log with more detail
                    this.logger.warn('TypeScript XPT reader failed, falling back to Python', tsError);
                }

                // Fallback to Python for v8/v9 files
                this.metadata = await this.executePythonCommand('metadata', this.uri.fsPath);

                this.logger.info('XPT metadata loaded successfully with Python fallback', {
                    totalRows: this.metadata?.total_rows,
                    totalVariables: this.metadata?.total_variables,
                    dataset_label: this.metadata?.dataset_label
                });

                // Mark that we're using Python for this file
                this.reader = null;
            }

        } catch (error) {
            this.logger.error('Failed to load XPT metadata', error);
            throw error;
        }
    }

    /**
     * Converts XPT reader metadata to existing format
     */
    private convertMetadata(xptMetadata: DatasetMetadata): SASMetadata {
        return {
            total_rows: xptMetadata.rowCount,
            total_variables: xptMetadata.columnCount,
            variables: xptMetadata.variables.map(v => ({
                name: v.name,
                type: v.type === 'string' ? 'character' : 'numeric',
                label: v.label,
                format: v.format || '',
                length: v.length,
                dtype: v.type
            })),
            file_path: this.uri.fsPath,
            dataset_label: xptMetadata.label || path.basename(this.uri.fsPath, '.xpt')
        };
    }

    /**
     * Get the count of rows matching a filter without loading data
     */
    public async getFilteredRowCount(whereClause: string): Promise<number> {
        if (this.reader) {
            try {
                return await this.reader.getFilteredRowCount(whereClause);
            } catch (error) {
                this.logger.warn('Failed to get filtered row count', error);
            }
        }

        return 0;
    }

    /**
     * Retrieves data from the XPT file based on the request parameters
     */
    public async getData(request: SASDataRequest): Promise<SASDataResponse> {
        this.logger.debug('Getting data from XPT file', {
            startRow: request.startRow,
            numRows: request.numRows,
            selectedVarsCount: request.selectedVars?.length || 0,
            hasWhereClause: !!request.whereClause,
            usingTypeScript: this.reader !== null
        });

        // Use TypeScript reader if available (v5/v6), otherwise use Python (v8)
        if (this.reader) {
            try {
                const startTime = Date.now();

                // Get data with TypeScript XPT reader
                let data: DataRow[];
                let filteredRowCount: number;

                if (request.whereClause) {
                    filteredRowCount = await this.reader.getFilteredRowCount(request.whereClause);
                    data = await this.reader.getData({
                        startRow: request.startRow,
                        numRows: request.numRows,
                        variables: request.selectedVars,
                        whereClause: request.whereClause
                    });
                    this.logger.info(`Filter applied, ${filteredRowCount} rows match, returned ${data.length} rows`);
                } else {
                    data = await this.reader.getData({
                        startRow: request.startRow,
                        numRows: request.numRows,
                        variables: request.selectedVars
                    });
                    filteredRowCount = this.metadata?.total_rows || 0;
                }

                const elapsed = Date.now() - startTime;
                this.logger.debug(`Data retrieved in ${elapsed}ms from TypeScript XPT reader`);

                return {
                    data: data,
                    total_rows: this.metadata?.total_rows || 0,
                    filtered_rows: filteredRowCount,
                    start_row: request.startRow,
                    returned_rows: data.length,
                    columns: request.selectedVars || this.metadata?.variables.map(v => v.name) || []
                };

            } catch (tsError) {
                this.logger.warn('TypeScript XPT reader failed for data, falling back to Python', tsError);
                // Fall through to Python fallback below
            }
        }

        // Use Python fallback for v8 files or if TypeScript failed
        try {
            const args = [
                'data',
                request.filePath,
                request.startRow.toString(),
                request.numRows.toString(),
                request.selectedVars ? request.selectedVars.join(',') : '',
                request.whereClause || ''
            ];

            return await this.executePythonCommand('data', ...args.slice(1));

        } catch (error) {
            this.logger.error('Failed to get data from XPT file', error);
            throw error;
        }
    }

    /**
     * Gets unique values for a column
     */
    public async getUniqueValues(columnName: string, includeCount: boolean = false): Promise<any[]> {
        if (this.reader) {
            return await this.reader.getUniqueValues(columnName, includeCount);
        }

        return [];
    }

    /**
     * Gets unique combinations for multiple columns
     */
    public async getUniqueCombinations(columnNames: string[], includeCount: boolean = false): Promise<any[]> {
        if (this.reader) {
            return await this.reader.getUniqueCombinations(columnNames, includeCount);
        }

        return [];
    }

    /**
     * Executes a Python command for XPT file operations
     */
    private async executePythonCommand(command: string, ...args: string[]): Promise<any> {
        const pythonScript = path.join(this.context.extensionPath, 'python', 'xpt_reader.py');
        const fullArgs = [pythonScript, command, ...args];

        this.logger.debug(`Executing Python for XPT: ${fullArgs.join(' ')}`);

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
                        stdout: stdout.substring(0, 500)
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
        this.logger.debug(`Disposing XPT document: ${this.uri.fsPath}`);
        if (this.reader) {
            this.reader.dispose();
            this.reader = null;
        }
    }
}
