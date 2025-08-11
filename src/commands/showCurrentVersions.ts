import * as vscode from 'vscode';

import { generateVersionsHTML } from '../ui/versionsView';
import { detectProjectType } from '../utils/fileUtils';
import { getCurrentVersions } from '../utils/versionUtils';

let versionsPanel: vscode.WebviewPanel | undefined;

export async function refreshVersionsPanel(context?: vscode.ExtensionContext): Promise<void> {
    if (!versionsPanel) {
        return;
    }

    try {
        const versions = await getCurrentVersions();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const projectType = await detectProjectType(rootPath);

        let logoUri: vscode.Uri | undefined;
        if (context) {
            const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
            logoUri = versionsPanel.webview.asWebviewUri(onDiskPath);
        }

        versionsPanel.webview.html = await generateVersionsHTML(versions, projectType, logoUri, rootPath);
    } catch (error) {
        console.error('Error refreshing versions panel:', error);
    }
}

export async function showCurrentVersions(context?: vscode.ExtensionContext) {
    try {
        const versions = await getCurrentVersions();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const projectType = await detectProjectType(rootPath);

        if (versionsPanel) {
            let logoUri: vscode.Uri | undefined;
            if (context) {
                const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
                logoUri = versionsPanel.webview.asWebviewUri(onDiskPath);
            }
            versionsPanel.webview.html = await generateVersionsHTML(versions, projectType, logoUri, rootPath);
            versionsPanel.reveal();
            return;
        }

        versionsPanel = vscode.window.createWebviewPanel(
            'versionOverview',
            `React Native Version Bumper - Version Overview`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        if (context) {
            const iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
            versionsPanel.iconPath = iconPath;
        }

        // Clear reference when panel is closed
        versionsPanel.onDidDispose(() => {
            versionsPanel = undefined;
        });

        // Auto-refresh panel data when user switches to this tab
        versionsPanel.onDidChangeViewState((e) => {
            if (e.webviewPanel.visible) {
                refreshVersionsPanel(context);
            }
        });

        let logoUri: vscode.Uri | undefined;
        if (context) {
            const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
            logoUri = versionsPanel.webview.asWebviewUri(onDiskPath);
        }

        versionsPanel.webview.html = await generateVersionsHTML(versions, projectType, logoUri, rootPath);
    } catch (error) {
        vscode.window.showErrorMessage(`Error getting versions: ${error}`);
    }
}
