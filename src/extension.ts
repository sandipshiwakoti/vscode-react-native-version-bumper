import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { bumpAppVersion } from './commands/bumpAppVersion';
import { bumpVersionByType } from './commands/bumpVersionByType';
import { showCurrentVersions } from './commands/showCurrentVersions';
import { registerVersionCodeLensProvider, VersionCodeLensProvider } from './providers/codeLensProvider';
import { isReactNativeProject } from './utils/fileUtils';
import { getCurrentVersions } from './utils/versionUtils';
import { CODELENS_CONTEXT_KEY, CODELENS_ENABLED_KEY, CONFIG_SHOW_IN_STATUS_BAR } from './constants';

let statusBarItem: vscode.StatusBarItem;
let codeLensProvider: VersionCodeLensProvider;
let codeLensDisposable: vscode.Disposable;
let extensionContext: vscode.ExtensionContext;

export function isCodeLensEnabled(): boolean {
    if (!extensionContext) {
        return true; // Default to enabled
    }
    return extensionContext.workspaceState.get(CODELENS_ENABLED_KEY, true);
}

export async function setCodeLensEnabled(enabled: boolean): Promise<void> {
    if (!extensionContext) {
        return;
    }
    await extensionContext.workspaceState.update(CODELENS_ENABLED_KEY, enabled);
    await vscode.commands.executeCommand('setContext', CODELENS_CONTEXT_KEY, enabled);
}

function updateCodeLensContext(): void {
    const enabled = isCodeLensEnabled();
    vscode.commands.executeCommand('setContext', CODELENS_CONTEXT_KEY, enabled);
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;

    updateCodeLensContext();

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'vscode-react-native-version-bumper.showVersions';
    updateStatusBar();
    statusBarItem.show();

    // Create and store the CodeLens provider instance
    codeLensProvider = new VersionCodeLensProvider();
    context.subscriptions.push(codeLensProvider);

    // Register the CodeLens provider and store the disposable
    codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);

    const commands = [
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpAppVersion', () =>
            bumpAppVersion(false)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpAppVersionWithGit', () =>
            bumpAppVersion(true)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.showVersions', showCurrentVersions),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpPatch', () =>
            bumpVersionByType('patch')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpMinor', () =>
            bumpVersionByType('minor')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpMajor', () =>
            bumpVersionByType('major')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.showCodeLens', async () => {
            await setCodeLensEnabled(true);
            vscode.window.showInformationMessage('Code Lens is now enabled');
            codeLensDisposable.dispose();
            codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);
            context.subscriptions.push(codeLensDisposable);
            codeLensProvider.refresh();
        }),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.hideCodeLens', async () => {
            await setCodeLensEnabled(false);
            vscode.window.showInformationMessage('Code Lens is now disabled');
            codeLensDisposable.dispose();
            codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);
            context.subscriptions.push(codeLensDisposable);
            codeLensProvider.refresh();
        }),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.isCodeLensEnabled', () => {
            return isCodeLensEnabled();
        }),
    ];

    context.subscriptions.push(statusBarItem, ...commands);

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());
}

export async function updateStatusBar() {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    if (!config.get(CONFIG_SHOW_IN_STATUS_BAR, true)) {
        statusBarItem.hide();
        return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        statusBarItem.hide();
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Only show status bar for React Native projects
    if (!isReactNativeProject(rootPath)) {
        statusBarItem.hide();
        return;
    }

    try {
        const versions = await getCurrentVersions();
        const packageVersion = versions.packageJson || 'N/A';
        let projectName = 'Version Bumper';

        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            projectName = packageJson.name || 'Version Bumper';
        }

        statusBarItem.text = `📱 ${projectName}: v${packageVersion}`;
        statusBarItem.tooltip = 'Click to show all versions';
        statusBarItem.show();
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
        statusBarItem.text = `📱 Version Bumper`;
        statusBarItem.tooltip = 'React Native Version Bumper';
        statusBarItem.show();
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }

    if (codeLensProvider) {
        codeLensProvider.dispose();
    }
    if (codeLensDisposable) {
        codeLensDisposable.dispose();
    }
}
