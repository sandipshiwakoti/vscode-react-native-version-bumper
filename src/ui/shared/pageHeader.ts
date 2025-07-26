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
            <path d="M12 2.5c-5.79 0-10.5 4.71-10.5 10.5S6.21 23.5 12 23.5s10.5-4.71 10.5-10.5S17.79 2.5 12 2.5zm0 18.5c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            <circle cx="12" cy="8" r="1.5"/>
            <circle cx="8" cy="12" r="1.5"/>
            <circle cx="16" cy="12" r="1.5"/>
            <circle cx="12" cy="16" r="1.5"/>
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
