import { TEST_TIMEOUTS } from '../constants';

const vscode = require('vscode');
const fs = require('fs/promises');

interface QuickPickItem {
    label?: string;
    value?: string;
}

export function createQuickPickMock(responses: string[]) {
    const originalShowQuickPick = vscode.window.showQuickPick;
    let callIndex = 0;

    const mockFunction = async function (items: QuickPickItem[]) {
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

export async function setExtensionSettings(configName: string, settings: Record<string, any>) {
    const config = vscode.workspace.getConfiguration(configName);
    for (const [key, value] of Object.entries(settings)) {
        await config.update(key, value, vscode.ConfigurationTarget.Workspace);
    }
}

export const checkFileExists = async (filePath: string) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

export async function waitForFileOperations(isComplex: boolean = false): Promise<void> {
    if (vscode.env.uiKind === vscode.UIKind.Desktop) {
        const delay = isComplex ? TEST_TIMEOUTS.COMPLEX_OPERATION_DELAY : TEST_TIMEOUTS.FILE_OPERATION_DELAY;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}
