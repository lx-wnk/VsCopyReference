import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { computeReference } from '../../src/copyReference';

async function open(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(uri);
}

export async function run(): Promise<void> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    const note = await open(vscode.Uri.joinPath(root, 'src/note.txt'));
    const php = await open(vscode.Uri.joinPath(root, 'src/plain.php'));
    const plainLine = php.getText().split('\n').findIndex((l) => l.includes('plainFn'));
    assert.notEqual(plainLine, -1, 'plainFn not found');

    const outside = path.join(os.tmpdir(), 'copy-reference-outside.txt');
    fs.writeFileSync(outside, 'outside\n');
    const outsideDoc = await open(vscode.Uri.file(outside));

    const cases: [string, vscode.TextDocument, vscode.Position, string][] = [
        ['txt', note, new vscode.Position(0, 0), 'src/note.txt:1'],
        ['php without provider', php, new vscode.Position(plainLine, php.lineAt(plainLine).text.indexOf('plainFn')), `src/plain.php:${plainLine + 1}`],
        ['outside workspace', outsideDoc, new vscode.Position(0, 0), `${outside}:1`],
    ];

    const failures: string[] = [];
    for (const [name, document, position, text] of cases) {
        try {
            assert.deepEqual(await computeReference(document, position), { text, isFallback: true });
        } catch (e) {
            failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(failures.join('\n\n'));
    }
}
