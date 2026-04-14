/**
 * Enhanced SAS7BDAT Reader V2
 * Wrapper around js-stream-sas7bdat with fixes, enhancements, and better filtering
 */

import { DatasetSas7BDat } from 'js-stream-sas7bdat';
import * as path from 'path';

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

export interface UniqueValueResult {
    value: any;
    count: number;
}

export interface DataRow {
    [key: string]: any;
}

export class EnhancedSASReader {
    private dataset: any;
    private metadata: any;
    private filePath: string;
    private dataCache: any[][] | null = null;
    // Separate caches for indices and row counts for better performance
    private filterIndicesCache: Map<string, number[]> = new Map();
    private filterCountCache: Map<string, number> = new Map();
    private missingFieldsLogged: Set<string> | undefined;

    constructor(filePath: string) {
        this.filePath = filePath;
        this.dataset = new DatasetSas7BDat(filePath);
    }

    /**
     * Get enhanced metadata with proper structure
     */
    async getMetadata(): Promise<DatasetMetadata> {
        if (!this.metadata) {
            this.metadata = await this.dataset.getMetadata();
            console.log('[EnhancedSASReader] Raw metadata from js-stream-sas7bdat:', {
                keys: Object.keys(this.metadata),
                description: this.metadata.description,
                label: this.metadata.label,
                datasetLabel: this.metadata.datasetLabel,
                sasLabel: this.metadata.sasLabel,
                name: this.metadata.name,
                tableName: this.metadata.tableName,
                fileLabel: this.metadata.fileLabel
            });
        }

        return {
            rowCount: this.metadata.records || 0,
            columnCount: this.metadata.columns?.length || 0,
            variables: this.metadata.columns?.map((col: any) => ({
                name: col.name,
                label: col.label || col.name,
                type: col.dataType,
                length: col.length,
                format: col.displayFormat || col.format
            })) || [],
            encoding: this.metadata.encoding,
            createdDate: this.metadata.datasetJSONCreationDateTime ?
                new Date(this.metadata.datasetJSONCreationDateTime) : undefined,
            modifiedDate: this.metadata.dbLastModifiedDateTime ?
                new Date(this.metadata.dbLastModifiedDateTime) : undefined,
            label: this.metadata.description ||  // SAS dataset description/label
                   this.metadata.label ||
                   this.metadata.datasetLabel ||
                   this.metadata.sasLabel ||
                   this.metadata.fileLabel ||
                   this.metadata.tableName ||
                   this.metadata.name ||
                   ''  // Return empty string if no label found
        };
    }

    /**
     * Get data as array of objects with improved filtering
     */
    async getData(options?: {
        startRow?: number;
        numRows?: number;
        variables?: string[];
        whereClause?: string;
    }): Promise<DataRow[]> {
        let result: DataRow[] = [];
        const startTime = Date.now();

        // If we have a WHERE clause, use optimized cached filtering
        if (options?.whereClause) {
            console.log('[EnhancedSASReaderV2] Applying WHERE clause:', options.whereClause);

            // Get filtered indices (will use cache if available)
            const filteredIndices = await this.getFilteredIndices(options.whereClause);

            // Apply pagination to indices BEFORE converting to objects
            const startRow = options.startRow || 0;
            const numRows = options.numRows || filteredIndices.length;
            const endRow = Math.min(startRow + numRows, filteredIndices.length);
            const pageIndices = filteredIndices.slice(startRow, endRow);
            
            console.log(`[EnhancedSASReaderV2] Pagination: startRow=${options.startRow}, numRows=${options.numRows}, using: ${startRow}-${endRow} of ${filteredIndices.length} filtered rows`);

            // Now convert only the required page of data to objects
            const rawData = await this.getRawData();
            const columns = this.metadata.columns;

            for (const idx of pageIndices) {
                const row: DataRow = {};
                const rawRow = rawData[idx];
                for (let j = 0; j < columns.length; j++) {
                    row[columns[j].name] = rawRow[j];
                }
                result.push(row);
            }

            console.log(`[EnhancedSASReaderV2] Loaded page ${startRow}-${endRow} of ${filteredIndices.length} filtered rows in ${Date.now() - startTime}ms`);
        } else {
            // Get raw data first
            const rawData = await this.getRawData();

            if (!this.metadata) {
                this.metadata = await this.dataset.getMetadata();
            }

            const columns = this.metadata.columns;

            // Only convert the rows we need for pagination if no filtering
            const startRow = options?.startRow || 0;
            const numRows = options?.numRows || rawData.length;
            const endRow = Math.min(startRow + numRows, rawData.length);

            // Convert only the required rows to objects
            for (let i = startRow; i < endRow; i++) {
                const row: DataRow = {};
                for (let j = 0; j < columns.length; j++) {
                    row[columns[j].name] = rawData[i][j];
                }
                result.push(row);
            }

            // Don't need to slice again since we already limited the conversion
            if (!options?.startRow && !options?.numRows) {
                // Full data requested, no pagination needed
            } else {
                console.log(`[EnhancedSASReaderV2] Loaded rows ${startRow}-${endRow} in ${Date.now() - startTime}ms`);
            }
        }

        // Apply variable selection if needed
        if (options?.variables && options.variables.length > 0) {
            result = result.map(row => {
                const filteredRow: DataRow = {};
                options.variables!.forEach(varName => {
                    if (varName in row) {
                        filteredRow[varName] = row[varName];
                    }
                });
                return filteredRow;
            });
        }

        // Pagination is already handled above for filtered results, so skip this

        return result;
    }

