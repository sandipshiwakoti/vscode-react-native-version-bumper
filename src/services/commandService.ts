import * as vscode from 'vscode';

export function registerCommands(
    context: vscode.ExtensionContext,
    commands: Array<{ id: string; handler: (...args: unknown[]) => unknown }>
): void {
    const disposables = commands.map(({ id, handler }) => vscode.commands.registerCommand(id, handler));

    context.subscriptions.push(...disposables);
}
