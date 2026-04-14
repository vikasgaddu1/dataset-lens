/**
 * XPT (SAS XPORT) File Reader
 * Wrapper around xport-js library for reading SAS Transport files
 */

import * as path from 'path';

// Type definitions for xport-js Library class
interface XportVariable {
    name: string;
    label: string;
    type: number;  // 1 = numeric, 2 = character
    length: number;
    format?: string;
    informat?: string;
}

interface XportDataset {
    name: string;
    label?: string;
    type: string;
    created: Date;
    modified: Date;
    sasVersion?: string;
    osType?: string;
    variables: XportVariable[];
    records?: number;
}

interface XportLibraryMetadata {
    version: number;
    osType?: string;
    created: Date;
    modified: Date;
    datasets: XportDataset[];
}

export interface VariableMetadata {
    name: string;
    label: string;
    type: string;
    length: number;
    format?: string;
}

export interface DatasetMetadata {
    rowCount: number;
    columnCount: number;
    variables: VariableMetadata[];
    encoding?: string;
    createdDate?: Date;
    modifiedDate?: Date;
    label?: string;
}

export interface DataRow {
    [key: string]: any;
}

export class XPTReader {
    private filePath: string;
    private metadata: DatasetMetadata | null = null;
    private allData: DataRow[] | null = null;
    private library: any = null;
    private usePythonFallback: boolean = false;
    private actualRowCount: number | null = null; // Cache actual row count once computed

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    /**
     * Check if file is XPORT V8/V9 (not supported by xport-js)
     * xport-js only supports v5/v6 files (identified by "HEADER RECORD" without "LIBV8")
     */
    private async isXportV8(): Promise<boolean> {
        try {
            const fs = await import('fs');
            const buffer = fs.readFileSync(this.filePath);
            const header = buffer.toString('latin1', 0, 200);

            console.log('[XPTReader] Checking XPT version...');

            // Check if header contains LIBV8 or LIBV9 - these are NOT supported by xport-js
            if (header.includes('LIBV8') || header.includes('LIBV9')) {
                console.log('[XPTReader] Detected v8/v9 XPT file (LIBV8/LIBV9 found)');
                return true;
            }

            // v5/v6 files should have "HEADER RECORD" and "LIBRARY HEADER RECORD"
            if (header.includes('HEADER RECORD') && header.includes('LIBRARY HEADER RECORD')) {
                console.log('[XPTReader] Detected v5/v6 XPT file (supported by xport-js)');
                return false;
            }

            // If we can't identify the format, assume it's not v8 and let xport-js try
            console.log('[XPTReader] Unknown XPT format, will attempt to read with xport-js');
            return false;
        } catch (error) {
            console.error('[XPTReader] Error checking XPT version:', error);
            // If we can't read the file, return false and let the actual read attempt fail with a better error
            return false;
        }
    }

    /**
     * Initialize the xport-js Library instance
     */
    private async getLibrary(): Promise<any> {
        if (!this.library) {
            try {
                const Library = (await import('xport-js')).default;
                this.library = new Library(this.filePath);
            } catch (error) {
                throw new Error(`Failed to initialize xport-js library: ${error}`);
            }
        }
        return this.library;
    }

