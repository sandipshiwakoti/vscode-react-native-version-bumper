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
import { COMMANDS } from './constants';
import { BumpType } from './types';

export function activate(context: vscode.ExtensionContext) {
    initializeCodeLens(context);
    initializeStatusBar();

    const commands = [
        vscode.commands.registerCommand(COMMANDS.BUMP_APP_VERSION, () => bumpAppVersion(false)),
        vscode.commands.registerCommand(COMMANDS.BUMP_APP_VERSION_WITH_GIT, () => bumpAppVersion(true)),
        vscode.commands.registerCommand(COMMANDS.SYNC_VERSIONS, () => bumpSyncVersion(false)),
        vscode.commands.registerCommand(COMMANDS.SYNC_VERSIONS_WITH_GIT, () => bumpSyncVersion(true)),
        vscode.commands.registerCommand(COMMANDS.SHOW_VERSIONS, showCurrentVersions),
        vscode.commands.registerCommand(COMMANDS.BUMP_PATCH, () => bumpVersionByType(BumpType.PATCH)),
        vscode.commands.registerCommand(COMMANDS.BUMP_MINOR, () => bumpVersionByType(BumpType.MINOR)),
        vscode.commands.registerCommand(COMMANDS.BUMP_MAJOR, () => bumpVersionByType(BumpType.MAJOR)),
        vscode.commands.registerCommand(COMMANDS.SHOW_CODE_LENS, showCodeLens),
        vscode.commands.registerCommand(COMMANDS.HIDE_CODE_LENS, hideCodeLens),
        vscode.commands.registerCommand(COMMANDS.IS_CODE_LENS_ENABLED, getCodeLensStatus),
    ];

    context.subscriptions.push(...commands);
}

export function deactivate() {
    disposeStatusBar();
    disposeCodeLens();
}
