import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { exec } from 'child_process';
import { promisify } from 'util';

import { generateReleaseNotes } from '../services/gitService';
import { readIOSVersionInfo } from '../services/platformService';
import { refreshCodeLenses } from '../services/uiService';
import {
    BumpResult,
    BumpType,
    GitWorkflowResult,
    IOSVersionInfo,
    Platform,
    WebviewCommand,
    WebviewMessage,
} from '../types';
import { getAppName } from '../utils/fileUtils';

import { generatePageHeaderHTML, PAGE_HEADER_CSS, SHARED_BASE_CSS } from './shared/pageHeader';
import { generateVersionCardHTML, VERSION_CARD_CSS } from './shared/versionCard';

const execAsync = promisify(exec);

let resultsPanel: vscode.WebviewPanel | undefined;

export async function generateResultsHTML(
    type: BumpType,
    results: BumpResult[],
    tagName: string = '',
    branchName: string = '',
    hasCommit: boolean = false,
    pushSuccess = false,
    logoUri?: vscode.Uri,
    rootPath?: string
): Promise<string> {
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const hasErrors = results.some((r) => !r.success);

    let iosVersionInfo: IOSVersionInfo | null = null;
    let iosPath = 'ios/[AppName]/Info.plist';

    if (rootPath) {
        try {
            const appName = getAppName(rootPath);
            if (appName) {
                iosPath = `ios/${appName}/Info.plist`;
            }
            iosVersionInfo = await readIOSVersionInfo(rootPath);
        } catch {}
    }

    const headerHTML = generatePageHeaderHTML({
        title: 'React Native Version Bumper',
        subtitle: 'Version Update Results',
        logoUri: logoUri,
    });

    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>React Native Version Bumper - Results</title>
            <style>
                ${SHARED_BASE_CSS}
                ${PAGE_HEADER_CSS}

                .summary {
                    background: ${hasErrors ? 'linear-gradient(135deg, var(--vscode-inputValidation-warningBackground) 0%, rgba(245, 158, 11, 0.1) 100%)' : 'linear-gradient(135deg, var(--vscode-inputValidation-infoBackground) 0%, rgba(34, 197, 94, 0.1) 100%)'};
                    border: 1px solid ${hasErrors ? 'var(--vscode-inputValidation-warningBorder)' : 'var(--vscode-inputValidation-infoBorder)'};
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 24px;
                    font-weight: 500;
                    position: relative;
                    overflow: hidden;
                }

                .summary::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: ${hasErrors ? 'linear-gradient(90deg, #f59e0b, #f97316)' : 'linear-gradient(90deg, #22c55e, #16a34a)'};
                }

                .summary-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .summary-icon {
                    width: 24px;
                    height: 24px;
                    flex-shrink: 0;
                }

                .summary-text {
                    flex: 1;
                }

                .summary-text > strong {
                    font-size: 1.1rem;
                }

                .summary-stats {
                    display: flex;
                    gap: 24px;
                    margin-top: 12px;
                    font-size: 0.9rem;
                    opacity: 0.9;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                }

                .results-container {
                    display: grid;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                ${VERSION_CARD_CSS.replace(/version-card/g, 'result-card').replace(/version-/g, 'result-')}

                .action-section {
                    background: linear-gradient(135deg, var(--vscode-input-background) 0%, rgba(59, 130, 246, 0.05) 100%);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 12px;
                    padding: 24px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }

                .action-section::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
                }

                .action-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--vscode-textLink-foreground);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .action-subtitle {
                    font-size: 0.9rem;
                    opacity: 0.7;
                    margin-bottom: 20px;
                }

                .action-buttons {
                    display: flex;
                    gap: 16px;
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
            ${headerHTML}

            <div class="summary">
                <div class="summary-content">
                    <svg class="summary-icon" viewBox="0 0 24 24" fill="${hasErrors ? '#f59e0b' : '#22c55e'}">
                        ${
                            hasErrors
                                ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><path d="M12 7c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1s-1-.45-1-1V8c0-.55.45-1 1-1zm-1 9h2v2h-2z"/>'
                                : '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
                        }
                    </svg>
                    <div class="summary-text">
                        <strong>${hasErrors ? 'Partial Success' : 'All Operations Completed'}</strong>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span>Successful: <strong>${successCount}</strong></span>
                            </div>
                            ${hasErrors ? `<div class="stat-item"><span>Failed: <strong>${totalCount - successCount}</strong></span></div>` : ''}
                            <div class="stat-item">
                                <span>Total: <strong>${totalCount}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="results-container">
    `;

    results.forEach((result) => {
        let location = '';

        switch (result.platform) {
            case Platform.PACKAGE_JSON:
                location = 'package.json';
                break;
            case Platform.ANDROID:
                location = 'android/app/build.gradle';
                break;
            case Platform.IOS:
                location = iosPath;
                break;
            case Platform.EXPO:
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    const rootPath = workspaceFolders[0].uri.fsPath;
                    const appConfigTsPath = path.join(rootPath, 'app.config.ts');
                    const appConfigJsPath = path.join(rootPath, 'app.config.js');
                    const appJsonPath = path.join(rootPath, 'app.json');

                    if (fs.existsSync(appConfigTsPath)) {
                        location = 'app.config.ts';
                    } else if (fs.existsSync(appConfigJsPath)) {
                        location = 'app.config.js';
                    } else if (fs.existsSync(appJsonPath)) {
                        location = 'app.json';
                    } else {
                        location = 'app.json';
                    }
                } else {
                    location = 'app.json';
                }
                break;
        }

        html += generateVersionCardHTML(
            {
                platform: result.platform,
                success: result.success,
                oldVersion: result.oldVersion,
                newVersion: result.newVersion,
                location: location,
                iosVersionInfo: iosVersionInfo,
                message: result.message,
                error: result.error,
            },
            true,
            'result'
        );
    });

    html += `</div>`;

    const hasReleaseAction = tagName && pushSuccess;
    const hasPRAction = branchName && hasCommit && pushSuccess;

    if (hasReleaseAction || hasPRAction) {
        html += `
            <div class="action-section">
                <h2 class="action-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Next Steps
                </h2>
                <div class="action-subtitle">Ready to publish your version updates</div>
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
                            vscode.postMessage({ command: '${WebviewCommand.CREATE_RELEASE}' });
                        });
                    }
                    
                    const createPRBtn = document.getElementById('createPRBtn');
                    if (createPRBtn) {
                        createPRBtn.addEventListener('click', () => {
                            vscode.postMessage({ command: '${WebviewCommand.CREATE_PR}' });
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;

    return html;
}

export async function showBumpResults(
    type: BumpType,
    results: BumpResult[],
    context?: vscode.ExtensionContext,
    gitWorkflowResult?: GitWorkflowResult
) {
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
        const gitResult = results.find((r) => r.platform === Platform.GIT);
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

    let logoUri: vscode.Uri | undefined;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const rootPath = workspaceFolders?.[0]?.uri.fsPath;

    if (resultsPanel) {
        if (context) {
            const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
            logoUri = resultsPanel.webview.asWebviewUri(onDiskPath);
        }

        resultsPanel.webview.html = await generateResultsHTML(
            type,
            results,
            tagName,
            branchName,
            hasCommit,
            pushSuccess,
            logoUri,
            rootPath
        );
        resultsPanel.reveal();
        refreshCodeLenses();
        return;
    }

    resultsPanel = vscode.window.createWebviewPanel(
        'versionBumpResults',
        `React Native Version Bumper - Results`,
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
    );

    // Clear reference when panel is closed
    resultsPanel.onDidDispose(() => {
        resultsPanel = undefined;
    });

    if (context) {
        const onDiskPath = vscode.Uri.joinPath(context.extensionUri, 'assets', 'logo.svg');
        logoUri = resultsPanel.webview.asWebviewUri(onDiskPath);
    }

    resultsPanel.webview.html = await generateResultsHTML(
        type,
        results,
        tagName,
        branchName,
        hasCommit,
        pushSuccess,
        logoUri,
        rootPath
    );

    // Refresh CodeLens to show updated version information
    refreshCodeLenses();

    // Handle messages from the webview
    resultsPanel.webview.onDidReceiveMessage(
        async (message: WebviewMessage) => {
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
                case WebviewCommand.CREATE_RELEASE:
                    if (tagName) {
                        const releaseNotes = await generateReleaseNotes(type, results, tagName, repoUrl);
                        const encodedNotes = encodeURIComponent(releaseNotes);
                        const releaseUrl = `${repoUrl}/releases/new?tag=${tagName}&title=${encodeURIComponent(`Release ${tagName}`)}&body=${encodedNotes}`;
                        vscode.env.openExternal(vscode.Uri.parse(releaseUrl));
                    }
                    break;

                case WebviewCommand.CREATE_PR:
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
