const vscode = require('vscode');
const fs = require('fs/promises');

// Create a mock for VS Code QuickPick dialogs
export function createQuickPickMock(responses) {
    const originalShowQuickPick = vscode.window.showQuickPick;
    let callIndex = 0;

    const mockFunction = async function (items) {
        if (callIndex >= responses.length) {
            throw new Error(
                `Mock QuickPick called more times than expected. ` +
                    `Call ${callIndex + 1}, but only ${responses.length} responses provided.`
            );
        }

        const response = responses[callIndex++];
        const selected = items.find((item) => {
            const label = (item.label || item.value || '').toLowerCase();
            return label.includes(response.toLowerCase());
        });

        if (!selected) {
            throw new Error(
                `No QuickPick item found for response: "${response}". ` +
                    `Available items: ${items.map((i) => i.label || i.value).join(', ')}`
            );
        }

        return selected;
    };

    vscode.window.showQuickPick = mockFunction;
    return originalShowQuickPick;
}

// Helper function to set multiple VS Code extension settings at once
export async function setExtensionSettings(configName, settings) {
    const config = vscode.workspace.getConfiguration(configName);
    for (const [key, value] of Object.entries(settings)) {
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
}

// Check if a file exists
export const checkFileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};