    /**
     * Get raw data (array of arrays) for performance
     */
    async getRawData(): Promise<any[][]> {
        if (!this.dataCache) {
            this.dataCache = await this.dataset.getData({ filterColumns: [] });
        }
        return this.dataCache || [];
    }

    /**
     * Get unique values for a single column (FIXED)
     */
    async getUniqueValues(
        columnName: string,
        includeCount: boolean = false
    ): Promise<any[] | UniqueValueResult[]> {

        if (!this.metadata) {
            this.metadata = await this.dataset.getMetadata();
        }

        // Find column index
        const colIndex = this.metadata.columns.findIndex(
            (col: any) => col.name === columnName
        );

        if (colIndex === -1) {
            throw new Error(`Column '${columnName}' not found`);
        }

        // Get data
        const data = await this.getRawData();

        if (includeCount) {
            // Count occurrences
            const countMap = new Map<any, number>();
            for (const row of data) {
                const value = row[colIndex];
                countMap.set(value, (countMap.get(value) || 0) + 1);
            }

            // Convert to array with counts
            return Array.from(countMap.entries()).map(([value, count]) => ({
                value,
                count
            }));
        } else {
            // Just unique values
            const uniqueSet = new Set(data.map(row => row[colIndex]));
            return Array.from(uniqueSet);
        }
    }

    /**
     * Get unique combinations for multiple columns (NODUPKEY equivalent)
     */
    async getUniqueCombinations(
        columnNames: string[],
        includeCount: boolean = false
    ): Promise<any[][]> {

        if (!this.metadata) {
            this.metadata = await this.dataset.getMetadata();
        }

        // Find column indices
        const indices = columnNames.map(name => {
            const idx = this.metadata.columns.findIndex(
                (col: any) => col.name === name
            );
            if (idx === -1) {
                throw new Error(`Column '${name}' not found`);
            }
            return idx;
        });

        // Get data
        const data = await this.getRawData();

        if (includeCount) {
            // Count occurrences of combinations
            const countMap = new Map<string, { values: any[], count: number }>();

            for (const row of data) {
                const values = indices.map(i => row[i]);
                const key = JSON.stringify(values);

                if (countMap.has(key)) {
                    countMap.get(key)!.count++;
                } else {
                    countMap.set(key, { values, count: 1 });
                }
            }

            // Return with column names and counts
            const result = Array.from(countMap.values()).map(item => {
                const row: any = {};
                columnNames.forEach((name, i) => {
                    row[name] = item.values[i];
                });
                row['_count'] = item.count;
                return row;
            });

            return result;
        } else {
            // Just unique combinations
            const uniqueSet = new Set<string>();
            const uniqueValues: any[][] = [];

            for (const row of data) {
                const values = indices.map(i => row[i]);
                const key = JSON.stringify(values);

                if (!uniqueSet.has(key)) {
                    uniqueSet.add(key);
                    uniqueValues.push(values);
                }
            }

            return uniqueValues;
        }
    }

