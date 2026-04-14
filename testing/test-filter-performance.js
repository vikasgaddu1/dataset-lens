/**
 * Comprehensive filter performance test
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');
const fs = require('fs');
const path = require('path');

// Mock reader for CSV testing with real performance data
class CSVPerformanceTestReader {
    constructor(csvPath) {
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',');

        this.columns = headers.map(name => ({ name, type: 'text' }));
        this.data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, idx) => {
                let value = values[idx];
                // Try to parse as number
                if (!isNaN(value)) {
                    row[header] = parseFloat(value);
                } else {
                    row[header] = value;
                }
            });
            this.data.push(row);
        }

        // Create EnhancedSASReader instance
        this.reader = new EnhancedSASReader('dummy.sas7bdat');
        // Override the getData method
        const originalGetData = this.reader.getData.bind(this.reader);
        this.reader.getData = async (options = {}) => {
            if (!options.whereClause) {
                return this.data.slice(options.startRow || 0, (options.startRow || 0) + (options.numRows || this.data.length));
            }

            // Use the reader's WHERE clause parser
            const parsedWhere = this.reader.parseWhereClause(options.whereClause);
            const filtered = this.data.filter(row => this.reader.evaluateConditions(row, parsedWhere));
            return filtered.slice(options.startRow || 0, (options.startRow || 0) + (options.numRows || filtered.length));
        };

        // Make evaluate methods accessible
        this.reader.evaluateConditions = this.reader.evaluateConditions.bind(this.reader);
        this.reader.parseWhereClause = this.reader.parseWhereClause.bind(this.reader);
    }

    async testPerformance() {
        console.log('\n' + '='.repeat(60));
        console.log('⚡ COMPREHENSIVE FILTER PERFORMANCE TEST');
        console.log('='.repeat(60));

        console.log(`\n📊 Dataset: ${this.data.length} rows, ${this.columns.length} columns`);
        console.log(`Columns: ${this.columns.map(c => c.name).join(', ')}`);

        // Test cases covering all operators
        const testCases = [
            // Simple numeric comparisons
            { where: "AGE > 30", desc: "Simple numeric > comparison" },
            { where: "AGE = 35", desc: "Simple numeric = comparison" },
            { where: "AGE <= 40", desc: "Simple numeric <= comparison" },
            { where: "SALARY >= 50000", desc: "Large number comparison" },

            // String comparisons
            { where: "DEPARTMENT = 'Sales'", desc: "Simple string equality" },
            { where: "CITY != 'New York'", desc: "String inequality" },

            // IN operators
            { where: "COUNTRY IN ('USA', 'CAN')", desc: "IN with 2 values" },
            { where: "COUNTRY IN ('IND', 'USA', 'GBR', 'FRA', 'GER')", desc: "IN with 5 values" },
            { where: "COUNTRY NOT IN ('USA', 'CAN')", desc: "NOT IN operator" },

            // Complex AND conditions
            { where: "AGE > 30 AND SALARY > 50000", desc: "Two numeric AND conditions" },
            { where: "AGE > 30 AND DEPARTMENT = 'Sales'", desc: "Mixed numeric/string AND" },
            { where: "AGE > 30 AND COUNTRY IN ('USA', 'CAN')", desc: "Numeric AND IN operator" },
            { where: "AGE > 30 AND SALARY > 50000 AND DEPARTMENT = 'Sales'", desc: "Three conditions with AND" },

            // OR conditions
            { where: "COUNTRY = 'USA' OR COUNTRY = 'CAN'", desc: "Simple OR condition" },
            { where: "AGE < 25 OR AGE > 50", desc: "Numeric OR condition" },
            { where: "DEPARTMENT = 'Sales' OR DEPARTMENT = 'Marketing'", desc: "String OR condition" },

            // Case insensitive tests
            { where: "country = 'usa'", desc: "Case insensitive field and value" },
            { where: "DePaRtMeNt = 'sales'", desc: "Mixed case field name" },
        ];

        console.log('\n🧪 Running Performance Tests:');
        console.log('=' .repeat(40));

        const results = [];

        for (const test of testCases) {
            // Clear cache for fresh test
            this.reader.clearCache();

            // First run (no cache)
            const start1 = Date.now();
            const filtered1 = await this.reader.getData({ whereClause: test.where });
            const time1 = Date.now() - start1;

            // Second run (with cache)
            const start2 = Date.now();
            const filtered2 = await this.reader.getData({ whereClause: test.where });
            const time2 = Date.now() - start2;

            // Pagination test
            const start3 = Date.now();
            const page1 = await this.reader.getData({
                whereClause: test.where,
                startRow: 0,
                numRows: 50
            });
            const time3 = Date.now() - start3;

            results.push({
                desc: test.desc,
                where: test.where,
                rows: filtered1.length,
                firstRun: time1,
                cachedRun: time2,
                pageRun: time3
            });

            console.log(`\n📍 ${test.desc}`);
            console.log(`   WHERE: ${test.where}`);
            console.log(`   Results: ${filtered1.length} rows`);
            console.log(`   First run: ${time1}ms`);
            console.log(`   Cached: ${time2}ms`);
            console.log(`   Page (50 rows): ${time3}ms`);
        }

        // Summary statistics
        console.log('\n' + '='.repeat(60));
        console.log('📈 PERFORMANCE SUMMARY');
        console.log('=' .repeat(60));

        const avgFirst = results.reduce((sum, r) => sum + r.firstRun, 0) / results.length;
        const avgCached = results.reduce((sum, r) => sum + r.cachedRun, 0) / results.length;
        const avgPage = results.reduce((sum, r) => sum + r.pageRun, 0) / results.length;

        console.log(`\n📊 Average Times:`);
        console.log(`   First run: ${avgFirst.toFixed(2)}ms`);
        console.log(`   Cached: ${avgCached.toFixed(2)}ms`);
        console.log(`   Pagination: ${avgPage.toFixed(2)}ms`);

        const slowest = results.sort((a, b) => b.firstRun - a.firstRun)[0];
        const fastest = results.sort((a, b) => a.firstRun - b.firstRun)[0];

        console.log(`\n⚡ Fastest filter: "${fastest.desc}" (${fastest.firstRun}ms)`);
        console.log(`🐌 Slowest filter: "${slowest.desc}" (${slowest.firstRun}ms)`);

        // Cleanup
        this.reader.dispose();
    }
}

// Main
async function main() {
    const csvPath = path.join(__dirname, 'test_data_with_country.csv');

    if (!fs.existsSync(csvPath)) {
        console.error(`CSV file not found: ${csvPath}`);
        console.log('Please run: py create-test-with-country.py first');
        return;
    }

    const tester = new CSVPerformanceTestReader(csvPath);
    await tester.testPerformance();
}

if (require.main === module) {
    main().catch(console.error);
}