// Simple test to verify xport-js can read the XPT file
const Library = require('xport-js').default;

async function testXPT() {
    try {
        console.log('Creating Library instance...');
        const lib = new Library('C:\\Python\\test\\test_data_temp.xpt');

        console.log('\nGetting metadata...');
        const metadata = await lib.getMetadata();
        console.log('Metadata:', JSON.stringify(metadata, null, 2));

        console.log('\n\nReading first 5 records...');
        let count = 0;
        for await (const record of lib.read({ rowFormat: 'object' })) {
            console.log(`Record ${count + 1}:`, JSON.stringify(record, null, 2));
            count++;
            if (count >= 5) break;
        }

        console.log('\n\nSuccess!');
    } catch (error) {
        console.error('Error:', error);
        console.error('Stack:', error.stack);
    }
}

testXPT();