    /**
     * Optimized filtering that returns indices of matching rows with caching
     */
    private async getFilteredIndices(whereClause: string, maxRows?: number): Promise<number[]> {
        // Check cache first
        if (this.filterIndicesCache.has(whereClause) && !maxRows) {
            console.log('[EnhancedSASReaderV2] Using cached filter indices');
            return this.filterIndicesCache.get(whereClause)!;
        }

        const startTime = Date.now();
        const rawData = await this.getRawData();

        if (!this.metadata) {
            this.metadata = await this.dataset.getMetadata();
        }

        const columns = this.metadata.columns;
        const conditions = this.parseWhereClause(whereClause);
        const matchingIndices: number[] = [];

        // Extract field names from conditions for optimization
        const requiredFields = this.extractFieldsFromConditions(conditions);
        console.log(`[EnhancedSASReaderV2] Required fields for filtering: ${requiredFields.join(', ')}`);

        // Build index map for quick field lookup
        const fieldIndexMap = new Map<string, number>();
        columns.forEach((col: any, index: number) => {
            const colName = col.name;
            const colNameUpper = colName.toUpperCase();

            // Only add to map if field is required for filtering
            if (requiredFields.some(field => field.toUpperCase() === colNameUpper)) {
                fieldIndexMap.set(colName, index);
                fieldIndexMap.set(colNameUpper, index);
            }
        });

        // Filter raw data and collect indices only
        for (let i = 0; i < rawData.length; i++) {
            if (this.evaluateConditionsOptimized(rawData[i], conditions, fieldIndexMap, columns)) {
                matchingIndices.push(i);

                // Early termination if we have enough rows
                if (maxRows && matchingIndices.length >= maxRows) {
                    break;
                }
            }
        }

        console.log(`[EnhancedSASReaderV2] Found ${matchingIndices.length} matching rows in ${Date.now() - startTime}ms`);
        
        // Cache the results if not using maxRows (full filter)
        if (!maxRows) {
            this.filterIndicesCache.set(whereClause, matchingIndices);
            this.filterCountCache.set(whereClause, matchingIndices.length);
        }
        
        return matchingIndices;
    }

    /**
     * Optimized filtering that works directly with raw data
     */
    private async getFilteredDataOptimized(whereClause: string): Promise<DataRow[]> {
        const indices = await this.getFilteredIndices(whereClause);
        const rawData = await this.getRawData();
        const columns = this.metadata.columns;
        const result: DataRow[] = [];

        // Convert only matching rows to objects
        for (const idx of indices) {
            const row: DataRow = {};
            const rawRow = rawData[idx];
            for (let j = 0; j < columns.length; j++) {
                row[columns[j].name] = rawRow[j];
            }
            result.push(row);
        }

        return result;
    }

    /**
     * Extract field names from conditions for optimization
     */
    private extractFieldsFromConditions(conditions: any): string[] {
        const fields: string[] = [];

        if (!conditions) return fields;

        if (conditions.type === 'AND' || conditions.type === 'OR') {
            for (const cond of conditions.conditions) {
                if (cond && cond.field) {
                    fields.push(cond.field);
                }
            }
        } else if (conditions.field) {
            fields.push(conditions.field);
        }

        return fields;
    }

    /**
     * Optimized condition evaluation working directly with raw row data
     */
    private evaluateConditionsOptimized(
        rawRow: any[],
        conditions: any,
        fieldIndexMap: Map<string, number>,
        columns: any[]
    ): boolean {
        if (!conditions) return true;

        // Handle compound conditions
        if (conditions.type === 'AND') {
            return conditions.conditions.every((cond: any) =>
                this.evaluateSingleConditionOptimized(rawRow, cond, fieldIndexMap, columns));
        }

        if (conditions.type === 'OR') {
            return conditions.conditions.some((cond: any) =>
                this.evaluateSingleConditionOptimized(rawRow, cond, fieldIndexMap, columns));
        }

        // Single condition
        return this.evaluateSingleConditionOptimized(rawRow, conditions, fieldIndexMap, columns);
    }

