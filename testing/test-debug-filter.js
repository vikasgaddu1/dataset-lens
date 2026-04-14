/**
 * Debug WHERE clause filtering issue
 */

const { EnhancedSASReader } = require('../out/readers/EnhancedSASReader');

async function debugFiltering(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DEBUGGING WHERE CLAUSE FILTERING');
    console.log('='.repeat(60));

    try {
        const reader = new EnhancedSASReader(filePath);

        // Get metadata to see what columns exist
        const metadata = await reader.getMetadata();
        console.log('\n📊 Dataset Info:');
        console.log(`  Rows: ${metadata.rowCount}`);
        console.log(`  Columns: ${metadata.columnCount}`);
        console.log('\n📋 Available Variables:');
        metadata.variables.forEach(v => {
            console.log(`  - ${v.name} (${v.type}, length: ${v.length})`);
        });

        // Get all data to see what we're working with
        console.log('\n📖 Sample Data (first 5 rows):');
        const allData = await reader.getData({ numRows: 5 });
        allData.forEach((row, i) => {
            console.log(`  Row ${i + 1}:`, JSON.stringify(row));
        });

        // Test WHERE clause for 'age' if it exists
        const hasAge = metadata.variables.some(v => v.name.toLowerCase() === 'age');

        if (hasAge) {
            console.log('\n🧪 Testing WHERE clauses with "age":');

            // First, clear the cache to ensure fresh results
            reader.clearCache();

            const testCases = [
                { where: "age > 30", desc: "age > 30" },
                { where: "AGE > 30", desc: "AGE > 30 (uppercase)" },
                { where: "age > 0", desc: "age > 0" },
                { where: "age >= 0", desc: "age >= 0" },
            ];

            for (const test of testCases) {
                console.log(`\n  Testing: ${test.desc}`);
                const filtered = await reader.getFilteredData(test.where);
                console.log(`    Result: ${filtered.length} rows`);
                if (filtered.length > 0) {
                    console.log(`    Sample:`, filtered[0]);
                }

                // Clear cache between tests
                reader.clearCache();
            }

            // Get all age values to understand the data
            console.log('\n📊 Age values analysis:');
            const ageColumn = allData.map(row => row.age || row.AGE);
            console.log('  Age values in first 5 rows:', ageColumn);
            console.log('  Types:', ageColumn.map(v => typeof v));

        } else {
            console.log('\n⚠️ No "age" column found in dataset!');
            console.log('Available columns:', metadata.variables.map(v => v.name).join(', '));

            // Try to find numeric columns
            const numericCols = metadata.variables.filter(v =>
                v.type === 'double' || v.type === 'float' || v.type === 'integer'
            );

            if (numericCols.length > 0) {
                console.log('\n📊 Numeric columns available for filtering:');
                numericCols.forEach(col => {
                    console.log(`  - ${col.name} (${col.type})`);
                });

                // Test with the first numeric column
                const testCol = numericCols[0].name;
                console.log(`\n🧪 Testing with numeric column "${testCol}":`);

                const testWhere = `${testCol} > 0`;
                console.log(`  WHERE: ${testWhere}`);
                const filtered = await reader.getFilteredData(testWhere);
                console.log(`  Result: ${filtered.length} rows`);
            }
        }

        // Cleanup
        reader.dispose();

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Stack:', error.stack);
    }
}

// Main
async function main() {
    const testFile = process.argv[2];

    if (!testFile) {
        console.error('Please provide a SAS file path as argument');
        console.log('Usage: node test-debug-filter.js "path/to/file.sas7bdat"');
        process.exit(1);
    }

    console.log('Test file:', testFile);
    await debugFiltering(testFile);
}

if (require.main === module) {
    main().catch(console.error);
}