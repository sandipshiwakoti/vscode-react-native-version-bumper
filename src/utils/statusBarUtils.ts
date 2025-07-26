import * as vscode from 'vscode';

import { COMMANDS, CONFIG, DEFAULT_VALUES, EXTENSION_ID } from '../constants';
import { getPackageJsonName } from '../services/platformService';

import { isReactNativeProject } from './fileUtils';
import { getCurrentVersions } from './versionUtils';

let statusBarItem: vscode.StatusBarItem;

export function initializeStatusBar(): void {
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        DEFAULT_VALUES.STATUS_BAR_PRIORITY
    );
    statusBarItem.command = COMMANDS.SHOW_VERSIONS;
    updateStatusBar();
    statusBarItem.show();

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());
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
            platforms.push('Android');
        }
        if (versions.ios) {
            platforms.push('iOS');
        }

        const allVersions = [versions.packageJson, versions.android?.versionName, versions.ios?.version].filter(
            Boolean
        );
        const uniqueVersions = [...new Set(allVersions)];
        const isSynced = uniqueVersions.length <= 1 && allVersions.length > 1;
        const syncIndicator = allVersions.length > 1 ? (isSynced ? '🟢' : '🟡') : '';

        statusBarItem.text = `⚛️ ${projectName}: v${packageVersion} ${syncIndicator}`;

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
        tooltip += `\nClick to view detailed version information`;

        statusBarItem.tooltip = tooltip;
        statusBarItem.show();
    } catch {
        statusBarItem.text = `⚛️ Version Bumper`;
        statusBarItem.tooltip = 'React Native Version Bumper\n\nClick to view current versions';
        statusBarItem.show();
    }
}

export function disposeStatusBar(): void {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
