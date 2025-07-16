import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { bumpAppVersion } from './commands/bumpAppVersion';
import { bumpVersionByType } from './commands/bumpVersionByType';
import { showCurrentVersions } from './commands/showCurrentVersions';
import { registerVersionCodeLensProvider, VersionCodeLensProvider } from './providers/codeLensProvider';
import { isReactNativeProject } from './utils/fileUtils';
import { getCurrentVersions } from './utils/versionUtils';
import { CONFIG_ENABLE_CODE_LENS, CONFIG_SHOW_IN_STATUS_BAR } from './constants';

let statusBarItem: vscode.StatusBarItem;
let codeLensProvider: VersionCodeLensProvider;
let codeLensDisposable: vscode.Disposable;

export function activate(context: vscode.ExtensionContext) {
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
            await vscode.workspace
                .getConfiguration('reactNativeVersionBumper')
                .update(CONFIG_ENABLE_CODE_LENS, true, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('Code Lens is now enabled');
            codeLensDisposable.dispose();
            codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);
            context.subscriptions.push(codeLensDisposable);
            codeLensProvider.refresh();
        }),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.hideCodeLens', async () => {
            await vscode.workspace
                .getConfiguration('reactNativeVersionBumper')
                .update(CONFIG_ENABLE_CODE_LENS, false, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('Code Lens is now disabled');
            codeLensDisposable.dispose();
            codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);
            context.subscriptions.push(codeLensDisposable);
            codeLensProvider.refresh();
        }),
    ];

    context.subscriptions.push(statusBarItem, ...commands);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('reactNativeVersionBumper.enableCodeLens')) {
                codeLensDisposable.dispose();
                codeLensDisposable = registerVersionCodeLensProvider(context, codeLensProvider);
                context.subscriptions.push(codeLensDisposable);
                codeLensProvider.refresh();
            }
        })
    );

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
