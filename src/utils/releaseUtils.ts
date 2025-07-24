import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import { exec } from 'child_process';
import { promisify } from 'util';

import { RELEASE_TEMPLATE_PATHS } from '../constants';
import { BumpResult, BumpType } from '../types';

const execAsync = promisify(exec);

export async function checkForExistingReleaseTemplate(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    for (const templatePath of RELEASE_TEMPLATE_PATHS) {
        const fullPath = path.join(rootPath, templatePath);
        try {
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                return content;
            }
        } catch {}
    }

    return null;
}

export async function generateReleaseNotes(
    type: BumpType,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const existingTemplate = await checkForExistingReleaseTemplate();

    if (existingTemplate) {
        return appendVersionInfoToTemplate(existingTemplate, results, tagName, repoUrl);
    } else {
        return await generateDefaultReleaseNotes(type, results, tagName, repoUrl);
    }
}

async function appendVersionInfoToTemplate(
    template: string,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const successfulResults = results.filter((r) => r.success && r.platform !== 'Git');

    let notes = template;

    const hasVersionUpdates =
        /version\s+updates?/i.test(template) || /android.*ios/i.test(template) || /build.*number/i.test(template);

    if (!hasVersionUpdates && successfulResults.length > 0) {
        notes += `\n\n**Version Updates:**\n`;

        successfulResults.forEach((result) => {
            if (result.oldVersion && result.newVersion) {
                const platform = result.platform === 'Package.json' ? 'package.json' : result.platform;
                notes += `- ${platform}: ${result.oldVersion} → ${result.newVersion}\n`;
            }
        });

        const previousTag = await getPreviousTag();
        if (previousTag) {
            notes += `\n**Full Changelog**: ${repoUrl}/compare/${previousTag}...${tagName}`;
        }
    }

    return notes;
}

async function getPreviousTag(): Promise<string> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const { stdout } = await execAsync('git describe --tags --abbrev=0 HEAD~1', {
                cwd: workspaceFolders[0].uri.fsPath,
            });
            return stdout.trim();
        }
    } catch {
        console.error('Something went wrong!');
    }
    return '';
}

async function generateDefaultReleaseNotes(
    type: BumpType,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const successfulResults = results.filter((r) => r.success && r.platform !== 'Git');

    let notes = `**What's Changed:**\n`;
    notes += `<!-- Add your changes here -->\n`;
    notes += `- \n`;
    notes += `- \n`;

    if (successfulResults.length > 0) {
        notes += `\n\n**Version Updates:**\n`;

        successfulResults.forEach((result) => {
            if (result.oldVersion && result.newVersion) {
                const platform = result.platform === 'Package.json' ? 'package.json' : result.platform;
                notes += `- ${platform}: ${result.oldVersion} → ${result.newVersion}\n`;
            }
        });

        const previousTag = await getPreviousTag();
        if (previousTag) {
            notes += `\n**Full Changelog**: ${repoUrl}/compare/${previousTag}...${tagName}`;
        }
    }

    return notes;
}
