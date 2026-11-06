import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { missingRecommendation } from '../../src/extension';
import { js } from '../../src/languages/js';
import { php } from '../../src/languages/php';

export async function run(): Promise<void> {
    const failures: string[] = [];
    const check = async (name: string, body: () => void | Promise<void>): Promise<void> => {
        try {
            await body();
        } catch (e) {
            failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    await check('command copies reference', async () => {
        const root = vscode.workspace.workspaceFolders![0].uri;
        const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, 'src/note.txt'));
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        await vscode.env.clipboard.writeText('');
        await vscode.commands.executeCommand('copyReference.copy');
        assert.equal(await vscode.env.clipboard.readText(), 'src/note.txt:1');
    });

    await check('php with nothing installed', () => {
        assert.deepEqual(missingRecommendation(php, () => false), [
            'devsense.phptools-vscode',
            'bmewburn.vscode-intelephense-client',
        ]);
    });
    await check('php with one installed', () => {
        assert.equal(missingRecommendation(php, (id) => id === 'bmewburn.vscode-intelephense-client'), undefined);
    });
    await check('js has no recommendation', () => {
        assert.equal(missingRecommendation(js, () => false), undefined);
    });

    if (failures.length > 0) {
        throw new Error(failures.join('\n\n'));
    }
}
