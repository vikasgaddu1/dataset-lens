/**
 * Test specific WHERE clause filtering
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function testSpecificFiltering(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING SPECIFIC WHERE CLAUSE FILTERING');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get all data
        console.log('\n📖 Getting all data...');
        const allData = await reader.getData();
        console.log(`Total rows: ${allData.length}`);
        allData.forEach((row, i) => {
            console.log(`  Row ${i + 1}:`, row);
        });

        // Test specific filters
        const testCases = [
            { where: "name = 'Vikas'", desc: "Exact match Vikas" },
            { where: "name = 'vikas'", desc: "Lowercase vikas" },
            { where: "name = 'VIKAS'", desc: "Uppercase VIKAS" },
            { where: "name = 'Kalya'", desc: "Exact match Kalya" },
            { where: "num = 1 AND name = 'Vikas'", desc: "Compound condition" },
            { where: "num = 1 OR name = 'Kalya'", desc: "OR condition" },
        ];

        console.log('\n🔍 Testing WHERE Clauses:');
        console.log('=' .repeat(40));

        for (const testCase of testCases) {
            try {
                const filtered = await reader.getFilteredData(testCase.where);
                console.log(`\n✅ ${testCase.desc}`);
                console.log(`   WHERE: ${testCase.where}`);
                console.log(`   Result: ${filtered.length} rows`);
                if (filtered.length > 0) {
                    console.log(`   Data:`, filtered);
                }
            } catch (error) {
                console.log(`\n❌ ${testCase.desc}`);
                console.log(`   Error: ${error.message}`);
            }
        }

        console.log('\n✅ Tests complete!');
        reader.dispose();

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

// Main
async function main() {
    const testFile = process.argv[2] || 'C:/sas/Test_Ext/test.sas7bdat';
    await testSpecificFiltering(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}