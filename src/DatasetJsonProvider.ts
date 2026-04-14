import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SASWebviewPanel } from './WebviewPanel';
import { SASMetadata, SASDataResponse, SASDataRequest, SASVariable, IDatasetDocument } from './types';
import { Logger } from './utils/logger';

/**
 * Parsed structure of a CDISC Dataset-JSON file
 */
interface DatasetJsonData {
    columns: DatasetJsonItem[];
    rows: any[][];
    datasetName: string;
    datasetLabel: string;
    records: number;
}

interface DatasetJsonItem {
    OID: string;
    name: string;
    label: string;
    type: string;
    length?: number;
}

/**
 * VS Code custom editor provider for CDISC Dataset-JSON files
 */
export class DatasetJsonProvider implements vscode.CustomReadonlyEditorProvider<DatasetJsonDocument> {
    private readonly logger = Logger.createScoped('DatasetJsonProvider');

    constructor(
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger.debug('DatasetJsonProvider initialized');
    }

    public async openCustomDocument(
        uri: vscode.Uri,
        openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<DatasetJsonDocument> {
        this.logger.info(`Opening Dataset-JSON file: ${uri.fsPath}`);
        const document = await DatasetJsonDocument.create(uri, this.context);
        return document;
    }

    public async resolveCustomEditor(
        document: DatasetJsonDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.debug(`Resolving custom editor for: ${document.uri.fsPath}`);
        const sasWebviewPanel = new SASWebviewPanel(webviewPanel, document, this.context);
        await sasWebviewPanel.initialize();
    }
}

/**
 * Represents a CDISC Dataset-JSON document with metadata and data access
 */
export class DatasetJsonDocument implements IDatasetDocument {
    private readonly logger = Logger.createScoped('DatasetJsonDocument');
    private parsedData: DatasetJsonData | null = null;

    private constructor(
        public readonly uri: vscode.Uri,
        public metadata: SASMetadata | null = null,
        private readonly context: vscode.ExtensionContext
    ) {}

    public static async create(
        uri: vscode.Uri,
        context: vscode.ExtensionContext
    ): Promise<DatasetJsonDocument> {
        const document = new DatasetJsonDocument(uri, null, context);
        await document.loadAndParse();
        return document;
    }

    /**
     * Loads and parses the Dataset-JSON file, extracting metadata and data
     */
    private async loadAndParse(): Promise<void> {
        try {
            this.logger.info(`Loading Dataset-JSON file: ${this.uri.fsPath}`);
            const startTime = Date.now();

            const content = await fs.promises.readFile(this.uri.fsPath, 'utf-8');
            const json = JSON.parse(content);

            this.parsedData = this.parseDatasetJson(json);

            // Convert to SASMetadata for compatibility
            this.metadata = {
                total_rows: this.parsedData.records,
                total_variables: this.parsedData.columns.length,
                variables: this.parsedData.columns.map(col => ({
                    name: col.name,
                    type: (col.type === 'string' ? 'character' : 'numeric') as 'character' | 'numeric',
                    label: col.label || '',
                    format: '',
                    length: col.length
                })),
                file_path: this.uri.fsPath,
                dataset_label: this.parsedData.datasetLabel || this.parsedData.datasetName
            };

            const elapsed = Date.now() - startTime;
            this.logger.info(`Dataset-JSON loaded in ${elapsed}ms`, {
                dataset: this.parsedData.datasetName,
                rows: this.parsedData.records,
                columns: this.parsedData.columns.length
            });

        } catch (error) {
            this.logger.error('Failed to load Dataset-JSON file', error);
            throw error;
        }
    }

    /**
     * Parses a CDISC Dataset-JSON object.
     * Supports both v1.0 and v1.1 formats, as well as clinicalData and referenceData.
     */
    private parseDatasetJson(json: any): DatasetJsonData {
        // Dataset-JSON v1.1 structure: clinicalData or referenceData at top level
        // Dataset-JSON v1.0 structure: clinicalData.itemGroupData or referenceData.itemGroupData
        const dataRoot = json.clinicalData || json.referenceData;
        if (!dataRoot || !dataRoot.itemGroupData) {
            throw new Error('Invalid CDISC Dataset-JSON: missing clinicalData/referenceData or itemGroupData');
        }

        const itemGroupData = dataRoot.itemGroupData;

        // itemGroupData can be an object with dataset name keys, or in v1.1 a single dataset
        let datasetName: string;
        let datasetObj: any;

        if (typeof itemGroupData === 'object' && !Array.isArray(itemGroupData)) {
            // Could be { "DM": { ... } } or directly { records: ..., name: ..., columns/items: ..., rows/itemData: ... }
            if (itemGroupData.records !== undefined && (itemGroupData.items || itemGroupData.columns)) {
                // v1.1 direct format
                datasetName = itemGroupData.name || path.basename(this.uri.fsPath, '.json');
                datasetObj = itemGroupData;
            } else {
                // v1.0 format: { "DATASETNAME": { ... } }
                const keys = Object.keys(itemGroupData);
                if (keys.length === 0) {
                    throw new Error('Invalid CDISC Dataset-JSON: itemGroupData is empty');
                }
                datasetName = keys[0];
                datasetObj = itemGroupData[datasetName];
            }
        } else {
            throw new Error('Invalid CDISC Dataset-JSON: unexpected itemGroupData format');
        }

        const items: DatasetJsonItem[] = (datasetObj.items || datasetObj.columns || []).map((item: any) => ({
            OID: item.OID || item.oid || item.itemOID || '',
            name: item.name || '',
            label: item.label || '',
            type: item.type || item.dataType || 'string',
            length: item.length
        }));

        // itemData (v1.0) or rows (v1.1) — array of arrays
        const rows: any[][] = datasetObj.itemData || datasetObj.rows || [];
        const records = datasetObj.records ?? rows.length;

        return {
            columns: items,
            rows,
            datasetName: datasetObj.name || datasetName,
            datasetLabel: datasetObj.label || '',
            records
        };
    }

