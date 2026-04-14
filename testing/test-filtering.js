/**
 * Test WHERE clause filtering with various conditions
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function testFiltering(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING WHERE CLAUSE FILTERING V2');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get metadata
        const metadata = await reader.getMetadata();
        console.log('\n📊 Dataset Info:');
        console.log(`  Rows: ${metadata.rowCount}`);
        console.log(`  Columns: ${metadata.columnCount}`);
        console.log(`  Variables: ${metadata.variables.slice(0, 5).map(v => v.name).join(', ')}`);

        // Get all data first
        console.log('\n📖 Getting all data...');
        const allData = await reader.getData();
        console.log(`  Total rows: ${allData.length}`);

        // Test various WHERE clauses
        const testCases = [
            // Simple comparisons
            { where: "VISITNUM = 1", desc: "Simple equality" },
            { where: "VISITNUM > 5", desc: "Greater than" },
            { where: "VISITNUM >= 5", desc: "Greater than or equal" },
            { where: "VISITNUM < 3", desc: "Less than" },
            { where: "VISITNUM <= 3", desc: "Less than or equal" },
            { where: "VISITNUM != 2", desc: "Not equal" },
            { where: "VISITNUM <> 2", desc: "Not equal (alternate syntax)" },

            // String comparisons
            { where: "USUBJID = 'MOCK-001'", desc: "String equality" },
            { where: "USUBJID = \"MOCK-001\"", desc: "String with double quotes" },

            // SAS-style operators
            { where: "VISITNUM EQ 1", desc: "SAS EQ operator" },
            { where: "VISITNUM NE 2", desc: "SAS NE operator" },
            { where: "VISITNUM GT 5", desc: "SAS GT operator" },
            { where: "VISITNUM LT 3", desc: "SAS LT operator" },
            { where: "VISITNUM GE 5", desc: "SAS GE operator" },
            { where: "VISITNUM LE 3", desc: "SAS LE operator" },

            // Compound conditions
            { where: "VISITNUM > 5 AND VISITNUM < 10", desc: "AND condition" },
            { where: "VISITNUM = 1 OR VISITNUM = 10", desc: "OR condition" },
            { where: "USUBJID = 'MOCK-001' AND VISITNUM > 5", desc: "Mixed types with AND" },
        ];

        console.log('\n🔍 Testing WHERE Clauses:');
        console.log('=' * 40);

        for (const testCase of testCases) {
            try {
                const startTime = Date.now();
                const filtered = await reader.getFilteredData(testCase.where);
                const elapsed = Date.now() - startTime;

                console.log(`\n✅ ${testCase.desc}`);
                console.log(`   WHERE: ${testCase.where}`);
                console.log(`   Result: ${filtered.length} rows in ${elapsed}ms`);

                // Show sample data for first few tests
                if (testCases.indexOf(testCase) < 3 && filtered.length > 0) {
                    console.log(`   Sample: ${JSON.stringify(filtered[0])}`);
                }

            } catch (error) {
                console.log(`\n❌ ${testCase.desc}`);
                console.log(`   WHERE: ${testCase.where}`);
                console.log(`   Error: ${error.message}`);
            }
        }

        // Test caching
        console.log('\n⚡ Testing Cache Performance:');
        const cacheTest = "VISITNUM > 5";

        const start1 = Date.now();
        await reader.getFilteredData(cacheTest);
        const time1 = Date.now() - start1;
        console.log(`  First run: ${time1}ms`);

        const start2 = Date.now();
        await reader.getFilteredData(cacheTest);
        const time2 = Date.now() - start2;
        console.log(`  Second run (cached): ${time2}ms`);
        console.log(`  Cache speedup: ${(time1 / time2).toFixed(1)}x`);

        console.log('\n✅ Filtering tests complete!');

        // Cleanup
        reader.dispose();

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

// Main
async function main() {
    const testFile = process.argv[2] || 'C:/sas/Test_Ext/test.sas7bdat';
    console.log('Test file:', testFile);

    await testFiltering(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}