    /**
     * Get metadata for the XPT file
     */
    async getMetadata(): Promise<DatasetMetadata> {
        if (this.metadata) {
            return this.metadata;
        }

        // Check if this is a v8 file BEFORE trying to use xport-js
        const isV8 = await this.isXportV8();
        if (isV8) {
            throw new Error('This is a v8/v9 XPT file which is not supported by xport-js. Use Python fallback.');
        }

        try {
            const lib = await this.getLibrary();

            // Get metadata from the library
            console.log('[XPTReader] Calling lib.getMetadata()...');
            let xptMetadata: any;

            try {
                xptMetadata = await lib.getMetadata();
                console.log('[XPTReader] Metadata type:', typeof xptMetadata);
                console.log('[XPTReader] Metadata is array:', Array.isArray(xptMetadata));
                console.log('[XPTReader] Metadata keys:', xptMetadata ? Object.keys(xptMetadata) : 'null');
                console.log('[XPTReader] Full metadata:', JSON.stringify(xptMetadata, null, 2));
            } catch (metaError: any) {
                console.error('[XPTReader] Error calling getMetadata():', metaError);
                console.error('[XPTReader] Stack:', metaError?.stack);
                throw new Error(`xport-js getMetadata() failed: ${metaError?.message || metaError}`);
            }

            if (!xptMetadata || xptMetadata === null || xptMetadata === undefined) {
                throw new Error('getMetadata() returned null or undefined');
            }

            // xport-js returns an array of variable metadata directly
            // Each element looks like: { dataset: "NAME", name: "VAR", label: "...", length: N, type: "Char"|"Num", format?: "..." }
            let variables: any[];
            let datasetName = 'Unknown';

            if (Array.isArray(xptMetadata) && xptMetadata.length > 0) {
                console.log('[XPTReader] Metadata is array of', xptMetadata.length, 'variables');
                variables = xptMetadata;
                // Get dataset name from first variable if available
                if (xptMetadata[0].dataset) {
                    datasetName = xptMetadata[0].dataset;
                }
            } else if (xptMetadata.variables && Array.isArray(xptMetadata.variables)) {
                // Fallback: maybe it's wrapped in an object
                console.log('[XPTReader] Metadata has variables array with', xptMetadata.variables.length, 'items');
                variables = xptMetadata.variables;
                datasetName = xptMetadata.name || xptMetadata.dataset || 'Unknown';
            } else if (xptMetadata.datasets && Array.isArray(xptMetadata.datasets) && xptMetadata.datasets.length > 0) {
                // Another fallback: datasets array structure
                console.log('[XPTReader] Found datasets array');
                const dataset = xptMetadata.datasets[0];
                variables = dataset.variables || [];
                datasetName = dataset.name || dataset.dataset || 'Unknown';
            } else {
                console.error('[XPTReader] Unknown metadata structure. Keys:', Object.keys(xptMetadata || {}));
                console.error('[XPTReader] Type:', typeof xptMetadata);
                console.error('[XPTReader] Is array:', Array.isArray(xptMetadata));
                throw new Error('Unable to extract variable metadata from xport-js response');
            }

            if (!variables || variables.length === 0) {
                throw new Error('No variables found in XPT metadata');
            }

            console.log('[XPTReader] Found', variables.length, 'variables in dataset:', datasetName);
            console.log('[XPTReader] First variable:', JSON.stringify(variables[0], null, 2));

            // Count rows efficiently by iterating without storing data
            console.log('[XPTReader] Counting rows using efficient iteration...');
            const startCount = Date.now();
            const rowCount = await this.countRows();
            const countElapsed = Date.now() - startCount;
            console.log(`[XPTReader] Counted ${rowCount} rows in ${countElapsed}ms`);

            this.metadata = {
                rowCount: rowCount,
                columnCount: variables.length,
                variables: variables.map((v: any) => ({
                    name: v.name || 'UNKNOWN',
                    label: v.label || '',
                    type: (v.type === 'Num' || v.type === 1) ? 'number' : 'string',
                    length: v.length || 0,
                    format: v.format
                })),
                createdDate: undefined,
                modifiedDate: undefined,
                label: datasetName
            };

            return this.metadata;
        } catch (error: any) {
            console.error('[XPTReader] Error in getMetadata:', error);
            console.error('[XPTReader] Error stack:', error?.stack);
            throw new Error(`Failed to read XPT metadata: ${error?.message || error}`);
        }
    }

    /**
     * Detect if a row is a header/label row rather than actual data.
     * Checks for:
     * 1. Values containing parentheses (common in label rows)
     * 2. Values that match the column names themselves (header rows)
     * 3. Values that match the column labels (label rows without parentheses)
     * 4. Numeric columns containing NaN (common in header/label rows)
     */
    private isHeaderOrLabelRow(record: DataRow): boolean {
        const keys = Object.keys(record);
        const values = Object.values(record);

        console.log('[XPTReader] Checking first row for header/label detection:', JSON.stringify(record, null, 2));

        // Check for parentheses in string values (label rows)
        const hasLabelText = values.some(v =>
            typeof v === 'string' &&
            v.includes('(') &&
            v.includes(')')
        );
        if (hasLabelText) {
            console.log('[XPTReader] Detected label row: contains parentheses');
            return true;
        }

        // Check if string values match their own column names (header rows)
        const stringKeys = keys.filter(key => typeof record[key] === 'string');
        if (stringKeys.length > 0) {
            const nameMatches = stringKeys.filter(key => {
                const val = record[key];
                return typeof val === 'string' && val.trim().toUpperCase() === key.toUpperCase();
            });

            // If at least 2 string columns match their name, or all of them match, it's a header row
            if (nameMatches.length >= 2 || (nameMatches.length > 0 && nameMatches.length === stringKeys.length)) {
                console.log('[XPTReader] Detected header row: ' + nameMatches.length + ' of ' + stringKeys.length + ' string values match column names:', nameMatches);
                return true;
            }

            // Check if string values match the column labels from metadata
            if (this.metadata) {
                const labelMatches = stringKeys.filter(key => {
                    const val = (record[key] as string).trim().toUpperCase();
                    const varMeta = this.metadata!.variables.find(v => v.name.toUpperCase() === key.toUpperCase());
                    return varMeta && varMeta.label && val === varMeta.label.toUpperCase();
                });
                if (labelMatches.length >= 2 || (labelMatches.length > 0 && labelMatches.length === stringKeys.length)) {
                    console.log('[XPTReader] Detected label row: ' + labelMatches.length + ' of ' + stringKeys.length + ' string values match column labels:', labelMatches);
                    return true;
                }
            }
        }

        // Check if numeric columns are mostly NaN (common when a label/name row is misread as data)
        const numericKeys = keys.filter(key => typeof record[key] === 'number');
        if (numericKeys.length > 0 && stringKeys.length > 0) {
            const nanCount = numericKeys.filter(key => isNaN(record[key] as number)).length;
            const nameMatches = stringKeys.filter(key => {
                const val = record[key];
                return typeof val === 'string' && val.trim().toUpperCase() === key.toUpperCase();
            });
            // If we have at least 1 name match AND most numeric columns are NaN
            if (nameMatches.length >= 1 && nanCount >= Math.ceil(numericKeys.length / 2)) {
                console.log('[XPTReader] Detected header row: ' + nameMatches.length + ' name matches + ' + nanCount + ' of ' + numericKeys.length + ' numeric columns are NaN');
                return true;
            }
        }

        return false;
    }

