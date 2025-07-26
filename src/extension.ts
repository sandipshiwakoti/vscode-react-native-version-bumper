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
import { registerCommands } from './services/commandService';
import { disposeStatusBar, initializeStatusBar } from './utils/statusBarUtils';
import { COMMANDS } from './constants';
import { BumpType } from './types';

export function activate(context: vscode.ExtensionContext) {
    initializeCodeLens(context);
    initializeStatusBar();

    registerCommands(context, [
        { id: COMMANDS.BUMP_APP_VERSION, handler: () => bumpAppVersion(false, context) },
        { id: COMMANDS.BUMP_APP_VERSION_WITH_GIT, handler: () => bumpAppVersion(true, context) },
        { id: COMMANDS.SYNC_VERSIONS, handler: () => bumpSyncVersion(false, context) },
        { id: COMMANDS.SYNC_VERSIONS_WITH_GIT, handler: () => bumpSyncVersion(true, context) },
        { id: COMMANDS.SHOW_VERSIONS, handler: () => showCurrentVersions(context) },
        { id: COMMANDS.BUMP_PATCH, handler: () => bumpVersionByType(BumpType.PATCH) },
        { id: COMMANDS.BUMP_MINOR, handler: () => bumpVersionByType(BumpType.MINOR) },
        { id: COMMANDS.BUMP_MAJOR, handler: () => bumpVersionByType(BumpType.MAJOR) },
        { id: COMMANDS.SHOW_CODE_LENS, handler: showCodeLens },
        { id: COMMANDS.HIDE_CODE_LENS, handler: hideCodeLens },
        { id: COMMANDS.IS_CODE_LENS_ENABLED, handler: getCodeLensStatus },
    ]);
}

export function deactivate() {
    disposeStatusBar();
    disposeCodeLens();
}
