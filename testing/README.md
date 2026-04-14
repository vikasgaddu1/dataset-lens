# js-stream-sas7bdat Testing

This folder contains tests for evaluating `js-stream-sas7bdat` as a replacement for the Python-based SAS file reader.

## Test Files

- `test-js-stream.ts` - Main test suite for js-stream-sas7bdat functionality
- `compare-with-python.ts` - Comparison between Python and JS implementations
- `unique-values-test.ts` - Focused testing on unique value extraction

## Running Tests

### Basic Test
```bash
# Compile TypeScript
npx tsc testing/test-js-stream.ts

# Run with a SAS file
node testing/test-js-stream.js C:/path/to/file.sas7bdat
```

### Comparison Test
```bash
# Compare Python vs JS implementations
node testing/compare-with-python.js C:/path/to/file.sas7bdat
```

## Test Coverage

### ✅ Features to Test
- [ ] Basic file reading
- [ ] Metadata extraction
  - [ ] Variable names
  - [ ] Variable labels
  - [ ] Variable formats
  - [ ] Variable types
  - [ ] Dataset metadata (rows, cols, encoding)
- [ ] Data operations
  - [ ] Pagination
  - [ ] Streaming
  - [ ] Variable selection (keep/drop)
- [ ] Unique values
  - [ ] Single variable unique values
  - [ ] Multi-variable combinations (NODUPKEY)
  - [ ] Unique value counts
  - [ ] Performance with categorical variables

### 📊 Performance Metrics
- Metadata extraction time
- Data reading speed (rows/sec)
- Unique value extraction time
- Memory usage
- Comparison with Python subprocess

## Results Summary

### js-stream-sas7bdat Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| File Reading | ✅ Works | Returns array of arrays format |
| Metadata | ✅ Partial | Has basic info (rows, cols, names, types) |
| Variable Labels | ❌ Missing | Only has name as label |
| Variable Formats | ❌ Missing | No format information |
| Unique Values | ❌ Broken | Method exists but throws errors |
| Multi-var Unique | ❌ Broken | Returns empty results |
| Performance | ✅ Excellent | 100-700x faster than Python subprocess |

### Performance Comparison

| Operation | Python (subprocess) | JavaScript (native) | Improvement |
|-----------|-------------------|-------------------|-------------|
| Metadata | 730ms | 1ms | **730x faster** |
| Data Read | 605ms | <1ms | **600x faster** |
| Total | 1335ms | 2ms | **667x faster** |

### API Differences

#### Metadata Structure
- **Python**: `{total_rows, total_variables, variables: [{name, type, label, format}]}`
- **JavaScript**: `{records, columns: [{name, dataType, label, length}]}`

#### Data Format
- **Python**: Array of objects `[{col1: val1, col2: val2}, ...]`
- **JavaScript**: Array of arrays `[[val1, val2], ...]`

### Decision Matrix

**Recommendation: Hybrid Approach with Progressive Migration**

1. **Phase 1 - Quick Wins** ✅
   - Use JS for basic data reading (huge performance boost)
   - Keep Python for advanced metadata when needed

2. **Phase 2 - Enhance JS Library**
   - Fix getUniqueValues method
   - Add proper variable labels/formats parsing
   - Convert array format to object format

3. **Phase 3 - Full Migration**
   - Once enhanced, fully migrate to TypeScript
   - Remove Python dependency

## Notes

### Known Issues
1. **getUniqueValues throws error**: `Cannot read properties of undefined (reading 'map')`
2. **No variable formats**: Missing SAS format information (DATE9., DOLLAR12.2, etc.)
3. **Labels same as names**: Doesn't extract actual variable labels
4. **getData requires filterColumns**: Must pass `{filterColumns: []}` parameter

### Workarounds
1. **Unique Values**: Implement manually using getData results
2. **Data Format**: Convert arrays to objects using column names
3. **Variable Metadata**: Cache from Python on first load if needed

### Enhancement Opportunities
1. **Fix getUniqueValues**: Debug the undefined map error
2. **Add format parsing**: Extract from SAS7BDAT subheaders
3. **Variable labels**: Parse column label subheader
4. **Data format option**: Add parameter for array vs object output
5. **WHERE clause**: Implement filtering at read-time

### Implementation Strategy

For the new unique values feature:
```typescript
// Since getUniqueValues is broken, implement manually:
async function getUniqueValues(dataset: any, column: string) {
    const data = await dataset.getData({ filterColumns: [] });
    const colIndex = dataset.metadata.columns.findIndex(c => c.name === column);
    const uniqueSet = new Set(data.map(row => row[colIndex]));
    return Array.from(uniqueSet);
}

// For multi-column unique (NODUPKEY):
async function getMultiUnique(dataset: any, columns: string[]) {
    const data = await dataset.getData({ filterColumns: [] });
    const indices = columns.map(col =>
        dataset.metadata.columns.findIndex(c => c.name === col)
    );
    const uniqueSet = new Set(
        data.map(row => JSON.stringify(indices.map(i => row[i])))
    );
    return Array.from(uniqueSet).map(s => JSON.parse(s));
}
```