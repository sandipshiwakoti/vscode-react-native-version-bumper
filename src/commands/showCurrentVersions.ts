import * as vscode from 'vscode';

import { generateVersionsHTML } from '../ui/versionsView';
import { detectProjectType } from '../utils/fileUtils';
import { getCurrentVersions } from '../utils/versionUtils';

export async function showCurrentVersions() {
    try {
        const versions = await getCurrentVersions();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const projectType = await detectProjectType(rootPath);
        const panel = vscode.window.createWebviewPanel('currentVersions', 'Current Versions', vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        panel.webview.html = generateVersionsHTML(versions, projectType);
    } catch (error) {
        vscode.window.showErrorMessage(`Error getting versions: ${error}`);
    }
}
