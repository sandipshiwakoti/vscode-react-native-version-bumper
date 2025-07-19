import * as vscode from 'vscode';

import { CODELENS_CONTEXT_KEY, CODELENS_ENABLED_KEY } from '../constants';
import { disposeCodeLensProvider, refreshCodeLenses, registerCodeLensProvider } from '../utils/codeLensUtils';

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
    return extensionContext.workspaceState.get(CODELENS_ENABLED_KEY, true);
}

export async function setCodeLensEnabled(enabled: boolean): Promise<void> {
    if (!extensionContext) {
        return;
    }
    await extensionContext.workspaceState.update(CODELENS_ENABLED_KEY, enabled);
    await vscode.commands.executeCommand('setContext', CODELENS_CONTEXT_KEY, enabled);
}

function updateCodeLensContext(): void {
    const enabled = isCodeLensEnabled();
    vscode.commands.executeCommand('setContext', CODELENS_CONTEXT_KEY, enabled);
}

export async function showCodeLens(): Promise<void> {
    await setCodeLensEnabled(true);
    vscode.window.showInformationMessage('Code Lens is now enabled');

    if (codeLensDisposable) {
        codeLensDisposable.dispose();
    }

    codeLensDisposable = registerCodeLensProvider(extensionContext);
    extensionContext.subscriptions.push(codeLensDisposable);
    refreshCodeLenses();
}

export async function hideCodeLens(): Promise<void> {
    await setCodeLensEnabled(false);
    vscode.window.showInformationMessage('Code Lens is now disabled');

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
