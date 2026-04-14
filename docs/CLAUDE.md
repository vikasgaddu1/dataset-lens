# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

### Python Setup
```bash
# Install Python dependencies (Windows)
py -m pip install -r python/requirements.txt
# Or install individually
py -m pip install pandas pyreadstat numpy
```

### Node.js Setup
```bash
# Node.js is properly installed and available in system PATH
# Verify with:
node --version
npm --version
```

### TypeScript Compilation
```bash
# Standard commands
npm install          # Install dependencies
npm run compile      # One-time compilation
npm run watch        # Watch mode for development
```

### Extension Publishing
```bash
# Install VS Code Extension CLI
npm install -g @vscode/vsce

# Package the extension
vsce package

# Publish to marketplace
vsce publish

# See PUBLISHING_STEPS.md for detailed instructions
```

### Testing
```bash
# Test Python backend directly
py python/sas_reader.py metadata "path/to/test.sas7bdat"
py python/sas_reader.py data "path/to/test.sas7bdat" 0 100
py test_python.py

# Sample test datasets location
# C:\sas\Test_Ext\*.sas7bdat

# VS Code Extension Testing
# Press F5 in VS Code to launch Extension Development Host
```

## Architecture Overview

This VS Code extension enables viewing and filtering SAS7BDAT dataset files. The architecture uses a **TypeScript-first approach with Python fallback** and multiple rendering strategies.

**Version 2.0.0 Features:**
- TypeScript-based SAS reader using js-stream-sas7bdat (600-700x faster)
- Enhanced WHERE clause filtering with AND/OR support
- Unique values extraction for categorical variables
- Multi-column unique combinations (NODUPKEY equivalent)
- Automatic Python fallback for edge cases

### Core Components

**1. Extension Layer (TypeScript)**
- `src/extension.ts` - Entry point, registers custom editor provider for `.sas7bdat` files
- `src/SasDataProvider.ts` - Implements `vscode.CustomReadonlyEditorProvider`, manages document lifecycle and Python subprocess communication
- `src/WebviewPanel.ts` - Central webview management, message routing, and rendering strategy selection

**2. TypeScript Reader (`src/readers/EnhancedSASReader.ts`)**
- Uses `js-stream-sas7bdat` library for native SAS7BDAT file reading
- Provides enhanced functionality:
  - Fixed getUniqueValues implementation
  - Multi-column unique combinations
  - Improved WHERE clause parsing with AND/OR support
  - Case-insensitive string comparisons
  - Result caching for performance

**3. Python Backend (`python/sas_reader.py`)** - Fallback only
- Uses `pyreadstat` library for edge cases
- Provides CLI interface with metadata and data commands
- Supports WHERE clause filtering at pandas level
- Returns JSON responses with data arrays and metadata

**4. Rendering Strategies**
The extension currently supports three rendering approaches (controlled by `WebviewPanel.ts`):

- **PaginationWebview.ts** (Current/Recommended) - Reliable pagination with 50/100/200/500 rows per page
- **VirtualScrollingWebviewComplete.ts** - Virtual scrolling for large datasets (has reliability issues beyond row 172)
- **VirtualScrollingWebview.ts** - Legacy virtual scrolling implementation

### Data Flow Architecture

1. **File Opening**: VS Code detects `.sas7bdat` → triggers custom editor via extension registration
2. **Metadata Loading**: `SASDatasetDocument.openDocument()` uses TypeScript reader (falls back to Python if needed)
3. **Webview Creation**: `SASWebviewPanel` creates webview with selected rendering strategy
4. **Initial Data Load**:
   - Pagination mode: Loads first page (100 rows by default)
   - Virtual scrolling: Loads up to 1000 rows initially
5. **Message Communication**:
   - Webview → Extension: `loadData`, `applyFilter`, `webviewReady`
   - Extension → Webview: `initialData`, `dataChunk`, `filterResult`, `error`
6. **Data Updates**: User interactions trigger Python subprocess calls for new data

### Critical Implementation Details

**Message Handler Setup Sequence** (Must follow this order):
1. Set webview options (`enableScripts: true`)
2. Attach message handler in constructor
3. Set HTML content
4. Wait for `webviewReady` signal
5. Send initial data

**Python Process Management**:
- Each data request spawns new Python subprocess
- Uses `spawn('py', args)` on Windows (not `python` or `python3`)
- Full file paths required for Windows compatibility
- JSON parsing of stdout, error handling via stderr

**Webview State Management**:
- `FilterState` maintains selected variables, WHERE clause, and column order
- Client-side filtering for responsive UI (pagination mode)
- Server-side filtering for large datasets (virtual scrolling)

**Known Issues with Virtual Scrolling**:
- Data stops displaying beyond row 172 (debugging logs added)
- Chunk loading timeout issues partially resolved with retry logic
- Fallback to pagination mode recommended for reliability

## Windows-Specific Requirements

- Python command: `py` (not `python` or `python3`)
- Node.js: Available in PATH as `node` and `npm` commands
- File paths: Use backslashes or properly escape forward slashes

## Current Implementation Status

### Working Features
- ✅ Pagination interface with reliable data display
- ✅ WHERE clause filtering (SAS-style syntax)
- ✅ Variable selection and display mode toggling
- ✅ Metadata tooltips and variable information
- ✅ Professional sidebar layout

### Issues Being Debugged
- ⚠️ Virtual scrolling stops at row 172 (extensive debugging added)
- ⚠️ Chunk loading timeouts in virtual scrolling mode
- ⚠️ DOM element validation issues in virtual scroller

### Recent Changes
- Added pagination mode as default (more reliable than virtual scrolling)
- Extensive debugging logs added to trace virtual scrolling issues
- Fallback DOM creation for missing elements
- Enhanced data validation for loaded rows

## Data Loading Strategies

**Small Datasets (< 1000 rows)**:
- Load all data initially
- Client-side filtering and pagination

**Large Datasets (≥ 1000 rows)**:
- Pagination: Load 100 rows per page request
- Virtual Scrolling: Load 1000 rows initially, then 100-row chunks on scroll
- WHERE filtering applied at pandas level for efficiency

**Buffer Zones** (Virtual Scrolling):
- Pre-load 5-20 rows above/below visible range
- Double buffer at end for smoother scrolling
- Retry mechanism with exponential backoff for failed chunks