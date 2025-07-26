import * as vscode from 'vscode';

import { CODELENS } from '../constants';
import { disposeCodeLensProvider, refreshCodeLenses, registerCodeLensProvider } from '../services/uiService';

let codeLensDisposable: vscode.Disposable;
let extensionContext: vscode.ExtensionContext;

export function initializeCodeLens(context: vscode.ExtensionContext): void {
    extensionContext = context;

    updateCodeLensContext();

    codeLensDisposable = registerCodeLensProvider(context);
}

export function isCodeLensEnabled(): boolean {
    if (!extensionContext) {
        return true;
    }
    return extensionContext.workspaceState.get(CODELENS.ENABLED_KEY, true);
}

export async function setCodeLensEnabled(enabled: boolean): Promise<void> {
    if (!extensionContext) {
        return;
    }
    await extensionContext.workspaceState.update(CODELENS.ENABLED_KEY, enabled);
    await vscode.commands.executeCommand('setContext', CODELENS.CONTEXT_KEY, enabled);
}

function updateCodeLensContext(): void {
    const enabled = isCodeLensEnabled();
    vscode.commands.executeCommand('setContext', CODELENS.CONTEXT_KEY, enabled);
}

export async function showCodeLens(): Promise<void> {
    await setCodeLensEnabled(true);
    vscode.window.showInformationMessage('Version CodeLens enabled - Click version lines to bump versions');

    if (codeLensDisposable) {
        codeLensDisposable.dispose();
    }

    codeLensDisposable = registerCodeLensProvider(extensionContext);
    extensionContext.subscriptions.push(codeLensDisposable);
    refreshCodeLenses();
}

export async function hideCodeLens(): Promise<void> {
    await setCodeLensEnabled(false);
    vscode.window.showInformationMessage('Version CodeLens disabled - Use Command Palette for version bumping');

    if (codeLensDisposable) {
        codeLensDisposable.dispose();
    }

    codeLensDisposable = registerCodeLensProvider(extensionContext);
    extensionContext.subscriptions.push(codeLensDisposable);
    refreshCodeLenses();
}

export function getCodeLensStatus(): boolean {
    return isCodeLensEnabled();
}

export function disposeCodeLens(): void {
    disposeCodeLensProvider();
    if (codeLensDisposable) {
        codeLensDisposable.dispose();
    }
}