    /**
     * Optimized single condition evaluation
     */
    private evaluateSingleConditionOptimized(
        rawRow: any[],
        condition: any,
        fieldIndexMap: Map<string, number>,
        columns: any[]
    ): boolean {
        if (!condition || !condition.field) return true;

        const { field, operator } = condition;

        // Find field index
        let fieldIndex = fieldIndexMap.get(field);
        if (fieldIndex === undefined) {
            fieldIndex = fieldIndexMap.get(field.toUpperCase());
        }

        if (fieldIndex === undefined) {
            // Field not found - only log once
            if (!this.missingFieldsLogged) {
                this.missingFieldsLogged = new Set<string>();
            }
            if (!this.missingFieldsLogged.has(field)) {
                const availableFields = Array.from(fieldIndexMap.keys())
                    .filter(k => !k.includes(k.toUpperCase()))
                    .join(', ');
                console.log(`[EnhancedSASReaderV2] Field '${field}' not found. Available: ${availableFields}`);
                this.missingFieldsLogged.add(field);
            }
            return false;
        }

        const fieldValue = rawRow[fieldIndex];

        // Handle null/undefined
        if (fieldValue === null || fieldValue === undefined) {
            return false;
        }

        // Handle IN and NOT IN operators
        if (operator === 'IN' && condition.values) {
            // Use pre-computed lowercase values for faster comparison
            if (typeof fieldValue === 'string' && condition.valuesLower) {
                const fieldValueLower = fieldValue.toLowerCase();
                return condition.valuesLower.includes(fieldValueLower);
            }
            // For numbers, direct comparison
            return condition.values.includes(fieldValue);
        }

        if (operator === 'NOT IN' && condition.values) {
            // Use pre-computed lowercase values for faster comparison
            if (typeof fieldValue === 'string' && condition.valuesLower) {
                const fieldValueLower = fieldValue.toLowerCase();
                return !condition.valuesLower.includes(fieldValueLower);
            }
            // For numbers, direct comparison
            return !condition.values.includes(fieldValue);
        }

        // Regular operators
        const { value } = condition;
        const compareValue = typeof value === 'string' && typeof fieldValue === 'string' ?
            value.toLowerCase() : value;
        const compareFieldValue = typeof fieldValue === 'string' ?
            fieldValue.toLowerCase() : fieldValue;

        switch (operator) {
            case '=':
            case '==':
                return compareFieldValue == compareValue;
            case '!=':
            case '<>':
                return compareFieldValue != compareValue;
            case '>':
                return fieldValue > value;
            case '<':
                return fieldValue < value;
            case '>=':
                return fieldValue >= value;
            case '<=':
                return fieldValue <= value;
            default:
                return true;
        }
    }

    /**
     * Internal method for filtered data with better WHERE clause parsing
     * @deprecated Use getFilteredDataOptimized instead
     */
    private async getFilteredDataInternal(whereClause: string): Promise<DataRow[]> {
        return this.getFilteredDataOptimized(whereClause);
    }

    /**
     * Parse WHERE clause into conditions (supports AND/OR)
     */
    private parseWhereClause(where: string): any {
        // Handle AND/OR conditions
        const upperWhere = where.toUpperCase();

        // Check for AND
        if (upperWhere.includes(' AND ')) {
            const parts = where.split(/\s+AND\s+/i);
            return {
                type: 'AND',
                conditions: parts.map(part => this.parseSimpleCondition(part))
            };
        }

        // Check for OR
        if (upperWhere.includes(' OR ')) {
            const parts = where.split(/\s+OR\s+/i);
            return {
                type: 'OR',
                conditions: parts.map(part => this.parseSimpleCondition(part))
            };
        }

        // Simple condition
        return this.parseSimpleCondition(where);
    }

