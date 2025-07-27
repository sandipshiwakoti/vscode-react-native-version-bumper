import * as vscode from 'vscode';

import { isCodeLensEnabled } from '../commands/toggleCodeLens';
import { COMMANDS, CONFIG, DEFAULT_VALUES, EXTENSION_ID, FILE_EXTENSIONS, FILE_PATTERNS } from '../constants';
import { Platform } from '../types';
import { isReactNativeProject } from '../utils/fileUtils';
import { getCurrentVersions } from '../utils/versionUtils';

import {
    getAndroidCodeLenses,
    getIOSCodeLenses,
    getPackageJsonCodeLenses,
    getPackageJsonName,
} from './platformService';

let statusBarItem: vscode.StatusBarItem;
let onDidChangeCodeLensesEmitter: vscode.EventEmitter<void>;
let textDocumentListener: vscode.Disposable;
let fileWatchers: vscode.FileSystemWatcher[] = [];
let documentSaveListener: vscode.Disposable;

export function initializeStatusBar(): void {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        DEFAULT_VALUES.STATUS_BAR_PRIORITY
    );
    statusBarItem.command = COMMANDS.SHOW_VERSIONS;
    updateStatusBar();
    statusBarItem.show();

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());

    setupFileWatchers();

    documentSaveListener = vscode.workspace.onDidSaveTextDocument((document) => {
        if (
            document.fileName.endsWith(FILE_EXTENSIONS.PACKAGE_JSON) ||
            document.fileName.endsWith(FILE_EXTENSIONS.BUILD_GRADLE) ||
            document.fileName.endsWith(FILE_EXTENSIONS.INFO_PLIST) ||
            document.fileName.endsWith(FILE_EXTENSIONS.PROJECT_PBXPROJ)
        ) {
            updateStatusBar();
        }
    });
}

function setupFileWatchers(): void {
    fileWatchers.forEach((watcher) => watcher.dispose());
    fileWatchers = [];

    const packageJsonWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
    packageJsonWatcher.onDidChange(() => updateStatusBar());
    packageJsonWatcher.onDidCreate(() => updateStatusBar());
    packageJsonWatcher.onDidDelete(() => updateStatusBar());
    fileWatchers.push(packageJsonWatcher);

    const buildGradleWatcher = vscode.workspace.createFileSystemWatcher('**/build.gradle');
    buildGradleWatcher.onDidChange(() => updateStatusBar());
    buildGradleWatcher.onDidCreate(() => updateStatusBar());
    buildGradleWatcher.onDidDelete(() => updateStatusBar());
    fileWatchers.push(buildGradleWatcher);

    const infoPlistWatcher = vscode.workspace.createFileSystemWatcher('**/Info.plist');
    infoPlistWatcher.onDidChange(() => updateStatusBar());
    infoPlistWatcher.onDidCreate(() => updateStatusBar());
    infoPlistWatcher.onDidDelete(() => updateStatusBar());
    fileWatchers.push(infoPlistWatcher);

    const pbxprojWatcher = vscode.workspace.createFileSystemWatcher('**/project.pbxproj');
    pbxprojWatcher.onDidChange(() => updateStatusBar());
    pbxprojWatcher.onDidCreate(() => updateStatusBar());
    pbxprojWatcher.onDidDelete(() => updateStatusBar());
    fileWatchers.push(pbxprojWatcher);
}

