import * as vscode from 'vscode';

import { isCodeLensEnabled } from '../commands/toggleCodeLens';
import { FILE_EXTENSIONS, FILE_PATTERNS } from '../constants';

import { getAndroidCodeLenses } from './androidUtils';
import { getIOSCodeLenses } from './iosUtils';
import { getPackageJsonCodeLenses } from './packageUtils';

let onDidChangeCodeLensesEmitter: vscode.EventEmitter<void>;
let textDocumentListener: vscode.Disposable;

export function initializeCodeLensProvider(): vscode.CodeLensProvider {
    onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();

    textDocumentListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (
            e.document.fileName.endsWith(FILE_EXTENSIONS.PACKAGE_JSON) ||
            e.document.fileName.endsWith(FILE_EXTENSIONS.BUILD_GRADLE) ||
            e.document.fileName.endsWith(FILE_EXTENSIONS.INFO_PLIST)
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

            if (document.fileName.endsWith(FILE_EXTENSIONS.PACKAGE_JSON)) {
                return getPackageJsonCodeLenses(document);
            }

            if (document.fileName.endsWith(FILE_EXTENSIONS.BUILD_GRADLE)) {
                return getAndroidCodeLenses(document);
            }

            if (document.fileName.endsWith(FILE_EXTENSIONS.INFO_PLIST)) {
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
            { language: 'json', pattern: FILE_PATTERNS.PACKAGE_JSON_PATTERN },
            { pattern: FILE_PATTERNS.BUILD_GRADLE_PATTERN },
            { pattern: FILE_PATTERNS.INFO_PLIST_PATTERN },
        ],
        provider
    );

    context.subscriptions.push(disposable);
    return disposable;
}
