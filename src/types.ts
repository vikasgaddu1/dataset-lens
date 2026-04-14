import * as vscode from 'vscode';

/**
 * Represents a SAS variable with its metadata
 */
export interface SASVariable {
    name: string;
    type: 'character' | 'numeric';
    label?: string;
    format?: string;
    length?: number;
}

/**
 * Metadata for a SAS dataset
 */
export interface SASMetadata {
    total_rows: number;
    total_variables: number;
    variables: SASVariable[];
    file_path: string;
    dataset_label?: string;
}

/**
 * Response from SAS data request
 */
export interface SASDataResponse {
    data: Array<Record<string, any>>;
    total_rows: number;
    filtered_rows?: number;
    start_row: number;
    returned_rows: number;
    columns: string[];
}

/**
 * Request parameters for SAS data retrieval
 */
export interface SASDataRequest {
    filePath: string;
    startRow: number;
    numRows: number;
    selectedVars?: string[];
    whereClause?: string;
}

/**
 * Message structure for webview communication
 */
export interface WebviewMessage {
    command: string;
    data?: any;
}

/**
 * State for filtering and variable selection
 */
export interface FilterState {
    selectedVariables: string[];
    whereClause: string;
    variableOrder: string[];
}

/**
 * Common interface for dataset documents (SAS7BDAT and XPT)
 */
export interface IDatasetDocument extends vscode.CustomDocument {
    metadata: SASMetadata | null;
    getData(request: SASDataRequest): Promise<SASDataResponse>;
    getFilteredRowCount(whereClause: string): Promise<number>;
    getUniqueValues(columnName: string, includeCount?: boolean): Promise<any[]>;
    getUniqueCombinations(columnNames: string[], includeCount?: boolean): Promise<any[]>;
}