    /**
     * Parse a simple condition (no AND/OR)
     */
    private parseSimpleCondition(condition: string): any {
        // Check for NOT IN operator first (must come before IN check)
        const notInMatch = condition.match(/(\w+)\s+NOT\s+IN\s*\(([^)]+)\)/i);
        if (notInMatch) {
            const field = notInMatch[1].trim();
            const valuesList = notInMatch[2];

            // Parse the list of values and pre-process for faster comparison
            const values = valuesList
                .split(',')
                .map(v => this.parseValue(v.trim()));

            // Pre-compute lowercase versions for strings
            const valuesLower = values.map(v =>
                typeof v === 'string' ? v.toLowerCase() : v
            );

            return { field, operator: 'NOT IN', values, valuesLower };
        }

        // Check for IN operator (e.g., COUNTRY IN ('USA','CAN'))
        const inMatch = condition.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
        if (inMatch) {
            const field = inMatch[1].trim();
            const valuesList = inMatch[2];

            // Parse the list of values and pre-process for faster comparison
            const values = valuesList
                .split(',')
                .map(v => this.parseValue(v.trim()));

            // Pre-compute lowercase versions for strings
            const valuesLower = values.map(v =>
                typeof v === 'string' ? v.toLowerCase() : v
            );

            return { field, operator: 'IN', values, valuesLower };
        }

        // Handle different operators
        const operators = ['<=', '>=', '<>', '!=', '=', '<', '>'];

        for (const op of operators) {
            if (condition.includes(op)) {
                const parts = condition.split(op);
                if (parts.length === 2) {
                    const field = parts[0].trim();
                    const value = this.parseValue(parts[1].trim());
                    return { field, operator: op, value };
                }
            }
        }

        // Handle SAS-style operators (EQ, NE, GT, LT, GE, LE)
        const sasOperators = {
            ' EQ ': '=',
            ' NE ': '!=',
            ' GT ': '>',
            ' LT ': '<',
            ' GE ': '>=',
            ' LE ': '<='
        };

        for (const [sasOp, standardOp] of Object.entries(sasOperators)) {
            const upperCondition = condition.toUpperCase();
            if (upperCondition.includes(sasOp)) {
                const regex = new RegExp(sasOp, 'i');
                const parts = condition.split(regex);
                if (parts.length === 2) {
                    const field = parts[0].trim();
                    const value = this.parseValue(parts[1].trim());
                    return { field, operator: standardOp, value };
                }
            }
        }

