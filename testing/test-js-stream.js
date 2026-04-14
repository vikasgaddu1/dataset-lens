"use strict";
/**
 * Test file for js-stream-sas7bdat library
 * Testing metadata extraction, data reading, and unique values functionality
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAS7BDATTester = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Try to import js-stream-sas7bdat
let SAS7BDAT;
try {
    const module = require('js-stream-sas7bdat');
    SAS7BDAT = module.DatasetSas7BDat || module.default || module;
    console.log('✅ js-stream-sas7bdat loaded successfully');
    console.log('  Module structure:', Object.keys(module));
}
catch (error) {
    console.error('❌ Failed to load js-stream-sas7bdat:', error);
    process.exit(1);
}
class SAS7BDATTester {
    constructor(filePath) {
        this.filePath = filePath;
        this.results = {
            metadata: null,
            sampleData: [],
            uniqueValues: null,
            multiVariableUnique: null,
            performance: {
                metadataTime: 0,
                dataReadTime: 0,
                uniqueValueTime: 0
            }
        };
    }
    async initialize() {
        try {
            console.log(`\n📂 Initializing reader for: ${path.basename(this.filePath)}`);
            this.reader = new SAS7BDAT(this.filePath);
            console.log('✅ Reader initialized');
        }
        catch (error) {
            console.error('❌ Failed to initialize reader:', error);
            throw error;
        }
    }
    async testMetadata() {
        console.log('\n📊 Testing Metadata Extraction...');
        const startTime = Date.now();
        try {
            // Test if getMetadata exists
            if (typeof this.reader.getMetadata === 'function') {
                this.results.metadata = await this.reader.getMetadata();
                this.results.performance.metadataTime = Date.now() - startTime;
                console.log('✅ Metadata extracted successfully');
                console.log('\n📋 Metadata Overview:');
                // Check what metadata is available
                const meta = this.results.metadata;
                console.log(`  - Rows: ${meta.rowCount || meta.rows || meta.number_rows || 'Not available'}`);
                console.log(`  - Columns: ${meta.columnCount || meta.columns || meta.number_columns || 'Not available'}`);
                console.log(`  - Encoding: ${meta.encoding || meta.file_encoding || 'Not available'}`);
                // Check for variable information
                if (meta.variables || meta.columns || meta.column_names) {
                    const vars = meta.variables || meta.columns || meta.column_names;
                    console.log(`  - Variables: ${Array.isArray(vars) ? vars.length : 'Structure unclear'}`);
                    // Sample first variable to check structure
                    if (Array.isArray(vars) && vars.length > 0) {
                        console.log('\n  📌 First Variable Structure:');
                        const firstVar = vars[0];
                        console.log('    ', JSON.stringify(firstVar, null, 2).split('\n').join('\n    '));
                    }
                }
                // Check for variable labels
                if (meta.column_labels || meta.variable_labels) {
                    console.log('  ✅ Variable labels found!');
                }
                else {
                    console.log('  ⚠️ Variable labels not found');
                }
                // Check for variable formats
                if (meta.column_formats || meta.variable_formats || meta.original_variable_types) {
                    console.log('  ✅ Variable formats found!');
                }
                else {
                    console.log('  ⚠️ Variable formats not found');
                }
                // Check for dataset label
                if (meta.dataset_label || meta.table_name || meta.label) {
                    console.log(`  ✅ Dataset label: ${meta.dataset_label || meta.table_name || meta.label}`);
                }
                else {
                    console.log('  ⚠️ Dataset label not found');
                }
            }
            else {
                console.log('⚠️ getMetadata method not found');
                // Try alternative metadata access
                if (this.reader.metadata) {
                    this.results.metadata = this.reader.metadata;
                    console.log('✅ Found metadata property directly');
                }
            }
        }
        catch (error) {
            console.error('❌ Metadata extraction failed:', error);
        }
    }
    async testDataReading() {
        console.log('\n📖 Testing Data Reading...');
        const startTime = Date.now();
        try {
            // Test different reading methods
            // Method 1: Using async iterator if available
            if (typeof this.reader[Symbol.asyncIterator] === 'function') {
                console.log('  Testing async iterator...');
                let count = 0;
                for await (const row of this.reader) {
                    if (count < 5) {
                        this.results.sampleData.push(row);
                    }
                    count++;
                    if (count >= 10)
                        break; // Read first 10 rows
                }
                console.log(`  ✅ Read ${count} rows using async iterator`);
            }
            // Method 2: Using read method if available
            else if (typeof this.reader.read === 'function') {
                console.log('  Testing read method...');
                const data = await this.reader.read({
                    start: 0,
                    length: 10
                });
                this.results.sampleData = data.slice(0, 5);
                console.log(`  ✅ Read ${data.length} rows using read method`);
            }
            // Method 3: Using stream if available
            else if (typeof this.reader.stream === 'function') {
                console.log('  Testing stream method...');
                const stream = this.reader.stream();
                // Handle stream...
            }
            this.results.performance.dataReadTime = Date.now() - startTime;
            if (this.results.sampleData.length > 0) {
                console.log('\n  📌 First Row Structure:');
                console.log('    ', JSON.stringify(this.results.sampleData[0], null, 2).split('\n').join('\n    '));
            }
        }
        catch (error) {
            console.error('❌ Data reading failed:', error);
        }
    }
    async testUniqueValues() {
        console.log('\n🔍 Testing Unique Values Extraction...');
        const startTime = Date.now();
        try {
            // Check if getUniqueValues method exists
            if (typeof this.reader.getUniqueValues === 'function') {
                // Get column names from metadata
                const meta = this.results.metadata;
                let columnNames = [];
                if (meta?.variables && Array.isArray(meta.variables)) {
                    columnNames = meta.variables.map((v) => v.name || v);
                }
                else if (meta?.column_names && Array.isArray(meta.column_names)) {
                    columnNames = meta.column_names;
                }
                if (columnNames.length > 0) {
                    // Test single variable unique values
                    const firstColumn = columnNames[0];
                    console.log(`  Testing unique values for: ${firstColumn}`);
                    this.results.uniqueValues = await this.reader.getUniqueValues({
                        column: firstColumn,
                        includeCount: true
                    });
                    console.log(`  ✅ Found ${this.results.uniqueValues?.length || 0} unique values`);
                    // Show sample unique values
                    if (this.results.uniqueValues && this.results.uniqueValues.length > 0) {
                        console.log('  📌 Sample unique values:');
                        const sample = this.results.uniqueValues.slice(0, 5);
                        sample.forEach((val) => {
                            console.log(`    - ${JSON.stringify(val)}`);
                        });
                    }
                    // Test multi-variable unique combinations if we have multiple columns
                    if (columnNames.length > 1) {
                        console.log(`\n  Testing multi-variable unique combinations...`);
                        const testColumns = columnNames.slice(0, 2); // First two columns
                        console.log(`  Columns: ${testColumns.join(', ')}`);
                        this.results.multiVariableUnique = await this.reader.getUniqueValues({
                            columns: testColumns,
                            includeCount: true
                        });
                        console.log(`  ✅ Found ${this.results.multiVariableUnique?.length || 0} unique combinations`);
                    }
                }
            }
            else {
                console.log('  ⚠️ getUniqueValues method not found');
                // Try alternative approach
                console.log('  Attempting manual unique value extraction...');
                // Could implement manual unique value extraction from sample data
            }
            this.results.performance.uniqueValueTime = Date.now() - startTime;
        }
        catch (error) {
            console.error('❌ Unique values extraction failed:', error);
        }
    }
    async runAllTests() {
        console.log('='
            .repeat(60));
        console.log('🧪 JS-STREAM-SAS7BDAT TEST SUITE');
        console.log('='.repeat(60));
        await this.initialize();
        await this.testMetadata();
        await this.testDataReading();
        await this.testUniqueValues();
        this.printSummary();
    }
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log('\n✅ Features Available:');
        if (this.results.metadata)
            console.log('  - Metadata extraction');
        if (this.results.sampleData.length > 0)
            console.log('  - Data reading');
        if (this.results.uniqueValues)
            console.log('  - Single variable unique values');
        if (this.results.multiVariableUnique)
            console.log('  - Multi-variable unique combinations');
        console.log('\n⏱️ Performance:');
        console.log(`  - Metadata extraction: ${this.results.performance.metadataTime}ms`);
        console.log(`  - Data reading (10 rows): ${this.results.performance.dataReadTime}ms`);
        console.log(`  - Unique values: ${this.results.performance.uniqueValueTime}ms`);
        console.log('\n📝 Recommendations:');
        const hasLabels = this.results.metadata?.column_labels || this.results.metadata?.variable_labels;
        const hasFormats = this.results.metadata?.column_formats || this.results.metadata?.variable_formats;
        const hasUnique = this.results.uniqueValues || this.results.multiVariableUnique;
        if (hasLabels && hasFormats && hasUnique) {
            console.log('  ✅ Library provides all required features!');
            console.log('  → Ready for migration from Python');
        }
        else {
            console.log('  ⚠️ Missing features:');
            if (!hasLabels)
                console.log('    - Variable labels');
            if (!hasFormats)
                console.log('    - Variable formats');
            if (!hasUnique)
                console.log('    - Unique value extraction');
            console.log('  → May need enhancement or hybrid approach');
        }
    }
}
exports.SAS7BDATTester = SAS7BDATTester;
// Main execution
async function main() {
    // Check for test file argument
    const args = process.argv.slice(2);
    let testFile = args[0];
    if (!testFile) {
        // Try to find a sample SAS file
        const possiblePaths = [
            'C:/sas/Test_Ext/ae.sas7bdat',
            'C:/sas/Test_Ext/test.sas7bdat',
            '../data/sample.sas7bdat',
            './sample.sas7bdat'
        ];
        for (const path of possiblePaths) {
            if (fs.existsSync(path)) {
                testFile = path;
                console.log(`📁 Using test file: ${path}`);
                break;
            }
        }
        if (!testFile) {
            console.error('❌ No SAS7BDAT file found. Please provide a file path as argument.');
            console.log('Usage: node test-js-stream.js <path-to-sas7bdat-file>');
            process.exit(1);
        }
    }
    // Run tests
    const tester = new SAS7BDATTester(testFile);
    await tester.runAllTests();
}
// Run if executed directly
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=test-js-stream.js.map