import * as vscode from 'vscode';
import { SASDatasetProvider } from './SasDataProvider';
import { XPTDatasetProvider } from './XptDataProvider';
import { RDatasetProvider } from './RDataProvider';
import { DatasetJsonProvider } from './DatasetJsonProvider';
import { SASWebviewPanel } from './WebviewPanel';
import { Logger } from './utils/logger';
import { PythonEnvironment } from './utils/pythonEnvironment';

/**
 * Activates the Dataset Lens extension
 * @param context - The VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
    // Initialize logging
    Logger.initialize('Dataset Lens');
    Logger.info('Extension activating...');

    const sasProvider = new SASDatasetProvider(context);
    const xptProvider = new XPTDatasetProvider(context);
    const rDataProvider = new RDatasetProvider(context);
    const datasetJsonProvider = new DatasetJsonProvider(context);

    // Register custom editor providers
    const sasDisposable = vscode.window.registerCustomEditorProvider(
        'sasDataExplorer.sas7bdat',
        sasProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    const xptDisposable = vscode.window.registerCustomEditorProvider(
        'sasDataExplorer.xpt',
        xptProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    // Register R data provider for .rds files
    const rdsDisposable = vscode.window.registerCustomEditorProvider(
        'sasDataExplorer.rds',
        rDataProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    // Register R data provider for .rdata/.rda files
    const rdataDisposable = vscode.window.registerCustomEditorProvider(
        'sasDataExplorer.rdata',
        rDataProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    // Register CDISC Dataset-JSON provider
    const datasetJsonDisposable = vscode.window.registerCustomEditorProvider(
        'sasDataExplorer.datasetjson',
        datasetJsonProvider,
        {
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        }
    );

    // Register command to show output channel
    const showOutputCommand = vscode.commands.registerCommand(
        'sasDataExplorer.showOutput',
        () => {
            Logger.show();
            Logger.info('Output channel displayed');
        }
    );

    // Register command to open SAS dataset
    const openCommand = vscode.commands.registerCommand(
        'sasDataExplorer.openDataset',
        async () => {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Open SAS Dataset',
                filters: {
                    'SAS Datasets': ['sas7bdat']
                }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                await vscode.commands.executeCommand('vscode.openWith', fileUri[0], 'sasDataExplorer.sas7bdat');
            }
        }
    );

    // Register command to open XPT file
    const openXPTCommand = vscode.commands.registerCommand(
        'sasDataExplorer.openXPT',
        async () => {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Open SAS XPT File',
                filters: {
                    'SAS XPT Files': ['xpt']
                }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                await vscode.commands.executeCommand('vscode.openWith', fileUri[0], 'sasDataExplorer.xpt');
            }
        }
    );

    // Register command to open R data file
    const openRDataCommand = vscode.commands.registerCommand(
        'sasDataExplorer.openRData',
        async () => {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Open R Data File',
                filters: {
                    'R Data Files': ['rds', 'rdata', 'rda']
                }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                const ext = fileUri[0].fsPath.toLowerCase();
                if (ext.endsWith('.rds')) {
                    await vscode.commands.executeCommand('vscode.openWith', fileUri[0], 'sasDataExplorer.rds');
                } else {
                    await vscode.commands.executeCommand('vscode.openWith', fileUri[0], 'sasDataExplorer.rdata');
                }
            }
        }
    );

    // Register command to open CDISC Dataset-JSON file
    const openDatasetJsonCommand = vscode.commands.registerCommand(
        'sasDataExplorer.openDatasetJson',
        async () => {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                openLabel: 'Open CDISC Dataset-JSON File',
                filters: {
                    'CDISC Dataset-JSON Files': ['json']
                }
            };

            const fileUri = await vscode.window.showOpenDialog(options);
            if (fileUri && fileUri[0]) {
                await vscode.commands.executeCommand('vscode.openWith', fileUri[0], 'sasDataExplorer.datasetjson');
            }
        }
    );

    // Register command to reset Python environment
    const resetPythonEnvCommand = vscode.commands.registerCommand(
        'sasDataExplorer.resetPythonEnv',
        async () => {
            const choice = await vscode.window.showWarningMessage(
                'This will delete and recreate the Python virtual environment. Continue?',
                'Yes', 'No'
            );
            if (choice === 'Yes') {
                try {
                    const pyEnv = PythonEnvironment.getInstance();
                    await pyEnv.reset(context);
                    vscode.window.showInformationMessage('Dataset Lens: Python environment has been recreated.');
                } catch (err) {
                    vscode.window.showErrorMessage(`Failed to reset Python environment: ${err}`);
                }
            }
        }
    );

    // Add disposables to context for proper cleanup
    context.subscriptions.push(
        sasDisposable,
        xptDisposable,
        rdsDisposable,
        rdataDisposable,
        datasetJsonDisposable,
        openCommand,
        openXPTCommand,
        openRDataCommand,
        openDatasetJsonCommand,
        showOutputCommand,
        resetPythonEnvCommand
    );

    // Ensure logger is disposed when extension deactivates
    context.subscriptions.push({ dispose: () => Logger.dispose() });

    Logger.info('Extension activated successfully');
    Logger.info('TypeScript reader v2.0.0 with improved WHERE clause filtering');
    Logger.info('XPT file support enabled');
    Logger.info('R data file support enabled (.rds, .rdata, .rda)');
    Logger.info('CDISC Dataset-JSON support enabled');
    // Logger is available via command: "Dataset Lens: Show Output"
}

/**
 * Deactivates the extension and cleans up resources
 */
export function deactivate() {
    Logger.info('Extension deactivating...');
    Logger.dispose();
}