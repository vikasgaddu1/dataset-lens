/**
 * Test performance of WHERE clause filtering
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function testPerformance(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('⚡ PERFORMANCE TEST - WHERE CLAUSE FILTERING');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get metadata
        const metadata = await reader.getMetadata();
        console.log('\n📊 Dataset Info:');
        console.log(`  Total rows: ${metadata.rowCount}`);
        console.log(`  Total columns: ${metadata.columnCount}`);

        // Test cases with timing
        const testCases = [
            { where: "AGE > 30", desc: "Simple numeric filter (AGE > 30)" },
            { where: "AGE > 30 AND VISITNUM < 5", desc: "Compound AND filter" },
            { where: "COUNTRY = 'USA' OR COUNTRY = 'CAN'", desc: "OR condition with strings" },
            { where: "COUNTRY IN ('USA', 'CAN')", desc: "IN operator with strings" },
            { where: "COUNTRY IN ('IND', 'USA', 'GBR')", desc: "IN operator with multiple values" },
            { where: "COUNTRY NOT IN ('USA', 'CAN')", desc: "NOT IN operator" },
            { where: "AGE > 30 AND COUNTRY IN ('USA', 'CAN')", desc: "Combined filter with IN" },
            { where: "AGE > 50 AND SALARY > 50000 AND DEPARTMENT = 'Sales'", desc: "Complex multi-condition" },
        ];

        console.log('\n🧪 Testing Filter Performance:');
        console.log('=' .repeat(40));

        for (const test of testCases) {
            console.log(`\n📍 ${test.desc}`);
            console.log(`   WHERE: ${test.where}`);

            // Clear cache for fresh test
            reader.clearCache();

            // First run (no cache)
            let start = Date.now();
            let filtered = await reader.getFilteredData(test.where);
            let time1 = Date.now() - start;
            console.log(`   First run: ${filtered.length} rows in ${time1}ms`);

            // Second run (with cache)
            start = Date.now();
            filtered = await reader.getFilteredData(test.where);
            let time2 = Date.now() - start;
            console.log(`   Cached run: ${filtered.length} rows in ${time2}ms`);

            // Test pagination with filtered data
            console.log(`\n   Testing pagination with filtered data:`);
            reader.clearCache();

            // Page 1
            start = Date.now();
            const page1 = await reader.getData({
                whereClause: test.where,
                startRow: 0,
                numRows: 100
            });
            const pageTime1 = Date.now() - start;
            console.log(`   Page 1 (0-100): ${page1.length} rows in ${pageTime1}ms`);

            // Page 2 (should use cache)
            start = Date.now();
            const page2 = await reader.getData({
                whereClause: test.where,
                startRow: 100,
                numRows: 100
            });
            const pageTime2 = Date.now() - start;
            console.log(`   Page 2 (100-200): ${page2.length} rows in ${pageTime2}ms`);
        }

        // Test pagination without filtering
        console.log('\n📍 Pagination without WHERE clause:');
        reader.clearCache();

        let start = Date.now();
        const page1NoFilter = await reader.getData({
            startRow: 0,
            numRows: 100
        });
        console.log(`   Page 1: ${page1NoFilter.length} rows in ${Date.now() - start}ms`);

        start = Date.now();
        const page2NoFilter = await reader.getData({
            startRow: 100,
            numRows: 100
        });
        console.log(`   Page 2: ${page2NoFilter.length} rows in ${Date.now() - start}ms`);

        start = Date.now();
        const page10NoFilter = await reader.getData({
            startRow: 900,
            numRows: 100
        });
        console.log(`   Page 10: ${page10NoFilter.length} rows in ${Date.now() - start}ms`);

        console.log('\n✅ Performance tests complete!');

        // Cleanup
        reader.dispose();

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

// Main
async function main() {
    const testFile = process.argv[2] || 'C:/sas/Test_Ext/big_test_dataset.sas7bdat';
    console.log('Test file:', testFile);

    await testPerformance(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}