    /**
     * Count rows without storing data (faster than readAllRecords)
     */
    private async countRows(): Promise<number> {
        try {
            const lib = await this.getLibrary();
            let count = 0;
            let rowIndex = 0;

            // Just iterate to count, don't store data
            for await (const record of lib.read({ rowFormat: 'object' })) {
                // Skip first row if it contains label/header text
                if (rowIndex === 0 && this.isHeaderOrLabelRow(record)) {
                    rowIndex++;
                    continue;
                }

                count++;
                rowIndex++;
            }

            return count;
        } catch (error) {
            console.error('[XPTReader] Error counting rows:', error);
            return 0;
        }
    }

    /**
     * Read all records from the XPT file
     */
    private async readAllRecords(): Promise<DataRow[]> {
        if (this.allData) {
            return this.allData;
        }

        try {
            const lib = await this.getLibrary();
            const records: DataRow[] = [];

            console.log('[XPTReader] Starting to read records...');

            let rowIndex = 0;
            // Use async iterator to read records as objects
            for await (const record of lib.read({ rowFormat: 'object' })) {
                // Skip first row if it contains label/header text instead of actual data
                if (rowIndex === 0 && this.isHeaderOrLabelRow(record)) {
                    console.log('[XPTReader] Skipping first row containing label/header text');
                    rowIndex++;
                    continue;
                }

                records.push(record);
                rowIndex++;
            }

            console.log(`[XPTReader] Read ${records.length} data records`);
            if (records.length > 0) {
                console.log('[XPTReader] First data record sample:', JSON.stringify(records[0], null, 2));
            }

            this.allData = records;
            this.actualRowCount = records.length;

            return records;
        } catch (error) {
            console.error('[XPTReader] Error reading records:', error);
            throw new Error(`Failed to read XPT records: ${error}`);
        }
    }

    /**
     * Get data with optional filtering and pagination
     */
    async getData(options?: {
        startRow?: number;
        numRows?: number;
        variables?: string[];
        whereClause?: string;
    }): Promise<DataRow[]> {
        const startRow = options?.startRow ?? 0;
        const numRows = options?.numRows ?? 100;
        const variables = options?.variables;
        const whereClause = options?.whereClause;

        // Read all records
        let records = await this.readAllRecords();

        // Apply WHERE clause filter if provided
        if (whereClause && whereClause.trim()) {
            records = this.applyFilter(records, whereClause);
        }

        // Apply pagination
        const paginatedRecords = records.slice(startRow, startRow + numRows);

        // Apply variable selection if provided
        if (variables && variables.length > 0) {
            return paginatedRecords.map(record => {
                const filtered: DataRow = {};
                for (const varName of variables) {
                    if (varName in record) {
                        filtered[varName] = record[varName];
                    }
                }
                return filtered;
            });
        }

        return paginatedRecords;
    }

    /**
     * Get count of rows matching a filter
     */
    async getFilteredRowCount(whereClause: string): Promise<number> {
        if (!whereClause || !whereClause.trim()) {
            const metadata = await this.getMetadata();
            return metadata.rowCount;
        }

        const records = await this.readAllRecords();
        const filtered = this.applyFilter(records, whereClause);
        return filtered.length;
    }

    /**
     * Apply WHERE clause filter to records
     */
    private applyFilter(records: DataRow[], whereClause: string): DataRow[] {
        if (!whereClause || !whereClause.trim()) {
            return records;
        }

        try {
            // Simple WHERE clause parser (supports basic conditions)
            // This is a simplified implementation - you may want to enhance it
            const condition = this.parseWhereClause(whereClause);
            return records.filter(record => this.evaluateCondition(record, condition));
        } catch (error) {
            console.error('Error applying filter:', error);
            return records;
        }
    }