    /**
     * Retrieves data from the parsed Dataset-JSON
     */
    public async getData(request: SASDataRequest): Promise<SASDataResponse> {
        if (!this.parsedData || !this.metadata) {
            throw new Error('Dataset-JSON not loaded');
        }

        const startTime = Date.now();
        const allColumns = this.parsedData.columns.map(c => c.name);
        const selectedVars = request.selectedVars || allColumns;

        // Get column indices for selected variables
        const colIndices = selectedVars.map(v => {
            const idx = allColumns.findIndex(c => c.toLowerCase() === v.toLowerCase());
            return idx;
        }).filter(i => i >= 0);

        // Apply WHERE clause filter if present
        let filteredRows = this.parsedData.rows;
        if (request.whereClause) {
            filteredRows = this.applyWhereClause(filteredRows, allColumns, request.whereClause);
        }

        const totalFiltered = filteredRows.length;

        // Apply pagination
        const startRow = request.startRow || 0;
        const numRows = request.numRows || 50;
        const pageRows = filteredRows.slice(startRow, startRow + numRows);

        // Convert to row objects
        const data = pageRows.map(row => {
            const obj: Record<string, any> = {};
            for (const idx of colIndices) {
                obj[allColumns[idx]] = row[idx];
            }
            return obj;
        });

        const elapsed = Date.now() - startTime;
        this.logger.debug(`getData completed in ${elapsed}ms`, {
            returned: data.length,
            filtered: totalFiltered
        });

        return {
            data,
            total_rows: this.parsedData.records,
            filtered_rows: totalFiltered,
            start_row: startRow,
            returned_rows: data.length,
            columns: selectedVars
        };
    }

    /**
     * Gets count of rows matching a WHERE clause
     */
    public async getFilteredRowCount(whereClause: string): Promise<number> {
        if (!this.parsedData) return 0;
        const allColumns = this.parsedData.columns.map(c => c.name);
        const filtered = this.applyWhereClause(this.parsedData.rows, allColumns, whereClause);
        return filtered.length;
    }

    /**
     * Gets unique values for a column
     */
    public async getUniqueValues(columnName: string, includeCount: boolean = false): Promise<any[]> {
        if (!this.parsedData) return [];

        const allColumns = this.parsedData.columns.map(c => c.name);
        const colIdx = allColumns.findIndex(c => c.toLowerCase() === columnName.toLowerCase());
        if (colIdx < 0) return [];

        const counts = new Map<any, number>();
        for (const row of this.parsedData.rows) {
            const val = row[colIdx];
            counts.set(val, (counts.get(val) || 0) + 1);
        }

        if (includeCount) {
            return Array.from(counts.entries()).map(([value, count]) => ({ value, count }));
        }

        return Array.from(counts.keys());
    }

    /**
     * Gets unique combinations for multiple columns
     */
    public async getUniqueCombinations(columnNames: string[], includeCount: boolean = false): Promise<any[]> {
        if (!this.parsedData) return [];

        const allColumns = this.parsedData.columns.map(c => c.name);
        const colIndices = columnNames.map(name =>
            allColumns.findIndex(c => c.toLowerCase() === name.toLowerCase())
        ).filter(i => i >= 0);

        if (colIndices.length === 0) return [];

        const counts = new Map<string, { values: Record<string, any>; count: number }>();

        for (const row of this.parsedData.rows) {
            const values: Record<string, any> = {};
            for (const idx of colIndices) {
                values[allColumns[idx]] = row[idx];
            }
            const key = JSON.stringify(values);
            const existing = counts.get(key);
            if (existing) {
                existing.count++;
            } else {
                counts.set(key, { values, count: 1 });
            }
        }

        if (includeCount) {
            return Array.from(counts.values()).map(entry => ({
                ...entry.values,
                _count: entry.count
            }));
        }

        return Array.from(counts.values()).map(entry => entry.values);
    }

