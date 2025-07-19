import * as vscode from 'vscode';

import { bumpAppVersion } from './commands/bumpAppVersion';
import { bumpSyncVersion } from './commands/bumpSyncVersion';
import { bumpVersionByType } from './commands/bumpVersionByType';
import { showCurrentVersions } from './commands/showCurrentVersions';
import {
    disposeCodeLens,
    getCodeLensStatus,
    hideCodeLens,
    initializeCodeLens,
    showCodeLens,
} from './commands/toggleCodeLens';
import { disposeStatusBar, initializeStatusBar } from './utils/statusBarUtils';

export function activate(context: vscode.ExtensionContext) {
    initializeCodeLens(context);
    initializeStatusBar();

    const commands = [
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpAppVersion', () =>
            bumpAppVersion(false)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpAppVersionWithGit', () =>
            bumpAppVersion(true)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.syncVersions', () =>
            bumpSyncVersion(false)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.syncVersionsWithGit', () =>
            bumpSyncVersion(true)
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.showVersions', showCurrentVersions),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpPatch', () =>
            bumpVersionByType('patch')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpMinor', () =>
            bumpVersionByType('minor')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.bumpMajor', () =>
            bumpVersionByType('major')
        ),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.showCodeLens', showCodeLens),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.hideCodeLens', hideCodeLens),
        vscode.commands.registerCommand('vscode-react-native-version-bumper.isCodeLensEnabled', getCodeLensStatus),
    ];

    context.subscriptions.push(...commands);
}

export function deactivate() {
    disposeStatusBar();
    disposeCodeLens();
}
