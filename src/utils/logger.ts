import * as vscode from 'vscode';

/**
 * Logging levels for the extension
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Centralized logging utility for the Dataset Lens extension
 * Provides proper VS Code output channel logging with configurable levels
 */
export class Logger {
    private static instance: Logger;
    private static outputChannel: vscode.OutputChannel;
    private static logLevel: LogLevel = LogLevel.INFO;

    /**
     * Initialize the logger with an output channel
     * @param channelName - Name of the output channel
     */
    static initialize(channelName: string): void {
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel(channelName);
            Logger.instance = new Logger();

            // Check if debug logging is enabled via configuration
            const config = vscode.workspace.getConfiguration('sasDataExplorer');
            const enableDebugLogging = config.get<boolean>('enableDebugLogging', false);
            Logger.logLevel = enableDebugLogging ? LogLevel.DEBUG : LogLevel.INFO;
        }
    }

    /**
     * Set the minimum log level
     * @param level - Minimum log level to display
     */
    static setLogLevel(level: LogLevel): void {
        Logger.logLevel = level;
    }

    /**
     * Log a debug message (only shown when debug logging is enabled)
     * @param message - Message to log
     * @param data - Optional data to include
     */
    static debug(message: string, data?: any): void {
        Logger.log(LogLevel.DEBUG, 'DEBUG', message, data);
    }

    /**
     * Log an info message
     * @param message - Message to log
     * @param data - Optional data to include
     */
    static info(message: string, data?: any): void {
        Logger.log(LogLevel.INFO, 'INFO', message, data);
    }

    /**
     * Log a warning message
     * @param message - Message to log
     * @param data - Optional data to include
     */
    static warn(message: string, data?: any): void {
        Logger.log(LogLevel.WARN, 'WARN', message, data);
    }

    /**
     * Log an error message
     * @param message - Message to log
     * @param data - Optional error data or Error object
     */
    static error(message: string, data?: any): void {
        Logger.log(LogLevel.ERROR, 'ERROR', message, data);

        // Also show error notification for critical errors
        if (data instanceof Error) {
            vscode.window.showErrorMessage(`Dataset Lens: ${message}`);
        }
    }

    /**
     * Internal logging method
     * @param level - Log level
     * @param levelName - Log level name for display
     * @param message - Message to log
     * @param data - Optional data to include
     */
    private static log(level: LogLevel, levelName: string, message: string, data?: any): void {
        if (level < Logger.logLevel || !Logger.outputChannel) {
            return;
        }

        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${levelName}] ${message}`;

        if (data !== undefined) {
            if (data instanceof Error) {
                logMessage += `\nError: ${data.message}\nStack: ${data.stack}`;
            } else if (typeof data === 'object') {
                logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
            } else {
                logMessage += `\nData: ${data}`;
            }
        }

        Logger.outputChannel.appendLine(logMessage);
    }

    /**
     * Show the output channel (useful for debugging)
     */
    static show(): void {
        if (Logger.outputChannel) {
            Logger.outputChannel.show();
        }
    }

    /**
     * Clear the output channel
     */
    static clear(): void {
        if (Logger.outputChannel) {
            Logger.outputChannel.clear();
        }
    }

    /**
     * Dispose of the logger and clean up resources
     */
    static dispose(): void {
        if (Logger.outputChannel) {
            Logger.outputChannel.dispose();
        }
    }

    /**
     * Create a scoped logger for a specific component
     * @param scope - Component name or scope identifier
     * @returns Object with scoped logging methods
     */
    static createScoped(scope: string) {
        return {
            debug: (message: string, data?: any) => Logger.debug(`[${scope}] ${message}`, data),
            info: (message: string, data?: any) => Logger.info(`[${scope}] ${message}`, data),
            warn: (message: string, data?: any) => Logger.warn(`[${scope}] ${message}`, data),
            error: (message: string, data?: any) => Logger.error(`[${scope}] ${message}`, data)
        };
    }
}