export async function updateStatusBar(): Promise<void> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    if (!config.get(CONFIG.SHOW_IN_STATUS_BAR, true)) {
        statusBarItem.hide();
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        statusBarItem.hide();
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    if (!isReactNativeProject(rootPath)) {
        statusBarItem.hide();
        return;
    }

    try {
        const versions = await getCurrentVersions();
        const packageVersion = versions.packageJson || 'N/A';
        let projectName = 'Version Bumper';

        const packageName = getPackageJsonName(rootPath);
        if (packageName) {
            projectName = packageName;
        }

        const platforms = [];
        if (versions.packageJson) {
            platforms.push('Package.json');
        }
        if (versions.android) {
            platforms.push(Platform.ANDROID);
        }
        if (versions.ios) {
            platforms.push(Platform.IOS);
        }

        const allVersions = [versions.packageJson, versions.android?.versionName, versions.ios?.version].filter(
            Boolean
        );
        const uniqueVersions = [...new Set(allVersions)];
        const isSynced = uniqueVersions.length <= 1 && allVersions.length > 1;

        statusBarItem.text = `$(arrow-circle-up) Version Bumper: v${packageVersion}`;

        let tooltip = `React Native Version Bumper\n\n`;
        tooltip += `Project: ${projectName}\n`;
        tooltip += `Package.json: ${packageVersion}\n`;
        if (versions.android) {
            tooltip += `Android: ${versions.android.versionName} (${versions.android.versionCode})\n`;
        }
        if (versions.ios) {
            tooltip += `iOS: ${versions.ios.version} (${versions.ios.buildNumber})\n`;
        }
        tooltip += `\nPlatforms: ${platforms.join(', ')} (${platforms.length}/3)\n`;
        if (allVersions.length > 1) {
            tooltip += `Sync Status: ${isSynced ? 'Synced ✅' : 'Different versions ⚠️'}\n`;
        }
        tooltip += `\nClick to view version overview`;

        statusBarItem.tooltip = tooltip;
        statusBarItem.show();
    } catch {
        statusBarItem.text = `$(arrow-circle-up) Version Bumper`;
        statusBarItem.tooltip = 'React Native Version Bumper\n\nClick to view version overview';
        statusBarItem.show();
    }
}

export function disposeStatusBar(): void {
    if (statusBarItem) {
        statusBarItem.dispose();
    }

    fileWatchers.forEach((watcher) => watcher.dispose());
    fileWatchers = [];

    if (documentSaveListener) {
        documentSaveListener.dispose();
    }
}

export function initializeCodeLensProvider(): vscode.CodeLensProvider {
    onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

    textDocumentListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (
            e.document.fileName.endsWith(FILE_EXTENSIONS.PACKAGE_JSON) ||
            e.document.fileName.endsWith(FILE_EXTENSIONS.BUILD_GRADLE) ||
            e.document.fileName.endsWith(FILE_EXTENSIONS.INFO_PLIST) ||
            e.document.fileName.endsWith(FILE_EXTENSIONS.PROJECT_PBXPROJ)
        ) {
            onDidChangeCodeLensesEmitter.fire();
        }
    });

    return {
        onDidChangeCodeLenses: onDidChangeCodeLensesEmitter.event,
        provideCodeLenses: async (document: vscode.TextDocument): Promise<vscode.CodeLens[]> => {
            if (!isCodeLensEnabled()) {
                return [];
            }

            if (document.fileName.endsWith(FILE_EXTENSIONS.PACKAGE_JSON)) {
                return getPackageJsonCodeLenses(document);
            }

            if (document.fileName.endsWith(FILE_EXTENSIONS.BUILD_GRADLE)) {
                return getAndroidCodeLenses(document);
            }

            if (document.fileName.endsWith(FILE_EXTENSIONS.INFO_PLIST)) {
                return await getIOSCodeLenses(document);
            }

            return [];
        },
    };
}

export function refreshCodeLenses(): void {
    if (onDidChangeCodeLensesEmitter) {
        onDidChangeCodeLensesEmitter.fire();
    }
}

export function disposeCodeLensProvider(): void {
    if (onDidChangeCodeLensesEmitter) {
        onDidChangeCodeLensesEmitter.dispose();
    }
    if (textDocumentListener) {
        textDocumentListener.dispose();
    }
}

export function registerCodeLensProvider(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = initializeCodeLensProvider();

    const disposable = vscode.languages.registerCodeLensProvider(
        [
            { language: 'json', pattern: FILE_PATTERNS.PACKAGE_JSON_PATTERN },
            { pattern: FILE_PATTERNS.BUILD_GRADLE_PATTERN },
            { pattern: FILE_PATTERNS.INFO_PLIST_PATTERN },
        ],
        provider
    );

    context.subscriptions.push(disposable);
    return disposable;
}
