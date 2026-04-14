// Test xport-js with potential v5 file
const Library = require('xport-js').default;

async function testV5() {
    try {
        console.log('Testing cars_v5.xpt...');
        const lib = new Library('C:\\Python\\test\\cars_v5.xpt');

        console.log('\nGetting metadata...');
        const metadata = await lib.getMetadata();
        console.log('Metadata:', JSON.stringify(metadata, null, 2));

        console.log('\n\nReading first 3 records...');
        let count = 0;
        for await (const record of lib.read({ rowFormat: 'object' })) {
            console.log(`Record ${count + 1}:`, JSON.stringify(record, null, 2));
            count++;
            if (count >= 3) break;
        }

        console.log('\n\n✅ SUCCESS! This is a v5/v6 XPT file that xport-js can read!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testV5();
