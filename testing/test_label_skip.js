// Test label row skipping
const { XPTReader } = require('../out/readers/XPTReader');

async function test() {
    const reader = new XPTReader('C:\\Python\\test\\cars_v5.xpt');

    console.log('Getting metadata...');
    const meta = await reader.getMetadata();
    console.log(`Row count: ${meta.rowCount}`);
    console.log(`Column count: ${meta.columnCount}`);

    console.log('\nGetting first 3 rows...');
    const data = await reader.getData({
        startRow: 0,
        numRows: 3
    });

    for (let i = 0; i < data.length; i++) {
        console.log(`\nRow ${i + 1}:`);
        console.log(`  MAKE: ${data[i].MAKE}`);
        console.log(`  MODEL: ${data[i].MODEL}`);
        console.log(`  ENGSIZE: ${data[i].ENGSIZE}`);
        console.log(`  MSRP: ${data[i].MSRP}`);
    }
}

test().catch(console.error);
