import { Platform, VersionCardData } from '../../types';

function truncateErrorMessage(message: string, maxLength: number = 200): string {
    if (message.length <= maxLength) {
        return message;
    }

    const truncated = message.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastLineBreak = truncated.lastIndexOf('\n');
    const lastSpace = truncated.lastIndexOf(' ');

    let breakPoint = maxLength;
    if (lastSentence > maxLength * 0.7) {
        breakPoint = lastSentence + 1;
    } else if (lastLineBreak > maxLength * 0.7) {
        breakPoint = lastLineBreak;
    } else if (lastSpace > maxLength * 0.8) {
        breakPoint = lastSpace;
    }

    return message.substring(0, breakPoint).trim() + '...';
}

export function generateVersionCardHTML(
    data: VersionCardData,
    showStatus: boolean = false,
    cssPrefix: string = 'version'
): string {
    const cardClass =
        data.available !== undefined
            ? data.available
                ? 'available'
                : 'unavailable'
            : data.success
              ? 'success'
              : 'error';

    let iconSvg = '';
    switch (data.platform) {
        case Platform.PACKAGE_JSON:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM6.5 7.5L12 5l5.5 2.5L12 10 6.5 7.5zM4 8.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
            </svg>`;
            break;
        case Platform.ANDROID:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.28-.54-.37-.83-.22-.3.16-.42.54-.26.85L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25S18.25 13.31 18.25 14s-.56 1.25-1.25 1.25z"/>
            </svg>`;
            break;
        case Platform.IOS:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>`;
            break;
        case Platform.EXPO:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 22">
                <path d="M11.39 8.269c.19-.277.397-.312.565-.312.168 0 .447.035.637.312 1.49 2.03 3.95 6.075 5.765 9.06 1.184 1.945 2.093 3.44 2.28 3.63.7.714 1.66.269 2.218-.541.549-.797.701-1.357.701-1.954 0-.407-7.958-15.087-8.759-16.309C14.027.98 13.775.683 12.457.683h-.988c-1.315 0-1.505.297-2.276 1.472C8.392 3.377.433 18.057.433 18.463c0 .598.153 1.158.703 1.955.558.81 1.518 1.255 2.218.54.186-.19 1.095-1.684 2.279-3.63 1.815-2.984 4.267-7.029 5.758-9.06z"/>
            </svg>`;
            break;
        case Platform.GIT:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                <path d="M21.62 11.108l-8.731-8.729c-.78-.78-2.047-.78-2.827 0l-1.814 1.814 2.3 2.3c.83-.28 1.777-.095 2.435.563.664.664.848 1.614.564 2.435l2.218 2.218c.83-.28 1.777-.095 2.435.563.93.93.93 2.438 0 3.367-.93.93-2.438.93-3.367 0-.696-.696-.864-1.719-.503-2.58l-2.068-2.068v5.441c.227.112.437.262.618.442.93.93.93 2.438 0 3.367-.93.93-2.438.93-3.367 0-.93-.93-.93-2.438 0-3.367.23-.23.498-.403.786-.525v-5.493c-.288-.122-.556-.295-.786-.525-.697-.697-.864-1.722-.5-2.584l-2.27-2.27-5.993 5.993c-.78.78-.78 2.047 0 2.827l8.729 8.729c.78.78 2.047.78 2.827 0l8.729-8.729c.78-.78.78-2.047 0-2.827z"/>
            </svg>`;
            break;
        default:
            iconSvg = `<svg class="icon-svg" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>`;
    }

    let statusIcon = '';
    if (showStatus) {
        statusIcon = data.success
            ? `<svg class="icon-svg" style="fill: #22c55e;" viewBox="0 0 24 24">
                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
               </svg>`
            : `<svg class="icon-svg" style="fill: #ef4444;" viewBox="0 0 24 24">
                 <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
               </svg>`;
    }

    let messageContent = '';
    if (data.error) {
        const truncatedError = truncateErrorMessage(data.error);
        messageContent = `<span style="color: var(--vscode-errorForeground);">${truncatedError}</span>`;
    } else {
        switch (data.platform) {
            case Platform.PACKAGE_JSON:
                if (data.newVersion && data.oldVersion) {
                    messageContent = `<strong>Version:</strong> ${data.oldVersion} → ${data.newVersion}`;
                } else if (data.version) {
                    messageContent = `<strong>Version:</strong> ${data.version}`;
                } else {
                    messageContent =
                        '<span style="color: var(--vscode-errorForeground);">❌ Not found - package.json missing or invalid</span>';
                }
                break;

            case Platform.ANDROID:
                if (data.newVersion && data.oldVersion) {
                    const newVersionMatch = data.newVersion.match(/^(.+) \((\d+)\)$/);
                    const oldVersionMatch = data.oldVersion.match(/^(.+) \((\d+)\)$/);
                    if (newVersionMatch && oldVersionMatch) {
                        messageContent = `<strong>Version Name:</strong> ${oldVersionMatch[1]} → ${newVersionMatch[1]}<br>
                                       <strong>Version Code:</strong> ${oldVersionMatch[2]} → ${newVersionMatch[2]}`;
                    } else {
                        messageContent = `<strong>Version:</strong> ${data.oldVersion} → ${data.newVersion}`;
                    }
                } else if (data.versionName && data.versionCode) {
                    messageContent = `<strong>Version Name:</strong> ${data.versionName}<br>
                                   <strong>Version Code:</strong> ${data.versionCode}`;
                } else {
                    messageContent =
                        '<span style="color: var(--vscode-errorForeground);">❌ Not found - android/app/build.gradle missing or invalid</span>';
                }
                break;

            case Platform.EXPO:
                if (data.newVersion && data.oldVersion) {
                    const newVersionMatch = data.newVersion.match(/^(.+) \(iOS: (.+), Android: (.+)\)$/);
                    const oldVersionMatch = data.oldVersion.match(/^(.+) \(iOS: (.+), Android: (.+)\)$/);
                    if (newVersionMatch && oldVersionMatch) {
                        messageContent = `<strong>Version:</strong> ${oldVersionMatch[1]} → ${newVersionMatch[1]}<br>
                                       <strong>iOS Build Number:</strong> ${oldVersionMatch[2]} → ${newVersionMatch[2]}<br>
                                       <strong>Android Version Code:</strong> ${oldVersionMatch[3]} → ${newVersionMatch[3]}`;
                    } else {
                        messageContent = `<strong>Version:</strong> ${data.oldVersion} → ${data.newVersion}`;
                    }
                } else if (data.version) {
                    messageContent = `<strong>Version:</strong> ${data.version}`;
                    if (data.versionCode) {
                        messageContent += `<br><strong>Android Version Code:</strong> ${data.versionCode}`;
                    }
                    if (data.buildNumber) {
                        messageContent += `<br><strong>iOS Build Number:</strong> ${data.buildNumber}`;
                    }
                } else {
                    messageContent =
                        '<span style="color: var(--vscode-errorForeground);">❌ Not found - app.json missing or invalid</span>';
                }
                break;

            case Platform.IOS:
                if (data.newVersion && data.oldVersion) {
                    const newVersionMatch = data.newVersion.match(/^(.+) \((.+)\)$/);
                    const oldVersionMatch = data.oldVersion.match(/^(.+) \((.+)\)$/);
                    if (newVersionMatch && oldVersionMatch) {
                        const newVersionVar =
                            data.iosVersionInfo?.usesVariables && data.iosVersionInfo?.versionVarName
                                ? ` (${data.iosVersionInfo.versionVarName})`
                                : '';
                        const newBuildVar =
                            data.iosVersionInfo?.usesVariables && data.iosVersionInfo?.buildVarName
                                ? ` (${data.iosVersionInfo.buildVarName})`
                                : '';
                        messageContent = `<strong>Version:</strong> ${oldVersionMatch[1]} → ${newVersionMatch[1]}${newVersionVar}<br>
                                       <strong>Build Number:</strong> ${oldVersionMatch[2]} → ${newVersionMatch[2]}${newBuildVar}`;
                    } else {
                        messageContent = `<strong>Version:</strong> ${data.oldVersion} → ${data.newVersion}`;
                    }
                } else if (data.version && data.buildNumber) {
                    const versionVar =
                        data.iosVersionInfo?.usesVariables && data.iosVersionInfo?.versionVarName
                            ? ` (${data.iosVersionInfo.versionVarName})`
                            : '';
                    const buildVar =
                        data.iosVersionInfo?.usesVariables && data.iosVersionInfo?.buildVarName
                            ? ` (${data.iosVersionInfo.buildVarName})`
                            : '';
                    messageContent = `<strong>Version:</strong> ${data.version}${versionVar}<br>
                                   <strong>Build Number:</strong> ${data.buildNumber}${buildVar}`;
                } else {
                    messageContent = `<span style="color: var(--vscode-errorForeground);">❌ Not found - ${data.location || 'ios/[AppName]/Info.plist'} missing or invalid</span>`;
                }
                break;

            case Platform.GIT:
                const gitMessage = data.message || 'Git operations completed';
                messageContent = gitMessage.length > 400 ? truncateErrorMessage(gitMessage, 400) : gitMessage;
                break;

            default:
                messageContent = data.message || 'Operation completed';
        }

        if (data.location && data.platform !== Platform.GIT) {
            messageContent += `<br><small style="opacity: 0.7;">Location: ${data.location}</small>`;
        }
    }

    return `
        <div class="${cssPrefix}-card ${cardClass}">
            <div class="${cssPrefix}-header">
                <div class="${cssPrefix}-icon">${iconSvg}</div>
                <span class="${cssPrefix}-title">${data.platform}</span>
                ${showStatus ? `<div class="${cssPrefix}-status">${statusIcon}</div>` : ''}
            </div>
            <div class="${cssPrefix}-message">
                ${messageContent}
            </div>
        </div>
    `;
}

export const VERSION_CARD_CSS = `
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

    .version-card.success {
        border-left: 4px solid #22c55e;
    }

    .version-card.error {
        border-left: 4px solid #ef4444;
    }

    .version-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
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
        line-height: 1.5;
        border: 1px solid var(--vscode-textBlockQuote-border);
    }
`;
