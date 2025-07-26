import * as vscode from 'vscode';

import { executeVersionBump } from '../services/versionService';

export async function bumpSyncVersion(withGit: boolean, context?: vscode.ExtensionContext): Promise<void> {
    return executeVersionBump({ withGit, isSync: true, context });
}
