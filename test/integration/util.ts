import * as vscode from 'vscode';

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function openInWorkspace(file: string): Promise<vscode.TextDocument> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    return vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, file));
}

export async function expectAll(checks: [name: string, body: () => unknown][]): Promise<void> {
    const failures: string[] = [];
    for (const [name, body] of checks) {
        try {
            await body();
        } catch (e) {
            failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(failures.join('\n\n'));
    }
}
