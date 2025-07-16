import * as vscode from 'vscode';

import { exec } from 'child_process';
import { promisify } from 'util';

import { PLATFORM_ICONS } from '../constants';
import { BumpResult, BumpType, PlatformKey } from '../types';

const execAsync = promisify(exec);

export function generateResultsHTML(
    type: BumpType,
    results: BumpResult[],
    tagName: string = '',
    branchName: string = '',
    hasCommit: boolean = false,
    pushSuccess = false
): string {
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const hasErrors = results.some((r) => !r.success);

    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Version Bump Results</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    margin-bottom: 30px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                }
                .project-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-left: 10px;
                }
                .summary {
                    background-color: ${hasErrors ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-inputValidation-infoBackground)'};
                    border: 1px solid ${hasErrors ? 'var(--vscode-inputValidation-warningBorder)' : 'var(--vscode-inputValidation-infoBorder)'};
                    border-radius: 6px;
                    padding: 15px;
                    margin-bottom: 25px;
                }
                .version-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background-color: var(--vscode-input-background);
                    border-radius: 6px;
                    border: 1px solid var(--vscode-input-border);
                }
                .version-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .version-item {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .version-label {
                    font-weight: 500;
                    color: var(--vscode-descriptionForeground);
                }
                .version-value {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    color: var(--vscode-textPreformat-foreground);
                }
                .not-found {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                }
                .emoji {
                    margin-right: 8px;
                }
                .result-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid var(--vscode-input-border);
                }
                .result-success {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-color: var(--vscode-inputValidation-infoBorder);
                }
                .result-error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border-color: var(--vscode-inputValidation-errorBorder);
                }
                .result-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .result-icon {
                    margin-right: 10px;
                    font-size: 18px;
                }
                .result-platform {
                    font-weight: bold;
                    font-size: 16px;
                }
                .result-message {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-top: 8px;
                    font-size: 14px;
                    white-space: pre-wrap;
                }
                .result-error-message {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                    margin-top: 8px;
                }
                .bump-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-left: 10px;
                }
                .action-buttons {
                    margin-top: 20px;
                    display: flex;
                    gap: 10px;
                }
                .action-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                }
                .action-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .action-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 Version Bump Results</h1>
                <span class="bump-type">${type}</span>
            </div>
            <div class="summary">
                <strong>Summary:</strong> ${successCount}/${totalCount} operations completed successfully
                ${hasErrors ? '<br><strong>⚠️ Some operations failed - check details below</strong>' : ''}
            </div>
    `;

    results.forEach((result) => {
        const icon = PLATFORM_ICONS[result.platform as PlatformKey] || '📱';
        const statusIcon = result.success ? '✅' : '❌';

        html += `
            <div class="version-section ${result.success ? 'result-success' : 'result-error'}">
                <div class="version-title">
                    <span class="result-icon">${icon}</span>
                    <span class="result-platform">${result.platform}</span>
                    <span class="result-icon" style="margin-left: auto;">${statusIcon}</span>
                </div>
                ${
                    result.message
                        ? `<div class="result-message">${result.message}</div>`
                        : result.error
                          ? `<div class="result-error-message">❌ ${result.error}</div>`
                          : ''
                }
            </div>
        `;
    });

    // Add action buttons if tag or branch+commit were created
    if (tagName || (branchName && hasCommit)) {
        html += `<div class="action-buttons">`;

        if (tagName) {
            html += `
                <button class="action-button" id="createReleaseBtn">
                    <span class="emoji">🏷️</span> Create new release for ${tagName}
                </button>
            `;
        }

        if (branchName && hasCommit && pushSuccess) {
            html += `
                <button class="action-button" id="createPRBtn">
                    <span class="emoji">🔀</span> Create PR for branch ${branchName}
                </button>
            `;
        }

        html += `</div>`;
    }

    // Add script to handle button clicks
    html += `
        <script>
            const vscode = acquireVsCodeApi();
            
            document.addEventListener('DOMContentLoaded', () => {
                const createReleaseBtn = document.getElementById('createReleaseBtn');
                if (createReleaseBtn) {
                    createReleaseBtn.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'createRelease'
                        });
                    });
                }
                
                const createPRBtn = document.getElementById('createPRBtn');
                if (createPRBtn) {
                    createPRBtn.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'createPR'
                        });
                    });
                }
            });
        </script>
    `;

    html += `
        </body>
        </html>
    `;

    return html;
}

export function showBumpResults(type: BumpType, results: BumpResult[]) {
    const panel = vscode.window.createWebviewPanel(
        'versionBumpResults',
        `Version Bump Results - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    // Extract Git operation results
    const gitResult = results.find((r) => r.platform === 'Git');
    let tagName = '';
    let branchName = '';
    let hasCommit = false;
    let pushSuccess = false;

    if (gitResult && gitResult.success) {
        // Extract tag name if a tag was created
        const tagMatch = gitResult.message.match(/Tagged ([\w.-]+)/i);
        if (tagMatch) {
            tagName = tagMatch[1];
        }

        // Extract branch name if a branch was created
        const branchMatch = gitResult.message.match(/branch "([^"]+)"/i);
        if (branchMatch) {
            branchName = branchMatch[1];
        }

        // Check if commit was created
        hasCommit = gitResult.message.includes('Commit: ✅');

        // Check if push was successful
        pushSuccess = gitResult.message.includes('Push: ✅');
    }

    panel.webview.html = generateResultsHTML(type, results, tagName, branchName, hasCommit, pushSuccess);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const rootPath = workspaceFolders[0].uri.fsPath;

            // Get repository URL from Git instead of package.json
            let repoUrl = '';
            try {
                // Try to get the remote URL from Git
                const { stdout } = await execAsync('git config --get remote.origin.url', {
                    cwd: rootPath,
                });

                repoUrl = stdout.trim();

                // Clean up the URL if it's a git URL
                repoUrl = repoUrl.replace(/\.git$/, '').replace(/^git\+/, '');
                if (repoUrl.startsWith('git@github.com:')) {
                    repoUrl = repoUrl.replace('git@github.com:', 'https://github.com/');
                }
            } catch (error) {
                console.error('Error getting Git remote URL:', error);
                vscode.window.showErrorMessage(
                    'Could not determine repository URL from Git. Make sure you have a remote configured.'
                );
                return;
            }

            if (!repoUrl) {
                vscode.window.showErrorMessage('Repository URL not found. Make sure you have a Git remote configured.');
                return;
            }

            switch (message.command) {
                case 'createRelease':
                    if (tagName) {
                        const releaseUrl = `${repoUrl}/releases/new?tag=${tagName}`;
                        vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
                    }
                    break;

                case 'createPR':
                    if (branchName && hasCommit) {
                        // For GitHub, the URL format is typically:
                        // https://github.com/owner/repo/compare/branchName?expand=1
                        const prUrl = `${repoUrl}/compare/${branchName}?expand=1`;
                        vscode.env.openExternal(vscode.Uri.parse(prUrl));
                    }
                    break;
            }
        },
        undefined,
        []
    );
}
