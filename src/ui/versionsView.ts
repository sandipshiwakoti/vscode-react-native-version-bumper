import * as vscode from 'vscode';

import { readIOSVersionInfo } from '../services/platformService';
import { IOSVersionInfo, Platform, ProjectType, ProjectVersions } from '../types';
import { getAppName } from '../utils/fileUtils';

import { generatePageHeaderHTML, PAGE_HEADER_CSS, SHARED_BASE_CSS } from './shared/pageHeader';
import { generateVersionCardHTML, VERSION_CARD_CSS } from './shared/versionCard';

export async function generateVersionsHTML(
    versions: ProjectVersions,
    projectType: ProjectType,
    logoUri?: vscode.Uri,
    rootPath?: string
): Promise<string> {
    const headerHTML = generatePageHeaderHTML({
        title: 'React Native Version Bumper',
        subtitle: `Current Versions - ${projectType.replace('-', ' ')}`,
        logoUri: logoUri,
    });

    let iosPath = 'ios/[AppName]/Info.plist';
    let iosVersionInfo: IOSVersionInfo | null = null;

    if (rootPath && versions.ios) {
        try {
            const appName = getAppName(rootPath);
            if (appName) {
                iosPath = `ios/${appName}/Info.plist`;
            }
            iosVersionInfo = await readIOSVersionInfo(rootPath);
        } catch {}
    }

    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>React Native Version Bumper - Current Versions</title>
            <style>
                ${SHARED_BASE_CSS}
                ${PAGE_HEADER_CSS}

                .project-summary {
                    background: linear-gradient(135deg, var(--vscode-input-background) 0%, rgba(59, 130, 246, 0.03) 100%);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 12px;
                    padding: 24px;
                    margin-bottom: 24px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }

                .project-summary::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 24px;
                    margin-top: 16px;
                }

                .summary-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9rem;
                    padding: 8px 0;
                }

                .summary-icon {
                    width: 16px;
                    height: 16px;
                    flex-shrink: 0;
                }

                .versions-container {
                    display: grid;
                    gap: 16px;
                    margin-bottom: 32px;
                }

                ${VERSION_CARD_CSS}


            </style>
        </head>
        <body>
            ${headerHTML}

            <div class="project-summary">
                <h3 style="margin: 0 0 16px 0; color: var(--vscode-foreground); font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--vscode-foreground)">
                        <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                    </svg>
                    Project Overview
                </h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <svg class="summary-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.5L2 7v10l10 5 10-5V7l-10-4.5zM12 4.5L19.5 8L12 11.5L4.5 8L12 4.5zM4 9.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
                        </svg>
                        <span>Project Type: <strong>${projectType === 'react-native' ? 'React Native' : projectType.replace('-', ' ')}</strong></span>
                    </div>
                    <div class="summary-item">
                        <svg class="summary-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        <span>Sync Status: <strong>${(() => {
                            const allVersions = [
                                versions.packageJson,
                                versions.android?.versionName,
                                versions.ios?.version,
                            ].filter(Boolean);
                            const uniqueVersions = [...new Set(allVersions)];
                            return uniqueVersions.length <= 1 && allVersions.length > 1
                                ? 'Synced'
                                : 'Different versions';
                        })()}</strong></span>
                    </div>
                </div>
            </div>

            <div class="versions-container">
    `;

    html += generateVersionCardHTML({
        platform: Platform.PACKAGE_JSON,
        available: !!versions.packageJson,
        version: versions.packageJson,
        location: 'package.json',
    });

    html += generateVersionCardHTML({
        platform: Platform.ANDROID,
        available: !!versions.android,
        versionName: versions.android?.versionName,
        versionCode: versions.android?.versionCode,
        location: 'android/app/build.gradle',
    });

    html += generateVersionCardHTML({
        platform: Platform.IOS,
        available: !!versions.ios,
        version: versions.ios?.version,
        buildNumber: versions.ios?.buildNumber,
        location: iosPath,
        iosVersionInfo: iosVersionInfo,
    });

    html += `</div>`;

    html += `
        </body>
        </html>
    `;

    return html;
}