    /**
     * Parse WHERE clause into a condition object
     */
    private parseWhereClause(whereClause: string): any {
        // Remove "WHERE" keyword if present
        const clause = whereClause.replace(/^\s*where\s+/i, '').trim();

        // Simple parser for basic conditions
        // Supports: variable = value, variable > value, variable < value, etc.
        const patterns = [
            { regex: /(\w+)\s*=\s*['"]([^'"]+)['"]/i, op: '=' },
            { regex: /(\w+)\s*=\s*(\d+(?:\.\d+)?)/i, op: '=' },
            { regex: /(\w+)\s*>\s*(\d+(?:\.\d+)?)/i, op: '>' },
            { regex: /(\w+)\s*<\s*(\d+(?:\.\d+)?)/i, op: '<' },
            { regex: /(\w+)\s*>=\s*(\d+(?:\.\d+)?)/i, op: '>=' },
            { regex: /(\w+)\s*<=\s*(\d+(?:\.\d+)?)/i, op: '<=' },
            { regex: /(\w+)\s*!=\s*['"]([^'"]+)['"]/i, op: '!=' },
            { regex: /(\w+)\s*!=\s*(\d+(?:\.\d+)?)/i, op: '!=' }
        ];

        for (const pattern of patterns) {
            const match = clause.match(pattern.regex);
            if (match) {
                return {
                    variable: match[1],
                    operator: pattern.op,
                    value: isNaN(Number(match[2])) ? match[2] : Number(match[2])
                };
            }
        }

        throw new Error(`Unsupported WHERE clause: ${whereClause}`);
    }

    /**
     * Evaluate a condition against a record
     */
    private evaluateCondition(record: DataRow, condition: any): boolean {
        // Find the actual column name (case-insensitive match)
        const actualColumnName = Object.keys(record).find(
            key => key.toUpperCase() === condition.variable.toUpperCase()
        );

        if (!actualColumnName) {
            console.warn(`[XPTReader] Column '${condition.variable}' not found in record`);
            return false;
        }

        const value = record[actualColumnName];
        const targetValue = condition.value;

        switch (condition.operator) {
            case '=':
                return value == targetValue;
            case '>':
                return value > targetValue;
            case '<':
                return value < targetValue;
            case '>=':
                return value >= targetValue;
            case '<=':
                return value <= targetValue;
            case '!=':
                return value != targetValue;
            default:
                return false;
        }
    }

    /**
     * Get unique values for a column
     */
    async getUniqueValues(columnName: string, includeCount: boolean = false): Promise<any[]> {
        const records = await this.readAllRecords();
        if (records.length === 0) {
            return [];
        }

        // Find the actual column name (case-insensitive match)
        const actualColumnName = Object.keys(records[0]).find(
            key => key.toUpperCase() === columnName.toUpperCase()
        );

        if (!actualColumnName) {
            console.warn(`[XPTReader] Column '${columnName}' not found`);
            return [];
        }

        const uniqueMap = new Map<any, number>();

        for (const record of records) {
            const value = record[actualColumnName];
            uniqueMap.set(value, (uniqueMap.get(value) || 0) + 1);
        }

        if (includeCount) {
            return Array.from(uniqueMap.entries()).map(([value, count]) => ({ value, count }));
        } else {
            return Array.from(uniqueMap.keys());
        }
    }

    /**
     * Get unique combinations for multiple columns
     */
    async getUniqueCombinations(columnNames: string[], includeCount: boolean = false): Promise<any[]> {
        const records = await this.readAllRecords();
        if (records.length === 0) {
            return [];
        }

        // Find actual column names (case-insensitive match)
        const actualColumnNames = columnNames.map(colName => {
            const actual = Object.keys(records[0]).find(
                key => key.toUpperCase() === colName.toUpperCase()
            );
            if (!actual) {
                console.warn(`[XPTReader] Column '${colName}' not found`);
            }
            return actual;
        }).filter(Boolean) as string[];

        if (actualColumnNames.length === 0) {
            return [];
        }

        const uniqueMap = new Map<string, any>();

        for (const record of records) {
            const values = actualColumnNames.map(col => record[col]);
            const key = JSON.stringify(values);

            if (!uniqueMap.has(key)) {
                const combination: any = {};
                actualColumnNames.forEach(col => {
                    combination[col] = record[col];
                });
                if (includeCount) {
                    combination._count = 1;
                }
                uniqueMap.set(key, combination);
            } else if (includeCount) {
                uniqueMap.get(key)._count++;
            }
        }

        return Array.from(uniqueMap.values());
    }

    /**
     * Dispose and cleanup resources
     */
    dispose(): void {
        this.allData = null;
        this.metadata = null;
    }
}
