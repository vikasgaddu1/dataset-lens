"use strict";
/**
 * Test Enhanced SAS Reader wrapper
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const EnhancedSASReader_1 = require("../src/readers/EnhancedSASReader");
const fs = __importStar(require("fs"));
async function testEnhancedReader(filePath) {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TESTING ENHANCED SAS READER');
    console.log('='.repeat(60));
    console.log('File:', filePath);
    try {
        const reader = new EnhancedSASReader_1.EnhancedSASReader(filePath);
        // Test 1: Metadata
        console.log('\n📊 METADATA TEST:');
        const metadata = await reader.getMetadata();
        console.log('  Rows:', metadata.rowCount);
        console.log('  Columns:', metadata.columnCount);
        console.log('  Variables:');
        metadata.variables.forEach(v => {
            console.log(`    - ${v.name} (${v.type}, length: ${v.length})`);
        });
        // Test 2: Data reading (as objects)
        console.log('\n📖 DATA READING TEST:');
        const data = await reader.getData({ numRows: 3 });
        console.log('  First 3 rows:');
        data.forEach((row, i) => {
            console.log(`    Row ${i + 1}:`, row);
        });
        // Test 3: Unique values (FIXED!)
        console.log('\n🔍 UNIQUE VALUES TEST:');
        if (metadata.variables.length > 0) {
            const firstCol = metadata.variables[0].name;
            const uniqueVals = await reader.getUniqueValues(firstCol);
            console.log(`  Unique values in '${firstCol}':`, uniqueVals);
            // With counts
            const uniqueWithCount = await reader.getUniqueValues(firstCol, true);
            console.log(`  With counts:`, uniqueWithCount);
        }
        // Test 4: Multi-column unique (NODUPKEY)
        console.log('\n🔗 MULTI-COLUMN UNIQUE TEST:');
        if (metadata.variables.length > 1) {
            const cols = metadata.variables.slice(0, 2).map(v => v.name);
            const combos = await reader.getUniqueCombinations(cols);
            console.log(`  Unique combinations of [${cols.join(', ')}]:`, combos);
            // With counts
            const combosWithCount = await reader.getUniqueCombinations(cols, true);
            console.log(`  With counts:`, combosWithCount);
        }
        // Test 5: Column info (for UI)
        console.log('\n📋 COLUMN INFO TEST:');
        if (metadata.variables.length > 0) {
            const colInfo = await reader.getColumnInfo(metadata.variables[0].name);
            console.log('  Column info:', colInfo);
            console.log(`    Is categorical? ${colInfo.isCategorical ? 'Yes' : 'No'}`);
        }
        // Test 6: Performance comparison
        console.log('\n⚡ PERFORMANCE TEST:');
        // Time unique values extraction
        const perfCol = metadata.variables[0]?.name;
        if (perfCol) {
            const start = Date.now();
            await reader.getUniqueValues(perfCol);
            const time = Date.now() - start;
            console.log(`  Unique values extracted in: ${time}ms`);
        }
        console.log('\n✅ ALL TESTS PASSED!');
        // Cleanup
        reader.dispose();
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}
// Main
async function main() {
    const filePath = process.argv[2] || 'C:/sas/Test_Ext/test.sas7bdat';
    if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        process.exit(1);
    }
    await testEnhancedReader(filePath);
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=test-enhanced-reader.js.map