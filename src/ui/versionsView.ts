import * as vscode from 'vscode';

import { ProjectType, ProjectVersions } from '../types';

export function generateVersionsHTML(
    versions: ProjectVersions,
    projectType: ProjectType,
    logoUri?: vscode.Uri
): string {
    let logoSrc = '';
    if (logoUri) {
        logoSrc = `<img src="${logoUri}" alt="Logo" class="header-logo">`;
    } else {
        // Fallback to SVG icon
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
            <title>Current Versions</title>
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

                .project-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 6px 16px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .versions-container {
                    display: grid;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                .version-card {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }

                .version-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .version-card.available {
                    border-left: 4px solid #22c55e;
                }

                .version-card.unavailable {
                    border-left: 4px solid #ef4444;
                    opacity: 0.7;
                }

                .version-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 12px;
                }

                .version-icon {
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

                .version-title {
                    font-size: 1.1rem;
                    font-weight: 600;
                    flex: 1;
                }

                .version-status {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .version-message {
                    background-color: var(--vscode-textBlockQuote-background);
                    border-radius: 6px;
                    padding: 12px;
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    white-space: pre-wrap;
                    border: 1px solid var(--vscode-textBlockQuote-border);
                }

                .not-found {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                }

                .sync-status {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                }

                .sync-title {
                    font-size: 1.2rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--vscode-textLink-foreground);
                }

                .sync-message {
                    font-size: 1rem;
                    opacity: 0.8;
                }

                .sync-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-right: 8px;
                }

                .sync-indicator.synced {
                    background-color: #22c55e;
                }

                .sync-indicator.unsynced {
                    background-color: #f59e0b;
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoSrc}
                <h1>Current Versions</h1>
                <div class="project-type">${projectType.replace('-', ' ')}</div>
            </div>

            <div class="versions-container">
    `;

    // Package.json Card
    html += `
        <div class="version-card ${versions.packageJson ? 'available' : 'unavailable'}">
            <div class="version-header">
                <div class="version-icon">
                    <svg class="icon-svg" viewBox="0 0 24 24">
                        <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM6.5 7.5L12 5l5.5 2.5L12 10 6.5 7.5zM4 8.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                    </svg>
                </div>
                <span class="version-title">Package.json</span>
                <div class="version-status">${
                    versions.packageJson
                        ? `<svg class="icon-svg" style="fill: #22c55e;" viewBox="0 0 24 24">
                         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                       </svg>`
                        : `<svg class="icon-svg" style="fill: #ef4444;" viewBox="0 0 24 24">
                         <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                       </svg>`
                }</div>
            </div>
            <div class="version-message">Version: ${versions.packageJson || 'Not found'}</div>
        </div>
    `;

    // Android Card
    html += `
        <div class="version-card ${versions.android ? 'available' : 'unavailable'}">
            <div class="version-header">
                <div class="version-icon">
                    <svg class="icon-svg" viewBox="0 0 24 24">
                        <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25S18.25 13.31 18.25 14s-.56 1.25-1.25 1.25z"/>
                    </svg>
                </div>
                <span class="version-title">Android</span>
                <div class="version-status">${
                    versions.android
                        ? `<svg class="icon-svg" style="fill: #22c55e;" viewBox="0 0 24 24">
                         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                       </svg>`
                        : `<svg class="icon-svg" style="fill: #ef4444;" viewBox="0 0 24 24">
                         <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                       </svg>`
                }</div>
            </div>
            <div class="version-message">${
                versions.android
                    ? `Version Name: ${versions.android.versionName}\nVersion Code: ${versions.android.versionCode}`
                    : 'Status: Not found or not configured'
            }</div>
        </div>
    `;

    // iOS Card
    html += `
        <div class="version-card ${versions.ios ? 'available' : 'unavailable'}">
            <div class="version-header">
                <div class="version-icon">
                    <svg class="icon-svg" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                </div>
                <span class="version-title">iOS</span>
                <div class="version-status">${
                    versions.ios
                        ? `<svg class="icon-svg" style="fill: #22c55e;" viewBox="0 0 24 24">
                         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                       </svg>`
                        : `<svg class="icon-svg" style="fill: #ef4444;" viewBox="0 0 24 24">
                         <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                       </svg>`
                }</div>
            </div>
            <div class="version-message">${
                versions.ios
                    ? `Version: ${versions.ios.version}\nBuild Number: ${versions.ios.buildNumber}`
                    : 'Status: Not found or not configured'
            }</div>
        </div>
    `;

    html += `</div>`; // Close versions-container

    // Add sync status section
    const allVersions = [versions.packageJson, versions.android?.versionName, versions.ios?.version].filter(Boolean);
    const uniqueVersions = [...new Set(allVersions)];
    const isSynced = uniqueVersions.length <= 1 && allVersions.length > 1;

    html += `
        <div class="sync-status">
            <h2 class="sync-title">
                <span class="sync-indicator ${isSynced ? 'synced' : 'unsynced'}"></span>
                Version Sync Status
            </h2>
            <p class="sync-message">
                ${
                    isSynced
                        ? `All platforms are synced to version ${uniqueVersions[0] || 'N/A'}!`
                        : `Platforms have different versions. Consider using "Sync Versions" command.`
                }
            </p>
        </div>
    `;

    html += `
        </body>
        </html>
    `;

    return html;
}
