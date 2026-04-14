/**
 * Test simple WHERE clause filtering with actual data
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function testSimpleFiltering(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING SIMPLE WHERE CLAUSE FILTERING');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get metadata
        const metadata = await reader.getMetadata();
        console.log('\n📊 Dataset Info:');
        console.log(`  Rows: ${metadata.rowCount}`);
        console.log(`  Columns: ${metadata.columnCount}`);
        console.log(`  Variables: ${metadata.variables.map(v => `${v.name} (${v.type})`).join(', ')}`);

        // Get all data first to see what we're working with
        console.log('\n📖 Getting all data to examine structure...');
        const allData = await reader.getData();
        console.log(`  Total rows: ${allData.length}`);

        if (allData.length > 0) {
            console.log('\n📋 Sample data:');
            allData.forEach((row, i) => {
                console.log(`  Row ${i + 1}:`, row);
            });
        }

        // Test filtering based on actual columns
        const testCases = [];

        // Check if we have a 'num' column
        if (metadata.variables.some(v => v.name === 'num')) {
            testCases.push(
                { where: "num = 1", desc: "Filter num = 1" },
                { where: "num > 0", desc: "Filter num > 0" },
                { where: "num != 2", desc: "Filter num != 2" }
            );
        }

        // Check if we have a 'name' column
        if (metadata.variables.some(v => v.name === 'name')) {
            testCases.push(
                { where: "name = 'Alice'", desc: "Filter by name" },
                { where: "name != 'Bob'", desc: "Filter name not Bob" }
            );
        }

        if (testCases.length > 0) {
            console.log('\n🔍 Testing WHERE Clauses:');
            console.log('=' .repeat(40));

            for (const testCase of testCases) {
                try {
                    const startTime = Date.now();
                    const filtered = await reader.getFilteredData(testCase.where);
                    const elapsed = Date.now() - startTime;

                    console.log(`\n✅ ${testCase.desc}`);
                    console.log(`   WHERE: ${testCase.where}`);
                    console.log(`   Result: ${filtered.length} rows in ${elapsed}ms`);

                    if (filtered.length > 0) {
                        console.log(`   Filtered data:`);
                        filtered.forEach((row, i) => {
                            console.log(`     Row ${i + 1}:`, row);
                        });
                    }

                } catch (error) {
                    console.log(`\n❌ ${testCase.desc}`);
                    console.log(`   WHERE: ${testCase.where}`);
                    console.log(`   Error: ${error.message}`);
                }
            }
        }

        console.log('\n✅ Simple filtering tests complete!');

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

    await testSimpleFiltering(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}