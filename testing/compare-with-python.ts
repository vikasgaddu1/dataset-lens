/**
 * Compare js-stream-sas7bdat with Python implementation
 */

import * as path from 'path';
import { spawn } from 'child_process';

const { DatasetSas7BDat } = require('js-stream-sas7bdat');

interface ComparisonResult {
    feature: string;
    python: any;
    javascript: any;
    match: boolean;
    notes: string;
}

async function runPythonCommand(command: string, filePath: string, ...args: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, '..', 'python', 'sas_reader.py');
        const fullArgs = [pythonScript, command, filePath, ...args];

        const pythonProcess = spawn('py', fullArgs);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                return;
            }

            try {
                const result = JSON.parse(stdout);
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result.metadata || result);
                }
            } catch (parseError) {
                reject(new Error(`Failed to parse Python output: ${parseError}`));
            }
        });

        pythonProcess.on('error', (error) => {
            reject(new Error(`Failed to spawn Python process: ${error.message}`));
        });
    });
}

async function compareImplementations(filePath: string) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PYTHON vs JAVASCRIPT COMPARISON');
    console.log('='.repeat(60));
    console.log('File:', filePath);

    const results: ComparisonResult[] = [];

    try {
        // Get Python metadata
        console.log('\n⏳ Getting Python metadata...');
        const startPython = Date.now();
        const pythonMeta = await runPythonCommand('metadata', filePath);
        const pythonMetaTime = Date.now() - startPython;

        // Get JavaScript metadata
        console.log('⏳ Getting JavaScript metadata...');
        const startJS = Date.now();
        const dataset = new DatasetSas7BDat(filePath);
        const jsMeta = await dataset.getMetadata();
        const jsMetaTime = Date.now() - startJS;

        // Compare metadata extraction time
        results.push({
            feature: 'Metadata Extraction Speed',
            python: `${pythonMetaTime}ms`,
            javascript: `${jsMetaTime}ms`,
            match: jsMetaTime < pythonMetaTime,
            notes: jsMetaTime < pythonMetaTime ? 'JS faster ✅' : 'Python faster'
        });

        // Compare row count
        results.push({
            feature: 'Row Count',
            python: pythonMeta.total_rows,
            javascript: jsMeta.records,
            match: pythonMeta.total_rows === jsMeta.records,
            notes: ''
        });

        // Compare column count
        results.push({
            feature: 'Column Count',
            python: pythonMeta.total_variables,
            javascript: jsMeta.columns?.length,
            match: pythonMeta.total_variables === jsMeta.columns?.length,
            notes: ''
        });

        // Compare column names
        const pythonColNames = pythonMeta.variables.map((v: any) => v.name);
        const jsColNames = jsMeta.columns?.map((c: any) => c.name) || [];
        results.push({
            feature: 'Column Names',
            python: pythonColNames.join(', '),
            javascript: jsColNames.join(', '),
            match: JSON.stringify(pythonColNames) === JSON.stringify(jsColNames),
            notes: ''
        });

        // Compare variable labels
        const pythonHasLabels = pythonMeta.variables.some((v: any) => v.label && v.label !== v.name);
        const jsHasLabels = jsMeta.columns?.some((c: any) => c.label && c.label !== c.name) || false;
        results.push({
            feature: 'Variable Labels',
            python: pythonHasLabels ? '✅ Available' : '❌ Not found',
            javascript: jsHasLabels ? '✅ Available' : '❌ Not found',
            match: pythonHasLabels === jsHasLabels,
            notes: 'JS only has label same as name'
        });

        // Compare variable formats
        const pythonHasFormats = pythonMeta.variables.some((v: any) => v.format && v.format !== '');
        const jsHasFormats = jsMeta.columns?.some((c: any) => c.displayFormat || c.format) || false;
        results.push({
            feature: 'Variable Formats',
            python: pythonHasFormats ? '✅ Available' : '❌ Not found',
            javascript: jsHasFormats ? '✅ Available' : '❌ Not found',
            match: pythonHasFormats === jsHasFormats,
            notes: 'JS missing format info'
        });

        // Compare dataset label
        results.push({
            feature: 'Dataset Label',
            python: pythonMeta.dataset_label || 'None',
            javascript: jsMeta.label || jsMeta.name || 'None',
            match: false,
            notes: 'Different structure'
        });

        // Compare data reading
        console.log('\n⏳ Reading sample data...');

        // Python data
        const startPythonData = Date.now();
        const pythonData = await runPythonCommand('data', filePath, '0', '5');
        const pythonDataTime = Date.now() - startPythonData;

        // JavaScript data
        const startJSData = Date.now();
        const jsData = await dataset.getData({ filterColumns: [] });  // Need empty array for filterColumns
        const jsDataTime = Date.now() - startJSData;

        results.push({
            feature: 'Data Reading Speed',
            python: `${pythonDataTime}ms`,
            javascript: `${jsDataTime}ms`,
            match: jsDataTime < pythonDataTime,
            notes: jsDataTime < pythonDataTime ? 'JS faster ✅' : 'Python faster'
        });

        results.push({
            feature: 'Data Format',
            python: 'Array of objects',
            javascript: 'Array of arrays',
            match: false,
            notes: 'Different output format'
        });

        // Test unique values capability
        console.log('\n⏳ Testing unique values...');

        // Check JS unique values
        let jsUniqueWorks = false;
        try {
            if (jsColNames.length > 0) {
                const uniqueResult = await dataset.getUniqueValues([jsColNames[0]]);
                jsUniqueWorks = uniqueResult && uniqueResult.length > 0;
            }
        } catch (e) {
            jsUniqueWorks = false;
        }

        results.push({
            feature: 'Unique Values Support',
            python: '✅ Manual implementation',
            javascript: jsUniqueWorks ? '✅ Built-in' : '❌ Not working',
            match: false,
            notes: 'JS getUniqueValues has issues'
        });

        // Print results table
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPARISON RESULTS');
        console.log('='.repeat(60));

        // Find max lengths for formatting
        const maxFeatureLen = Math.max(...results.map(r => r.feature.length), 20);
        const maxPythonLen = Math.max(...results.map(r => String(r.python).length), 15);
        const maxJsLen = Math.max(...results.map(r => String(r.javascript).length), 15);

        // Print header
        console.log(
            '\n' +
            'Feature'.padEnd(maxFeatureLen) + ' | ' +
            'Python'.padEnd(maxPythonLen) + ' | ' +
            'JavaScript'.padEnd(maxJsLen) + ' | ' +
            'Match' + ' | ' +
            'Notes'
        );
        console.log('-'.repeat(maxFeatureLen + maxPythonLen + maxJsLen + 50));

        // Print rows
        results.forEach(r => {
            const match = r.match ? '✅' : '❌';
            console.log(
                r.feature.padEnd(maxFeatureLen) + ' | ' +
                String(r.python).padEnd(maxPythonLen) + ' | ' +
                String(r.javascript).padEnd(maxJsLen) + ' | ' +
                match.padEnd(5) + ' | ' +
                r.notes
            );
        });

        // Summary
        const matchCount = results.filter(r => r.match).length;
        const totalCount = results.length;
        const matchPercent = Math.round((matchCount / totalCount) * 100);

        console.log('\n' + '='.repeat(60));
        console.log('📈 SUMMARY');
        console.log('='.repeat(60));
        console.log(`  Matching features: ${matchCount}/${totalCount} (${matchPercent}%)`);

        console.log('\n✅ JavaScript Advantages:');
        console.log('  - No Python dependency required');
        console.log('  - Native speed (no subprocess overhead)');
        console.log('  - Direct integration with TypeScript');
        console.log('  - Simpler deployment');

        console.log('\n❌ JavaScript Limitations:');
        console.log('  - Missing variable formats');
        console.log('  - Limited metadata (no true labels)');
        console.log('  - Unique values method not working properly');
        console.log('  - Different data output format');

        console.log('\n💡 Recommendation:');
        if (matchPercent >= 80) {
            console.log('  ✅ JavaScript implementation is sufficient for basic needs');
        } else if (matchPercent >= 50) {
            console.log('  ⚠️ JavaScript needs enhancements for full functionality');
            console.log('  Consider hybrid approach or forking the library');
        } else {
            console.log('  ❌ Stay with Python for now - too many missing features');
            console.log('  Or implement custom TypeScript solution');
        }

    } catch (error) {
        console.error('❌ Comparison failed:', error);
    }
}

// Main
async function main() {
    const filePath = process.argv[2] || 'C:/sas/Test_Ext/test.sas7bdat';
    await compareImplementations(filePath);
}

if (require.main === module) {
    main().catch(console.error);
}