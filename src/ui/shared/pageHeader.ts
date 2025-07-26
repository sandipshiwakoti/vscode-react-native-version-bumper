import * as vscode from 'vscode';

export interface PageHeaderData {
    title: string;
    subtitle: string;
    logoUri?: vscode.Uri;
}

export function generatePageHeaderHTML(data: PageHeaderData): string {
    let logoSrc = '';
    if (data.logoUri) {
        logoSrc = `<img src="${data.logoUri}" alt="Logo" class="header-logo">`;
    } else {
        logoSrc = `<svg class="header-logo header-logo-svg" viewBox="0 0 24 24">
            <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zM6.5 7.5L12 5l5.5 2.5L12 10 6.5 7.5zM4 8.5l7 3.5v7l-7-3.5v-7zm16 0v7l-7 3.5v-7l7-3.5z"/>
        </svg>`;
    }

    return `
        <div class="header">
            ${logoSrc}
            <div class="header-content">
                <h1>${data.title}</h1>
                <div class="header-subtitle">${data.subtitle}</div>
            </div>
        </div>
    `;
}

export const PAGE_HEADER_CSS = `
    .header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--vscode-panel-border);
    }

    .header-logo {
        width: 80px;
        height: 80px;
        flex-shrink: 0;
    }

    .header-logo-svg {
        fill: var(--vscode-textLink-foreground);
    }

    .header-content {
        flex: 1;
    }

    .header h1 {
        font-size: 1.8rem;
        font-weight: 700;
        margin: 0 0 4px 0;
        color: var(--vscode-textLink-foreground);
    }

    .header-subtitle {
        background-color: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 0.85rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
    }
`;

export const SHARED_BASE_CSS = `
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 24px;
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
    }

    .results-container, .versions-container {
        display: grid;
        gap: 16px;
        margin-bottom: 32px;
    }
`;