        return null;
    }

    /**
     * Parse value (string or number)
     */
    private parseValue(value: string): any {
        // Remove surrounding spaces
        value = value.trim();

        // Check for quoted strings
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
            return value.slice(1, -1);
        }

        // Try to parse as number
        const num = Number(value);
        return isNaN(num) ? value : num;
    }

    /**
     * Evaluate conditions (handles AND/OR)
     */
    private evaluateConditions(row: DataRow, conditions: any): boolean {
        if (!conditions) return true;

        // Handle compound conditions
        if (conditions.type === 'AND') {
            return conditions.conditions.every((cond: any) =>
                this.evaluateSingleCondition(row, cond));
        }

        if (conditions.type === 'OR') {
            return conditions.conditions.some((cond: any) =>
                this.evaluateSingleCondition(row, cond));
        }

        // Single condition
        return this.evaluateSingleCondition(row, conditions);
    }

    /**
     * Evaluate a single condition
     */
    private evaluateSingleCondition(row: DataRow, condition: any): boolean {
        if (!condition || !condition.field) return true;

        const { field, operator, value } = condition;

        // Case-insensitive field name matching (SAS-style)
        let fieldValue: any;
        let fieldFound = false;

        // Try exact match first
        if (field in row) {
            fieldValue = row[field];
            fieldFound = true;
        } else {
            // Try case-insensitive match
            const upperField = field.toUpperCase();
            for (const key in row) {
                if (key.toUpperCase() === upperField) {
                    fieldValue = row[key];
                    fieldFound = true;
                    break;
                }
            }
        }

        // Handle field not found
        if (!fieldFound) {
            // Only log once per unique field name to avoid spam
            if (!this.missingFieldsLogged) {
                this.missingFieldsLogged = new Set<string>();
            }
            if (!this.missingFieldsLogged.has(field)) {
                console.log(`[EnhancedSASReaderV2] Field '${field}' not found in dataset. Available fields: ${Object.keys(row).join(', ')}`);
                this.missingFieldsLogged.add(field);
            }
            return false;
        }

        // Handle null/undefined values
        if (fieldValue === null || fieldValue === undefined) {
            return false;
        }

        // Handle IN and NOT IN operators
        if (operator === 'IN' && condition.values) {
            // Use pre-computed lowercase values for faster comparison
            if (typeof fieldValue === 'string' && condition.valuesLower) {
                const fieldValueLower = fieldValue.toLowerCase();
                return condition.valuesLower.includes(fieldValueLower);
            }
            // For numbers, direct comparison
            return condition.values.includes(fieldValue);
        }

        if (operator === 'NOT IN' && condition.values) {
            // Use pre-computed lowercase values for faster comparison
            if (typeof fieldValue === 'string' && condition.valuesLower) {
                const fieldValueLower = fieldValue.toLowerCase();
                return !condition.valuesLower.includes(fieldValueLower);
            }
            // For numbers, direct comparison
            return !condition.values.includes(fieldValue);
        }

        // Case-insensitive comparison for strings
        const compareValue = typeof value === 'string' && typeof fieldValue === 'string' ?
            value.toLowerCase() : value;
        const compareFieldValue = typeof fieldValue === 'string' ?
            fieldValue.toLowerCase() : fieldValue;

        switch (operator) {
            case '=':
            case '==':
                return compareFieldValue == compareValue;
            case '!=':
            case '<>':
                return compareFieldValue != compareValue;
            case '>':
                return fieldValue > value;
            case '<':
                return fieldValue < value;
            case '>=':
                return fieldValue >= value;
            case '<=':
                return fieldValue <= value;
            default:
                return true;
        }
    }

    /**
     * Apply WHERE clause filtering (improved version)
     */
    async getFilteredData(whereClause: string): Promise<DataRow[]> {
        return await this.getData({ whereClause });
    }

    /**
     * Get the count of rows that match a WHERE clause without loading the actual data
     * This is much faster than loading data just to count rows
     */
    async getFilteredRowCount(whereClause: string): Promise<number> {
        if (!whereClause || whereClause.trim() === '') {
            // No filter, return total row count
            const metadata = await this.getMetadata();
            return metadata.rowCount;
        }

        // Check cache first
        if (this.filterCountCache.has(whereClause)) {
            console.log('[EnhancedSASReaderV2] Using cached filter count');
            return this.filterCountCache.get(whereClause)!;
        }

        // Get filtered indices (will populate cache)
        const filteredIndices = await this.getFilteredIndices(whereClause);
        return filteredIndices.length;
    }

    /**
     * Get column info for UI display
     */
    async getColumnInfo(columnName: string): Promise<{
        name: string;
        type: string;
        uniqueCount: number;
        sampleValues: any[];
        isNumeric: boolean;
        isCategorical: boolean;
    }> {
        const metadata = await this.getMetadata();
        const variable = metadata.variables.find(v => v.name === columnName);

        if (!variable) {
            throw new Error(`Column '${columnName}' not found`);
        }

        const uniqueValues = await this.getUniqueValues(columnName);
        const isNumeric = variable.type === 'double' || variable.type === 'float' || variable.type === 'integer';

        // Consider categorical if string or if numeric with few unique values
        const isCategorical = !isNumeric || (isNumeric && uniqueValues.length < 20);

        return {
            name: columnName,
            type: variable.type,
            uniqueCount: uniqueValues.length,
            sampleValues: uniqueValues.slice(0, 10),
            isNumeric,
            isCategorical
        };
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.dataCache = null;
        this.filterIndicesCache.clear();
        this.filterCountCache.clear();
        console.log('[EnhancedSASReaderV2] Cache cleared');
    }

    /**
     * Close and cleanup
     */
    dispose(): void {
        this.clearCache();
        this.metadata = null;
    }
}