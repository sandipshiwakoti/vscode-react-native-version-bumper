import * as vscode from 'vscode';

import { exec } from 'child_process';
import { promisify } from 'util';

import { BumpResult, BumpType, GitWorkflowResult } from '../types';
import { generateReleaseNotes } from '../utils/releaseUtils';

const execAsync = promisify(exec);

export function generateResultsHTML(
    type: BumpType,
    results: BumpResult[],
    tagName: string = '',
    branchName: string = '',
    hasCommit: boolean = false,
    pushSuccess = false,
    logoUri?: vscode.Uri
): string {
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const hasErrors = results.some((r) => !r.success);

    let logoSrc = '';
    if (logoUri) {
        logoSrc = `<img src="${logoUri}" alt="Logo" class="header-logo">`;
    } else {
        logoSrc = `<svg class="header-logo header-logo-svg" viewBox="0 0 24 24">
            <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM6.5 7.5L12 5l5.5 2.5L12 10 6.5 7.5zM4 8.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
        </svg>`;
    }

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
                    padding: 24px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    line-height: 1.6;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .header {
                    text-align: center;
                    margin-bottom: 32px;
                    padding-bottom: 24px;
                    border-bottom: 2px solid var(--vscode-panel-border);
                }

                .header-logo {
                    width: 120px;
                    height: 120px;
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                }

                .header-logo-svg {
                    fill: var(--vscode-textLink-foreground);
                }

                .header h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 8px;
                    color: var(--vscode-textLink-foreground);
                }

                .bump-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .summary {
                    background-color: ${hasErrors ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-inputValidation-infoBackground)'};
                    border: 1px solid ${hasErrors ? 'var(--vscode-inputValidation-warningBorder)' : 'var(--vscode-inputValidation-infoBorder)'};
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 24px;
                    font-weight: 500;
                }

                .results-container {
                    display: grid;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                .result-card {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .result-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .result-card.success {
                    border-left: 4px solid #22c55e;
                }

                .result-card.error {
                    border-left: 4px solid #ef4444;
                }

                .result-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .result-icon {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .icon-svg {
                    width: 24px;
                    height: 24px;
                    fill: var(--vscode-foreground);
                }

                .result-platform {
                    font-size: 1.1rem;
                    font-weight: 600;
                    flex: 1;
                }

                .result-status {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .result-message {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    padding: 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    border: 1px solid var(--vscode-textBlockQuote-border);
                }

                .action-section {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 24px;
                    text-align: center;
                }

                .action-title {
                    font-size: 1.3rem;
                    font-weight: 600;
                    margin-bottom: 20px;
                    color: var(--vscode-textLink-foreground);
                }

                .action-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                    flex-wrap: wrap;
                }

                .action-button {
                    border: none;
                    padding: 10px 16px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    white-space: nowrap;
                }

                .action-button:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
                }

                .action-button:active {
                    transform: translateY(0);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .release-btn {
                    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                    color: white;
                    border: 1px solid #16a34a;
                }

                .release-btn:hover {
                    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
                }

                .pr-btn {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    border: 1px solid #2563eb;
                }

                .pr-btn:hover {
                    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                }

                .button-icon {
                    width: 16px;
                    height: 16px;
                    fill: currentColor;
                    flex-shrink: 0;
                }

                .button-text {
                    font-weight: 600;
                    font-size: 0.9rem;
                }

                .button-info {
                    background-color: rgba(255, 255, 255, 0.25);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    font-family: 'Courier New', monospace;
                    margin-left: 4px;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoSrc}
                <h1>Version Bump Results</h1>
                <div class="bump-type">${type} Update</div>
            </div>

            <div class="summary">
                <strong>Summary:</strong> ${successCount}/${totalCount} operations completed successfully
                ${hasErrors ? '<br><strong>❌ Some operations failed - check details below</strong>' : ''}
            </div>

            <div class="results-container">
    `;

    results.forEach((result) => {
        const statusIcon = result.success
            ? `<svg class="icon-svg" style="fill: #22c55e;" viewBox="0 0 24 24">
                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
               </svg>`
            : `<svg class="icon-svg" style="fill: #ef4444;" viewBox="0 0 24 24">
                 <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
               </svg>`;
        const cardClass = result.success ? 'success' : 'error';

        let iconSvg = '';
        switch (result.platform) {
            case 'Package.json':
                iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM6.5 7.5L12 5l5.5 2.5L12 10 6.5 7.5zM4 8.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                </svg>`;
                break;
            case 'Android':
                iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25S18.25 13.31 18.25 14s-.56 1.25-1.25 1.25z"/>
                </svg>`;
                break;
            case 'iOS':
                iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>`;
                break;
            case 'Git':
                iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                    <path d="M21.62 11.108l-8.731-8.729c-.78-.78-2.047-.78-2.827 0l-1.814 1.814 2.3 2.3c.83-.28 1.777-.095 2.435.563.664.664.848 1.614.564 2.435l2.218 2.218c.83-.28 1.777-.095 2.435.563.93.93.93 2.438 0 3.367-.93.93-2.438.93-3.367 0-.696-.696-.864-1.719-.503-2.58l-2.068-2.068v5.441c.227.112.437.262.618.442.93.93.93 2.438 0 3.367-.93.93-2.438.93-3.367 0-.93-.93-.93-2.438 0-3.367.23-.23.498-.403.786-.525v-5.493c-.288-.122-.556-.295-.786-.525-.697-.697-.864-1.722-.5-2.584l-2.27-2.27-5.993 5.993c-.78.78-.78 2.047 0 2.827l8.729 8.729c.78.78 2.047.78 2.827 0l8.729-8.729c.78-.78.78-2.047 0-2.827z"/>
                </svg>`;
                break;
            default:
                iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>`;
        }

        html += `
            <div class="result-card ${cardClass}">
                <div class="result-header">
                    <div class="result-icon">${iconSvg}</div>
                    <span class="result-platform">${result.platform}</span>
                    <div class="result-status">${statusIcon}</div>
                </div>
                ${
                    result.message || result.error
                        ? `<div class="result-message">${result.message || result.error}</div>`
                        : ''
                }
            </div>
        `;
    });

    html += `</div>`;

    const hasReleaseAction = tagName && pushSuccess;
    const hasPRAction = branchName && hasCommit && pushSuccess;

    if (hasReleaseAction || hasPRAction) {
        html += `
            <div class="action-section">
                <h2 class="action-title">Next Steps</h2>
                <div class="action-buttons">
        `;

        if (hasReleaseAction) {
            html += `
                <button class="action-button release-btn" id="createReleaseBtn" title="Create GitHub release for tag ${tagName}">
                    <svg class="button-icon" viewBox="0 0 24 24">
                        <path d="M9 11H7v3h2v-3zm4 0h-2v3h2v-3zm4 0h-2v3h2v-3zm2-7h-3V2h-2v2H8V2H6v2H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H3V9h18v11z"/>
                    </svg>
                    <span class="button-text">Release</span>
                    <span class="button-info">${tagName}</span>
                </button>
            `;
        }

        if (hasPRAction) {
            html += `
                <button class="action-button pr-btn" id="createPRBtn" title="Create pull request for branch ${branchName}">
                    <svg class="button-icon" viewBox="0 0 24 24">
                        <path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6H6zm0 2h7v5h5v11H6V4zm2 8v2h8v-2H8zm0 4v2h8v-2H8z"/>
                    </svg>
                    <span class="button-text">Pull Request</span>
                    <span class="button-info">${branchName}</span>
                </button>
            `;
        }

        html += `
                </div>
            </div>
        `;
    }

    html += `
            <script>
                const vscode = acquireVsCodeApi();
                
                document.addEventListener('DOMContentLoaded', () => {
                    const createReleaseBtn = document.getElementById('createReleaseBtn');
                    if (createReleaseBtn) {
                        createReleaseBtn.addEventListener('click', () => {
                            vscode.postMessage({ command: 'createRelease' });
                        });
                    }
                    
                    const createPRBtn = document.getElementById('createPRBtn');
                    if (createPRBtn) {
                        createPRBtn.addEventListener('click', () => {
                            vscode.postMessage({ command: 'createPR' });
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;

    return html;
}

export function showBumpResults(
    type: BumpType,
    results: BumpResult[],
    context?: vscode.ExtensionContext,
    gitWorkflowResult?: GitWorkflowResult
) {
    const panel = vscode.window.createWebviewPanel(
        'versionBumpResults',
        `Version Bump Results - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    let logoUri: vscode.Uri | undefined;
    if (context) {
        const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
        logoUri = panel.webview.asWebviewUri(onDiskPath);
    }

    let tagName = '';
    let branchName = '';
    let hasCommit = false;
    let pushSuccess = false;

    if (gitWorkflowResult) {
        tagName = gitWorkflowResult.tagName || '';
        branchName = gitWorkflowResult.branchName || '';
        hasCommit = gitWorkflowResult.commitSuccess;
        pushSuccess = gitWorkflowResult.pushSuccess;
    } else {
        const gitResult = results.find((r) => r.platform === 'Git');
        if (gitResult && gitResult.success) {
            const tagMatch = gitResult.message.match(/Tagged ([\w.-]+)/i);
            if (tagMatch) {
                tagName = tagMatch[1];
            }

            const branchMatch = gitResult.message.match(/branch "([^"]+)"/i);
            if (branchMatch) {
                branchName = branchMatch[1];
            }

            hasCommit = gitResult.message.includes('Commit: Changes committed');

            pushSuccess = gitResult.message.includes('Pushed') && !gitResult.message.includes('❌ Failed to push');
        }
    }

    panel.webview.html = generateResultsHTML(type, results, tagName, branchName, hasCommit, pushSuccess, logoUri);

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
                        const releaseNotes = await generateReleaseNotes(type, results, tagName, repoUrl);
                        const encodedNotes = encodeURIComponent(releaseNotes);
                        const releaseUrl = `${repoUrl}/releases/new?tag=${tagName}&title=${encodeURIComponent(`Release ${tagName}`)}&body=${encodedNotes}`;
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
