import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { Logger } from './logger';

/**
 * Manages a Python virtual environment for the extension.
 * Creates a venv in VS Code's globalStorageUri on first use,
 * installs required packages, and provides the Python executable path.
 */
export class PythonEnvironment {
    private static instance: PythonEnvironment | null = null;
    private venvPath: string = '';
    private pythonPath: string = '';
    private ready: boolean = false;
    private initializing: Promise<void> | null = null;

    private constructor() {}

    static getInstance(): PythonEnvironment {
        if (!PythonEnvironment.instance) {
            PythonEnvironment.instance = new PythonEnvironment();
        }
        return PythonEnvironment.instance;
    }

    /**
     * Initialize the venv. Safe to call multiple times — only runs once.
     */
    async ensureReady(context: vscode.ExtensionContext): Promise<void> {
        if (this.ready) {
            return;
        }
        if (this.initializing) {
            return this.initializing;
        }
        this.initializing = this._initialize(context);
        return this.initializing;
    }

    /**
     * Returns the path to the Python executable inside the venv.
     */
    getPythonPath(): string {
        if (!this.ready) {
            throw new Error('Python environment not initialized. Call ensureReady() first.');
        }
        return this.pythonPath;
    }

    /**
     * Spawn a Python process using the venv Python.
     */
    spawnPython(args: string[], cwd: string) {
        return spawn(this.getPythonPath(), args, { cwd });
    }

    private async _initialize(context: vscode.ExtensionContext): Promise<void> {
        const globalStoragePath = context.globalStorageUri.fsPath;
        this.venvPath = path.join(globalStoragePath, 'python-env');

        const isWindows = process.platform === 'win32';
        this.pythonPath = isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');

        // Check if venv already exists and has packages installed
        if (await this._isVenvValid()) {
            Logger.info(`Python venv already set up at ${this.venvPath}`);
            this.ready = true;
            return;
        }

        // Find system Python
        const systemPython = await this._findSystemPython();
        if (!systemPython) {
            throw new Error(
                'Python 3 not found. Please install Python 3.x and ensure it is on your PATH. ' +
                'Download from https://www.python.org/downloads/'
            );
        }
        Logger.info(`Found system Python: ${systemPython}`);

        // Show progress to the user
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Dataset Lens: Setting up Python environment',
                cancellable: false,
            },
            async (progress) => {
                // Ensure globalStorage directory exists
                await fs.promises.mkdir(globalStoragePath, { recursive: true });

                // Create venv
                progress.report({ message: 'Creating virtual environment...' });
                await this._runCommand(systemPython, ['-m', 'venv', this.venvPath]);
                Logger.info(`Created venv at ${this.venvPath}`);

                // Upgrade pip
                progress.report({ message: 'Upgrading pip...' });
                await this._runCommand(this.pythonPath, ['-m', 'pip', 'install', '--upgrade', 'pip']);

                // Install requirements
                progress.report({ message: 'Installing packages (pandas, pyreadstat, pyreadr)...' });
                const requirementsPath = path.join(context.extensionPath, 'python', 'requirements.txt');
                await this._runCommand(this.pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath]);

                Logger.info('Python environment setup complete');
                vscode.window.showInformationMessage('Dataset Lens: Python environment ready.');
            }
        );

        this.ready = true;
    }

    /**
     * Check if the venv exists and has the required packages.
     */
    private async _isVenvValid(): Promise<boolean> {
        try {
            await fs.promises.access(this.pythonPath);
        } catch {
            return false;
        }

        // Verify key packages are importable
        try {
            await this._runCommand(this.pythonPath, [
                '-c',
                'import pandas; import pyreadstat; import pyreadr'
            ]);
            return true;
        } catch {
            Logger.info('Venv exists but packages are missing, will reinstall');
            return false;
        }
    }

    /**
     * Find a working system Python 3 executable.
     */
    private async _findSystemPython(): Promise<string | null> {
        const candidates = process.platform === 'win32'
            ? ['py', 'python', 'python3']
            : ['python3', 'python'];

        for (const cmd of candidates) {
            try {
                const version = await this._runCommand(cmd, ['--version']);
                if (version.includes('Python 3')) {
                    return cmd;
                }
            } catch {
                // Try next candidate
            }
        }
        return null;
    }

    /**
     * Run a command and return stdout.
     */
    private _runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, { shell: true });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Command "${command} ${args.join(' ')}" failed (code ${code}): ${stderr}`));
                }
            });

            proc.on('error', (err) => {
                reject(err);
            });
        });
    }
}
