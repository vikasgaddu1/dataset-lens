# Publishing SAS Data Explorer to VS Code Marketplace

## Prerequisites

1. **Node.js and npm**: Ensure Node.js is properly installed and available in your system PATH
   - Test with: `node --version` and `npm --version`
   - If not in PATH, add Node.js installation directory to system environment variables

2. **Visual Studio Code Extension CLI (vsce)**:
   ```bash
   npm install -g @vscode/vsce
   ```

3. **Publisher Account**:
   - Create a publisher at https://marketplace.visualstudio.com/manage
   - Get a Personal Access Token from Azure DevOps:
     - Direct link: https://dev.azure.com/vgaddu/_usersSettings/tokens
     - Create token with "Marketplace: Manage" scope
   - PAT is stored in `.env` file as `MSF_PAT`

## Step-by-Step Publishing Process

### 1. Prepare the Extension

Ensure all required files are present:
- [x] `package.json` with correct metadata
- [x] `README.md` with extension documentation
- [x] `CHANGELOG.md` documenting changes
- [x] `LICENSE` file (MIT)
- [x] Extension icon (`icon.png`)
- [x] `.vscodeignore` to exclude unnecessary files

### 2. Build the Extension

```bash
# Compile TypeScript files
npm run compile

# Run tests (if available)
npm test
```

### 3. Package the Extension

```bash
# Create a .vsix file
vsce package

# This will create: sas-data-explorer-x.x.x.vsix
```

### 4. Test Locally (Optional)

Install the .vsix file in VS Code to test:
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Click "..." menu > "Install from VSIX..."
4. Select your .vsix file

### 5. Publish to Marketplace

```bash
# Login to your publisher account
vsce login anovagroups
# Enter PAT from .env (MSF_PAT) when prompted

# Publish the extension
npx vsce publish

# Or publish with version increment
npx vsce publish minor  # Increments minor version
npx vsce publish major  # Increments major version
npx vsce publish patch  # Increments patch version
```

### 6. Alternative: Manual Upload

1. Go to https://marketplace.visualstudio.com/manage
2. Click on your publisher
3. Click "New Extension" or update existing
4. Upload the .vsix file
5. Fill in the required information
6. Publish

## Important Notes

- The extension ID is: `sas-data-explorer`
- Current version: `2.2.0`
- Publisher needs to be set in `package.json`
- Ensure all dependencies are listed in `package.json`
- The Python backend files in `/python` directory are included in the package

## Troubleshooting

### If vsce is not recognized:
```bash
# Check if installed globally
npm list -g @vscode/vsce

# If not installed, install it
npm install -g @vscode/vsce

# Or use npx (no installation needed)
npx @vscode/vsce package
npx @vscode/vsce publish
```

### If packaging fails:
- Check that all files referenced in `package.json` exist
- Ensure TypeScript compilation succeeds
- Verify that the icon file exists and is properly referenced
- Check `.vscodeignore` isn't excluding required files

## After Publishing

1. Check the extension page at:
   `https://marketplace.visualstudio.com/items?itemName=anovagroups.sas-data-explorer`

2. Monitor for user feedback and issues

3. Update regularly with bug fixes and new features

## Version Management

Before each publish:
1. Update version in `package.json`
2. Update `CHANGELOG.md` with new changes
3. Commit all changes to git
4. Create a git tag for the version: `git tag v2.2.0`
5. Push to GitHub (requires GitHub PAT, separate from Azure DevOps PAT)

## Quick Publish Commands

```bash
# Build and publish in one go
npm run compile && npx vsce publish

# Verify PAT is valid
npx vsce verify-pat anovagroups
```