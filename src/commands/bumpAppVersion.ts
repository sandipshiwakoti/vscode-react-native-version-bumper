import * as vscode from 'vscode';

import { executeVersionBump } from '../services/versionService';

export async function bumpAppVersion(withGit: boolean, context?: vscode.ExtensionContext): Promise<void> {
    return executeVersionBump({ withGit, isSync: false, context });
}
