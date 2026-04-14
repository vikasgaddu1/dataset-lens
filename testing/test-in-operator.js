/**
 * Test IN operator functionality with CSV data
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');
const fs = require('fs');
const path = require('path');

// Mock SAS reader for CSV testing
class CSVTestReader {
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

        // Create EnhancedSASReader instance and patch it
        this.reader = new EnhancedSASReader('dummy.sas7bdat');
        // Override the getData method to return our CSV data
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

    async testINOperator() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 TESTING IN OPERATOR FUNCTIONALITY');
        console.log('='.repeat(60));

        console.log(`\nTotal rows in dataset: ${this.data.length}`);
        console.log(`Columns: ${this.columns.map(c => c.name).join(', ')}`);

        // Test cases
        const testCases = [
            {
                where: "COUNTRY IN ('USA', 'CAN')",
                desc: "IN operator with 2 values",
                expected: this.data.filter(r => ['USA', 'CAN'].includes(r.COUNTRY)).length
            },
            {
                where: "COUNTRY IN ('IND', 'USA', 'GBR')",
                desc: "IN operator with 3 values",
                expected: this.data.filter(r => ['IND', 'USA', 'GBR'].includes(r.COUNTRY)).length
            },
            {
                where: "COUNTRY NOT IN ('USA', 'CAN')",
                desc: "NOT IN operator",
                expected: this.data.filter(r => !['USA', 'CAN'].includes(r.COUNTRY)).length
            },
            {
                where: "AGE > 30 AND COUNTRY IN ('USA', 'CAN')",
                desc: "Combined condition with IN",
                expected: this.data.filter(r => r.AGE > 30 && ['USA', 'CAN'].includes(r.COUNTRY)).length
            },
            {
                where: "country in ('usa', 'can')",
                desc: "Case insensitive field and values",
                expected: this.data.filter(r => ['USA', 'CAN'].includes(r.COUNTRY)).length
            }
        ];

        console.log('\n📊 Testing IN operator WHERE clauses:');
        console.log('=' .repeat(40));

        let allPassed = true;

        for (const test of testCases) {
            console.log(`\n✅ ${test.desc}`);
            console.log(`   WHERE: ${test.where}`);

            try {
                const start = Date.now();
                const filtered = await this.reader.getData({ whereClause: test.where });
                const time = Date.now() - start;

                console.log(`   Result: ${filtered.length} rows (expected: ${test.expected}) in ${time}ms`);

                if (filtered.length === test.expected) {
                    console.log(`   ✅ PASSED`);
                } else {
                    console.log(`   ❌ FAILED - Expected ${test.expected}, got ${filtered.length}`);
                    allPassed = false;
                    // Show first few results for debugging
                    if (filtered.length > 0) {
                        console.log(`   Sample results:`);
                        filtered.slice(0, 3).forEach(row => {
                            console.log(`     - ${row.NAME}: COUNTRY=${row.COUNTRY}, AGE=${row.AGE}`);
                        });
                    }
                }
            } catch (error) {
                console.log(`   ❌ ERROR: ${error.message}`);
                allPassed = false;
            }
        }

        console.log('\n' + '='.repeat(60));
        if (allPassed) {
            console.log('✅ ALL TESTS PASSED!');
        } else {
            console.log('❌ SOME TESTS FAILED');
        }

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

    const tester = new CSVTestReader(csvPath);
    await tester.testINOperator();
}

if (require.main === module) {
    main().catch(console.error);
}