import * as vscode from 'vscode';

import { isCodeLensEnabled } from '../commands/toggleCodeLens';

import { getAndroidCodeLenses } from './androidUtils';
import { getIOSCodeLenses } from './iosUtils';
import { getPackageJsonCodeLenses } from './packageUtils';

let onDidChangeCodeLensesEmitter: vscode.EventEmitter<void>;
let textDocumentListener: vscode.Disposable;

export function initializeCodeLensProvider(): vscode.CodeLensProvider {
    onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

    textDocumentListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (
            e.document.fileName.endsWith('package.json') ||
            e.document.fileName.endsWith('build.gradle') ||
            e.document.fileName.endsWith('Info.plist')
        ) {
            onDidChangeCodeLensesEmitter.fire();
        }
    });

    return {
        onDidChangeCodeLenses: onDidChangeCodeLensesEmitter.event,
        provideCodeLenses: async (document: vscode.TextDocument): Promise<vscode.CodeLens[]> => {
            if (!isCodeLensEnabled()) {
                return [];
            }

            if (document.fileName.endsWith('package.json')) {
                return getPackageJsonCodeLenses(document);
            }

            if (document.fileName.endsWith('build.gradle')) {
                return getAndroidCodeLenses(document);
            }

            if (document.fileName.endsWith('Info.plist')) {
                return await getIOSCodeLenses(document);
            }

            return [];
        },
    };
}

export function refreshCodeLenses(): void {
    if (onDidChangeCodeLensesEmitter) {
        onDidChangeCodeLensesEmitter.fire();
    }
}

export function disposeCodeLensProvider(): void {
    if (onDidChangeCodeLensesEmitter) {
        onDidChangeCodeLensesEmitter.dispose();
    }
    if (textDocumentListener) {
        textDocumentListener.dispose();
    }
}

export function registerCodeLensProvider(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = initializeCodeLensProvider();

    const disposable = vscode.languages.registerCodeLensProvider(
        [
            { language: 'json', pattern: '**/package.json' },
            { pattern: '**/build.gradle' },
            { pattern: '**/Info.plist' },
        ],
        provider
    );

    context.subscriptions.push(disposable);
    return disposable;
}
