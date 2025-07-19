import * as vscode from 'vscode';

import { CONFIG_SHOW_IN_STATUS_BAR } from '../constants';

import { isReactNativeProject } from './fileUtils';
import { getPackageJsonName } from './packageUtils';
import { getCurrentVersions } from './versionUtils';

let statusBarItem: vscode.StatusBarItem;

export function initializeStatusBar(): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'vscode-react-native-version-bumper.showVersions';
    updateStatusBar();
    statusBarItem.show();

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());
}

export async function updateStatusBar(): Promise<void> {
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

        statusBarItem.text = `📱 ${projectName}: v${packageVersion}`;
        statusBarItem.tooltip = 'Click to show all versions';
        statusBarItem.show();
    } catch {
        statusBarItem.text = `📱 Version Bumper`;
        statusBarItem.tooltip = 'React Native Version Bumper';
        statusBarItem.show();
    }
}

export function disposeStatusBar(): void {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
