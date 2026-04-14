# Change Log

All notable changes to the "SAS Data Explorer" extension will be documented in this file.

## [2.0.1] - 2025-01-28

### 🎨 UI Redesign & Improvements

#### New Features
- **Dataset Metadata Modal**
  - New dedicated button for dataset information
  - Shows filename, label, rows, variables, and file path
  - Additional metadata when available (creation date, SAS version, etc.)
  - Dynamic row count updates when filters are applied

- **Unique Values Extraction**
  - Get unique values for any variable with counts
  - Support for multi-column unique combinations
  - Modal display with sortable results
  - NODUPKEY equivalent functionality

#### UI Enhancements
- **Cleaner Interface Design**
  - Removed redundant dataset name displays
  - Three-column control layout for better organization
  - Streamlined filter info bar with inline row display
  - More efficient use of screen space

- **Improved Control Organization**
  - Left section: WHERE filter with Apply/Clear buttons
  - Middle section: Unique values input and Show button
  - Right section: Dataset/Variables buttons and display mode

#### Bug Fixes
- Fixed dataset label display logic
- Improved filter result count updates
- Enhanced modal window management
- Better handling of null values in unique results

## [2.0.0] - 2025-01-27

### 🚀 Major Performance Upgrade

#### Revolutionary Performance
- **600-700x faster** than v1.0 with TypeScript-first architecture
- Native TypeScript reader using js-stream-sas7bdat library
- Metadata extraction in ~1ms (vs 730ms in v1.0)
- Data reading in <1ms (vs 605ms in v1.0)
- Smart caching for filtered results
- Automatic Python fallback for edge cases

#### Enhanced Features
- **Advanced WHERE Filtering**
  - Case-insensitive string comparisons
  - Better AND/OR support with proper precedence
  - SAS-style operators (EQ, NE, GT, LT, GE, LE)
  - Improved error messages for invalid filters

- **Better Logging**
  - New command: `SAS Data Explorer: Show Output`
  - Comprehensive debug logging when enabled
  - Performance metrics tracking
  - Better error diagnostics

## [1.0.0] - 2024-01-25

### 🎉 Initial Release

#### Features
- **Dataset Viewing**
  - Open and view SAS7BDAT files directly in VS Code
  - Professional tabular display with responsive design
  - Support for large datasets with optimized performance

- **Pagination System**
  - Multiple page size options (50, 100, 200, 500 rows)
  - Navigate with First/Previous/Next/Last buttons
  - Jump to specific page functionality
  - Real-time row count display

- **Advanced Filtering**
  - SAS-style WHERE clause support
  - Case-insensitive variable names
  - Support for multiple operators (=, >, <, >=, <=, !=)
  - Logical operators (AND, OR, &, |)

- **Variable Management**
  - KEEP functionality: Specify variables to include
  - DROP functionality: Specify variables to exclude
  - Interactive checkbox selection for each variable
  - Select All/Clear All buttons
  - Variable display modes (Names, Labels, or Both)

- **Metadata Features**
  - View complete variable metadata in popup window
  - Visual icons for different data types
  - Variable labels and format information
  - Dataset label display

- **User Interface**
  - Dark/Light theme support
  - Professional sidebar layout
  - Responsive design
  - Loading animations and skeleton screens
  - Error handling with user-friendly messages

- **Performance Optimizations**
  - Efficient Python backend using pandas and pyreadstat
  - Smart data caching
  - Optimized rendering for large datasets
  - Professional logging system with debug mode

#### Technical Improvements
- TypeScript implementation for type safety
- Proper VS Code extension lifecycle management
- Configurable debug logging
- Resource cleanup on deactivation
- Error boundary implementation

### Known Limitations
- Virtual scrolling has limitations with extremely large datasets
- Complex nested WHERE clauses may require specific formatting

---

## Future Roadmap

### Planned Features
- Export functionality (CSV, Excel)
- Advanced statistics view
- Column sorting capabilities
- Search within data
- Multiple dataset comparison
- Custom formatting options

### Under Consideration
- Support for other SAS file formats (.xpt, .sas7bcat)
- Integration with SAS programming environment
- Data editing capabilities (read-only currently)

---

For more information, visit the [GitHub repository](https://github.com/anovagroups/sas-data-explorer)