/**
 * Test case-insensitive field names in WHERE clauses (SAS-style)
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function testCaseInsensitiveFields(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING CASE-INSENSITIVE FIELD NAMES');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get metadata
        const metadata = await reader.getMetadata();
        console.log('\n📊 Dataset Info:');
        console.log(`  Columns: ${metadata.variables.map(v => v.name).join(', ')}`);

        // Get all data
        const allData = await reader.getData();
        console.log(`\n📖 Sample data (${allData.length} rows):`);
        allData.forEach((row, i) => {
            console.log(`  Row ${i + 1}:`, row);
        });

        // Test case-insensitive field names
        const testCases = [
            // Test with 'num' field (exists as lowercase)
            { where: "num = 1", desc: "num = 1 (lowercase, exact match)" },
            { where: "NUM = 1", desc: "NUM = 1 (uppercase)" },
            { where: "Num = 1", desc: "Num = 1 (mixed case)" },
            { where: "nUm = 1", desc: "nUm = 1 (random case)" },

            // Test with 'name' field (exists as lowercase)
            { where: "name = 'Vikas'", desc: "name = 'Vikas' (lowercase, exact)" },
            { where: "NAME = 'Vikas'", desc: "NAME = 'Vikas' (uppercase)" },
            { where: "Name = 'Vikas'", desc: "Name = 'Vikas' (mixed case)" },
            { where: "NaMe = 'Vikas'", desc: "NaMe = 'Vikas' (random case)" },

            // Test compound conditions with mixed case
            { where: "NUM > 0 AND name = 'Vikas'", desc: "NUM > 0 AND name = 'Vikas'" },
            { where: "num = 1 OR NAME = 'Kalya'", desc: "num = 1 OR NAME = 'Kalya'" },
            { where: "NuM = 2 AND nAmE = 'Kalya'", desc: "NuM = 2 AND nAmE = 'Kalya'" },
        ];

        console.log('\n🔍 Testing WHERE Clauses with case-insensitive fields:');
        console.log('=' .repeat(40));

        for (const testCase of testCases) {
            console.log(`\n✅ ${testCase.desc}`);
            console.log(`   WHERE: ${testCase.where}`);

            // Clear cache for fresh test
            reader.clearCache();

            const filtered = await reader.getFilteredData(testCase.where);
            console.log(`   Result: ${filtered.length} rows`);
            if (filtered.length > 0) {
                console.log(`   Data:`, filtered);
            }
        }

        console.log('\n✅ Case-insensitive field tests complete!');

        // Test with non-existent field
        console.log('\n🔍 Testing with non-existent field:');
        const badFilter = "AGE > 30";  // AGE doesn't exist
        console.log(`   WHERE: ${badFilter}`);
        const badResult = await reader.getFilteredData(badFilter);
        console.log(`   Result: ${badResult.length} rows (should be 0)`);

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

    await testCaseInsensitiveFields(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}