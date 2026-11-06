import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { missingRecommendation } from '../../src/extension';
import { js } from '../../src/languages/js';
import { php } from '../../src/languages/php';
import { expectAll, openInWorkspace } from './util';

export async function run(): Promise<void> {
    await expectAll([
        [
            'command copies reference',
            async () => {
                const document = await openInWorkspace('src/note.txt');
                const editor = await vscode.window.showTextDocument(document);
                editor.selection = new vscode.Selection(0, 0, 0, 0);
                await vscode.env.clipboard.writeText('');
                await vscode.commands.executeCommand('copyReference.copy');
                assert.equal(await vscode.env.clipboard.readText(), 'src/note.txt:1');
            },
        ],
        [
            'php with nothing installed',
            () => {
                assert.deepEqual(missingRecommendation(php, () => false), [
                    'devsense.phptools-vscode',
                    'bmewburn.vscode-intelephense-client',
                ]);
            },
        ],
        [
            'php with one installed',
            () => {
                assert.equal(missingRecommendation(php, (id) => id === 'bmewburn.vscode-intelephense-client'), undefined);
            },
        ],
        [
            'js has no recommendation',
            () => {
                assert.equal(missingRecommendation(js, () => false), undefined);
            },
        ],
    ]);
}
