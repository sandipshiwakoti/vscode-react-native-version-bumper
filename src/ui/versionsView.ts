import { ProjectType, ProjectVersions } from '../types';

export function generateVersionsHTML(versions: ProjectVersions, projectType: ProjectType): string {
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
                .version-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-radius: 6px;
                    border-color: var(--vscode-inputValidation-infoBorder);
                }
                .version-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .result-message {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-top: 8px;
                    font-size: 14px;
                }
                .not-found {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                }
                .emoji {
                    margin-right: 8px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📱 Current Versions</h1>
                <span class="project-type">${projectType.replace('-', ' ')}</span>
            </div>
    `;

    html += `
        <div class="version-section">
            <div class="version-title"><span class="emoji">📦</span>Package.json</div>
            <div class="result-message">
                Version: ${versions.packageJson || '<span class="not-found">Not found</span>'}
            </div>
        </div>
    `;

    if (versions.android) {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🤖</span>Android</div>
                <div class="result-message">
                    Version Code: ${versions.android.versionCode}<br>
                    Version Name: ${versions.android.versionName}
                </div>
            </div>
        `;
    } else if (projectType === 'react-native') {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🤖</span>Android</div>
                <div class="result-message">
                    Status: <span class="not-found">Not found or not configured</span>
                </div>
            </div>
        `;
    }

    if (versions.ios) {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🍎</span>iOS</div>
                <div class="result-message">
                    Build Number: ${versions.ios.buildNumber}<br>
                    Version: ${versions.ios.version}
                </div>
            </div>
        `;
    } else if (projectType === 'react-native') {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🍎</span>iOS</div>
                <div class="result-message">
                    Status: <span class="not-found">Not found or not configured</span>
                </div>
            </div>
        `;
    }

    html += `
        </body>
        </html>
    `;

    return html;
}
