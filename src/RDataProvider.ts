import * as vscode from 'vscode';
import * as path from 'path';
import { SASWebviewPanel } from './WebviewPanel';
import { SASMetadata, SASDataResponse, SASDataRequest, IDatasetDocument } from './types';
import { Logger } from './utils/logger';
import { PythonEnvironment } from './utils/pythonEnvironment';

/**
 * Extended metadata for R data files that includes information about multiple objects
 */
interface RDataMetadata extends SASMetadata {
    available_objects?: string[];
    selected_object?: string | null;
}

/**
 * VS Code custom editor provider for R data files (.rds, .rdata, .rda)
 * Uses Python pyreadr library for reading R data formats
 */
export class RDatasetProvider implements vscode.CustomReadonlyEditorProvider<RDatasetDocument> {
    private readonly logger = Logger.createScoped('RDatasetProvider');

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger.debug('RDatasetProvider initialized');
    }

    /**
     * Creates a custom document for an R data file
     */
    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<RDatasetDocument> {
        this.logger.info(`Opening R data file: ${uri.fsPath}`);
        const document = await RDatasetDocument.create(uri, this.context);
        return document;
    }

    /**
     * Resolves a custom editor for an R dataset document
     */
    public async resolveCustomEditor(
        document: RDatasetDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.debug(`Resolving custom editor for: ${document.uri.fsPath}`);
        const sasWebviewPanel = new SASWebviewPanel(webviewPanel, document, this.context);
        await sasWebviewPanel.initialize();
    }
}

/**
 * Represents an R dataset document with metadata and data access capabilities
 * Always uses Python pyreadr library for reading data
 */
export class RDatasetDocument implements IDatasetDocument {
    private readonly logger = Logger.createScoped('RDatasetDocument');
    private selectedObject: string | null = null;
    private availableObjects: string[] = [];

    private constructor(
        public readonly uri: vscode.Uri,
        public metadata: SASMetadata | null = null,
        private readonly context: vscode.ExtensionContext
    ) {}

    /**
     * Factory method to create an R dataset document
     */
    public static async create(
        uri: vscode.Uri,
        context: vscode.ExtensionContext
    ): Promise<RDatasetDocument> {
        const document = new RDatasetDocument(uri, null, context);
        await document.loadMetadata();
        return document;
    }

    /**
     * Loads metadata for the R data file using Python
     */
    private async loadMetadata(): Promise<void> {
        try {
            this.logger.info(`Loading metadata for R data file: ${this.uri.fsPath}`);

            const result = await this.executePythonCommand('metadata', this.uri.fsPath);

            // Store R-specific metadata
            if (result.available_objects) {
                this.availableObjects = result.available_objects;
            }
            if (result.selected_object !== undefined) {
                this.selectedObject = result.selected_object;
            }

            // Convert to standard SASMetadata format
            this.metadata = {
                total_rows: result.total_rows,
                total_variables: result.total_variables,
                variables: result.variables,
                file_path: result.file_path,
                dataset_label: result.dataset_label
            };

            this.logger.info('R data metadata loaded successfully', {
                totalRows: this.metadata?.total_rows,
                totalVariables: this.metadata?.total_variables,
                dataset_label: this.metadata?.dataset_label,
                selectedObject: this.selectedObject,
                availableObjectsCount: this.availableObjects.length
            });

            // Notify user if file contains multiple objects
            if (this.availableObjects.length > 1) {
                const objectNames = this.availableObjects.join(', ');
                vscode.window.showInformationMessage(
                    `R data file contains multiple objects: ${objectNames}. Displaying: ${this.selectedObject || 'first data frame'}`
                );
            }

        } catch (error) {
            this.logger.error('Failed to load R data metadata', error);
            throw error;
        }
    }

