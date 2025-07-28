import * as vscode from 'vscode';

import { BatchExecutionPlan, GitAction, OperationType } from '../types';

export async function showBatchPreview(plan: BatchExecutionPlan): Promise<boolean> {
    const versionOps = plan.operations.filter((op) => op.type === OperationType.VERSION);
    const gitOps = plan.operations.filter((op) => op.type === OperationType.GIT);

    const versions = versionOps.map((op) => {
        const match = op.description.match(/^(\w+(?:\.\w+)?): (.+) → (.+)$/);
        if (match) {
            return `${match[1]}: ${match[2]} → ${match[3]}`;
        }
        return op.description;
    });

    let previewMessage = `🚀 Ready to execute ${versionOps.length + gitOps.length} operation${versionOps.length + gitOps.length !== 1 ? 's' : ''}\n\n`;

    if (versions.length > 0) {
        previewMessage += `📦 VERSION UPDATES (${versionOps.length})\n`;
        versions.forEach((version, index) => {
            previewMessage += `${index + 1}. ${version}\n`;
        });
    }

    if (gitOps.length > 0) {
        previewMessage += `\n🔧 GIT OPERATIONS (${gitOps.length})\n`;

        const branchOp = gitOps.find((op) => op.action === GitAction.CREATE_BRANCH);
        const commitOp = gitOps.find((op) => op.action === GitAction.COMMIT_CHANGES);
        const tagOp = gitOps.find((op) => op.action === GitAction.CREATE_TAG);
        const pushOp = gitOps.find((op) => op.action === GitAction.PUSH_TO_REMOTE);

        let gitIndex = 1;
        if (branchOp) {
            previewMessage += `${gitIndex++}. Branch: ${branchOp.newValue}\n`;
        }
        if (commitOp) {
            const commitMessage =
                commitOp.newValue.length > 100 ? commitOp.newValue.substring(0, 97) + '...' : commitOp.newValue;
            previewMessage += `${gitIndex++}. Commit: "${commitMessage}"\n`;
        }
        if (tagOp) {
            previewMessage += `${gitIndex++}. Tag: ${tagOp.newValue}\n`;
        }
        if (pushOp) {
            let pushDescription = 'Push: ';
            if (branchOp && tagOp) {
                pushDescription += 'branch and tag to remote';
            } else if (branchOp) {
                pushDescription += 'branch to remote';
            } else if (tagOp) {
                pushDescription += 'tag to remote';
            } else {
                pushDescription += 'changes to remote';
            }
            previewMessage += `${gitIndex++}. ${pushDescription}\n`;
        }
    }

    const confirmed = await vscode.window.showInformationMessage(previewMessage, { modal: true }, 'Execute Changes');

    return confirmed === 'Execute Changes';
}