    /**
     * Applies a SAS-style WHERE clause filter to row data
     */
    private applyWhereClause(rows: any[][], columns: string[], whereClause: string): any[][] {
        if (!whereClause.trim()) return rows;

        try {
            const filter = this.parseWhereClause(whereClause, columns);
            return rows.filter(row => filter(row));
        } catch (error) {
            this.logger.warn('Failed to apply WHERE clause', error);
            return rows;
        }
    }

    /**
     * Parses a WHERE clause into a filter function
     */
    private parseWhereClause(whereClause: string, columns: string[]): (row: any[]) => boolean {
        // Split on AND/OR while preserving operator
        const orParts = whereClause.split(/\b(OR)\b/i);
        const orConditions: Array<(row: any[]) => boolean> = [];

        let currentAndConditions: Array<(row: any[]) => boolean> = [];

        for (const part of orParts) {
            const trimmed = part.trim();
            if (trimmed.toUpperCase() === 'OR') {
                if (currentAndConditions.length > 0) {
                    const andConds = [...currentAndConditions];
                    orConditions.push((row) => andConds.every(fn => fn(row)));
                    currentAndConditions = [];
                }
                continue;
            }

            // Split on AND
            const andParts = trimmed.split(/\b(AND)\b/i);
            for (const andPart of andParts) {
                const t = andPart.trim();
                if (t.toUpperCase() === 'AND' || t === '') continue;
                const condition = this.parseSingleCondition(t, columns);
                if (condition) {
                    currentAndConditions.push(condition);
                }
            }
        }

        if (currentAndConditions.length > 0) {
            const andConds = [...currentAndConditions];
            orConditions.push((row) => andConds.every(fn => fn(row)));
        }

        if (orConditions.length === 0) {
            return () => true;
        }

        return (row) => orConditions.some(fn => fn(row));
    }

    /**
     * Parses a single condition like "AGE > 30" or "COUNTRY = 'USA'"
     */
    private parseSingleCondition(condition: string, columns: string[]): ((row: any[]) => boolean) | null {
        // Match: COLUMN OPERATOR VALUE
        const match = condition.match(/^\s*(\w+)\s*(>=|<=|!=|<>|=|>|<|EQ|NE|GT|LT|GE|LE|IN)\s*(.+)\s*$/i);
        if (!match) return null;

        const colName = match[1];
        let operator = match[2].toUpperCase();
        let valueStr = match[3].trim();

        const colIdx = columns.findIndex(c => c.toLowerCase() === colName.toLowerCase());
        if (colIdx < 0) return null;

        // Normalize operators
        const opMap: Record<string, string> = {
            'EQ': '=', 'NE': '!=', 'GT': '>', 'LT': '<', 'GE': '>=', 'LE': '<=', '<>': '!='
        };
        operator = opMap[operator] || operator;

        // Handle IN operator
        if (operator === 'IN') {
            const inMatch = valueStr.match(/^\((.+)\)$/);
            if (!inMatch) return null;
            const inValues = inMatch[1].split(',').map(v => {
                v = v.trim();
                if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
                    return v.slice(1, -1).toLowerCase();
                }
                return parseFloat(v);
            });

            return (row: any[]) => {
                const cellVal = row[colIdx];
                if (typeof cellVal === 'string') {
                    return inValues.includes(cellVal.toLowerCase());
                }
                return inValues.includes(cellVal);
            };
        }

        // Parse value (string or numeric)
        let compareValue: string | number;
        let isString = false;
        if ((valueStr.startsWith("'") && valueStr.endsWith("'")) || (valueStr.startsWith('"') && valueStr.endsWith('"'))) {
            compareValue = valueStr.slice(1, -1);
            isString = true;
        } else {
            compareValue = parseFloat(valueStr);
            if (isNaN(compareValue)) {
                compareValue = valueStr;
                isString = true;
            }
        }

        return (row: any[]) => {
            let cellVal = row[colIdx];

            if (isString) {
                const cellStr = (cellVal ?? '').toString().toLowerCase();
                const cmpStr = (compareValue as string).toLowerCase();
                switch (operator) {
                    case '=': return cellStr === cmpStr;
                    case '!=': return cellStr !== cmpStr;
                    case '>': return cellStr > cmpStr;
                    case '<': return cellStr < cmpStr;
                    case '>=': return cellStr >= cmpStr;
                    case '<=': return cellStr <= cmpStr;
                    default: return false;
                }
            } else {
                const numVal = typeof cellVal === 'number' ? cellVal : parseFloat(cellVal);
                const numCmp = compareValue as number;
                switch (operator) {
                    case '=': return numVal === numCmp;
                    case '!=': return numVal !== numCmp;
                    case '>': return numVal > numCmp;
                    case '<': return numVal < numCmp;
                    case '>=': return numVal >= numCmp;
                    case '<=': return numVal <= numCmp;
                    default: return false;
                }
            }
        };
    }

    dispose(): void {
        this.logger.debug(`Disposing Dataset-JSON document: ${this.uri.fsPath}`);
        this.parsedData = null;
    }
}