    /**
     * Get the count of rows matching a filter without loading all data
     */
    public async getFilteredRowCount(whereClause: string): Promise<number> {
        try {
            const result = await this.executePythonCommand(
                'count',
                this.uri.fsPath,
                whereClause || '',
                this.selectedObject || ''
            );

            if (result.count !== undefined) {
                return result.count;
            }

            return this.metadata?.total_rows || 0;

        } catch (error) {
            this.logger.warn('Failed to get filtered row count', error);
            return this.metadata?.total_rows || 0;
        }
    }

    /**
     * Retrieves data from the R data file based on the request parameters
     */
    public async getData(request: SASDataRequest): Promise<SASDataResponse> {
        this.logger.debug('Getting data from R data file', {
            startRow: request.startRow,
            numRows: request.numRows,
            selectedVarsCount: request.selectedVars?.length || 0,
            hasWhereClause: !!request.whereClause,
            selectedObject: this.selectedObject
        });

        try {
            const args = [
                this.uri.fsPath,
                request.startRow.toString(),
                request.numRows.toString(),
                request.selectedVars ? request.selectedVars.join(',') : '',
                request.whereClause || '',
                this.selectedObject || ''
            ];

            const result = await this.executePythonCommand('data', ...args);

            return {
                data: result.data || [],
                total_rows: result.total_rows || this.metadata?.total_rows || 0,
                filtered_rows: result.filtered_rows || result.total_rows || 0,
                start_row: result.start_row || request.startRow,
                returned_rows: result.returned_rows || result.data?.length || 0,
                columns: result.columns || request.selectedVars || this.metadata?.variables.map(v => v.name) || []
            };

        } catch (error) {
            this.logger.error('Failed to get data from R data file', error);
            throw error;
        }
    }

    /**
     * Gets unique values for a column
     */
    public async getUniqueValues(columnName: string, includeCount: boolean = false): Promise<any[]> {
        try {
            const result = await this.executePythonCommand(
                'unique',
                this.uri.fsPath,
                columnName,
                includeCount.toString(),
                this.selectedObject || ''
            );

            return result.values || [];

        } catch (error) {
            this.logger.warn('Failed to get unique values', error);
            return [];
        }
    }

    /**
     * Gets unique combinations for multiple columns
     * Note: Not fully implemented in Python reader yet - returns empty array
     */
    public async getUniqueCombinations(columnNames: string[], includeCount: boolean = false): Promise<any[]> {
        // Would need to implement this in r_reader.py if needed
        this.logger.debug('getUniqueCombinations called but not implemented for R data files');
        return [];
    }

    /**
     * Lists all objects available in the R data file
     */
    public async listObjects(): Promise<Array<{name: string, type: string, is_dataframe: boolean, rows?: number, columns?: number}>> {
        try {
            const result = await this.executePythonCommand('list_objects', this.uri.fsPath);
            return result.objects || [];
        } catch (error) {
            this.logger.warn('Failed to list objects', error);
            return [];
        }
    }

    /**
     * Gets the currently selected object name (for .rdata files with multiple objects)
     */
    public getSelectedObject(): string | null {
        return this.selectedObject;
    }

    /**
     * Gets the list of available objects (for .rdata files)
     */
    public getAvailableObjects(): string[] {
        return this.availableObjects;
    }

    /**
     * Executes a Python command for R data file operations
     */
    private async executePythonCommand(command: string, ...args: string[]): Promise<any> {
        const pythonScript = path.join(this.context.extensionPath, 'python', 'r_reader.py');
        const fullArgs = [pythonScript, command, ...args];

        this.logger.debug(`Executing Python for R data: ${fullArgs.join(' ')}`);

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
                reject(new Error(`Failed to spawn Python process: ${error.message}. Make sure Python is installed and pyreadr is available (pip install pyreadr).`));
            });
        });
    }

    /**
     * Disposes of the document and cleans up resources
     */
    dispose(): void {
        this.logger.debug(`Disposing R data document: ${this.uri.fsPath}`);
    }
}
