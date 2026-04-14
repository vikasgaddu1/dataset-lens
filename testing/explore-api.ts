/**
 * Explore js-stream-sas7bdat API
 */

import * as fs from 'fs';

const { DatasetSas7BDat } = require('js-stream-sas7bdat');

async function exploreAPI(filePath: string) {
    console.log('\n🔍 EXPLORING js-stream-sas7bdat API\n');
    console.log('File:', filePath);
    console.log('='.repeat(60));

    try {
        // Create instance
        const dataset = new DatasetSas7BDat(filePath);
        console.log('\n✅ Dataset instance created');
        console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dataset)));

        // Test metadata
        console.log('\n📊 METADATA:');
        const metadata = await dataset.getMetadata();
        console.log('Full metadata structure:');
        console.log(JSON.stringify(metadata, null, 2));

        // Check for row/column count
        console.log('\n📈 Dataset Info:');
        console.log('  Row count property names:', Object.keys(metadata).filter(k => k.toLowerCase().includes('row')));
        console.log('  Column count property names:', Object.keys(metadata).filter(k => k.toLowerCase().includes('col')));

        // Analyze column/variable structure
        console.log('\n📋 Variables/Columns:');
        if (metadata.columns && Array.isArray(metadata.columns)) {
            console.log(`  Found ${metadata.columns.length} columns`);
            metadata.columns.forEach((col: any, idx: number) => {
                console.log(`\n  Column ${idx + 1}:`);
                console.log(`    Name: ${col.name}`);
                console.log(`    Label: ${col.label || 'Not available'}`);
                console.log(`    Type: ${col.dataType}`);
                console.log(`    Length: ${col.length}`);
                console.log(`    Format: ${col.displayFormat || 'Not available'}`);
                console.log(`    All properties: ${Object.keys(col).join(', ')}`);
            });
        }

        // Test reading data
        console.log('\n📖 DATA READING:');

        // Method 1: Try async iterator
        try {
            console.log('\n  Testing async iterator...');
            let count = 0;
            for await (const row of dataset) {
                console.log(`    Row ${count + 1}:`, row);
                count++;
                if (count >= 3) break;
            }
        } catch (error: any) {
            console.log('    ❌ Async iterator error:', error.message);
        }

        // Method 2: Try getData or similar methods
        const possibleDataMethods = ['getData', 'getRows', 'read', 'readRows', 'getObservations'];
        for (const method of possibleDataMethods) {
            if (typeof (dataset as any)[method] === 'function') {
                console.log(`\n  Found method: ${method}()`);
                try {
                    const result = await (dataset as any)[method]({ start: 0, length: 3 });
                    console.log('    Result:', result);
                } catch (error: any) {
                    console.log('    Error:', error.message);
                }
            }
        }

        // Test unique values
        console.log('\n🔍 UNIQUE VALUES:');
        if (typeof dataset.getUniqueValues === 'function') {
            console.log('  ✅ getUniqueValues method found!');

            // Get first column name
            const firstCol = metadata.columns?.[0]?.name;
            if (firstCol) {
                console.log(`\n  Testing unique values for column: ${firstCol}`);
                try {
                    // Try different parameter formats
                    const attempts = [
                        { column: firstCol },
                        { columnName: firstCol },
                        { variable: firstCol },
                        { col: firstCol },
                        firstCol // Just the column name
                    ];

                    for (const params of attempts) {
                        try {
                            console.log(`    Trying params:`, params);
                            const unique = await dataset.getUniqueValues(params);
                            console.log(`    ✅ Success! Found ${unique?.length || 0} unique values`);
                            if (unique && unique.length > 0) {
                                console.log('    First few values:', unique.slice(0, 5));
                            }
                            break;
                        } catch (e: any) {
                            console.log(`    ❌ Failed:`, e.message);
                        }
                    }
                } catch (error: any) {
                    console.log('  ❌ Error getting unique values:', error.message);
                }
            }

            // Test multi-column unique
            if (metadata.columns?.length > 1) {
                const cols = metadata.columns.slice(0, 2).map((c: any) => c.name);
                console.log(`\n  Testing multi-column unique for: ${cols.join(', ')}`);
                try {
                    const multiUnique = await dataset.getUniqueValues({ columns: cols });
                    console.log(`    Found ${multiUnique?.length || 0} unique combinations`);
                } catch (error: any) {
                    console.log('    Error:', error.message);
                }
            }
        } else {
            console.log('  ❌ getUniqueValues method not found');
        }

        // Explore other properties
        console.log('\n🔧 OTHER PROPERTIES:');
        const instance = dataset as any;
        for (const prop of Object.keys(instance)) {
            const value = instance[prop];
            const type = typeof value;
            if (type !== 'function') {
                console.log(`  ${prop}: ${type === 'object' ? JSON.stringify(value)?.substring(0, 100) + '...' : value}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Main
async function main() {
    const filePath = process.argv[2] || 'C:/sas/Test_Ext/test.sas7bdat';

    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        process.exit(1);
    }

    await exploreAPI(filePath);
}

if (require.main === module) {
    main().catch(console.error);
}