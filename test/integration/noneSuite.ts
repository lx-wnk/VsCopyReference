import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { computeReference } from '../../src/copyReference';
import { expectAll, openInWorkspace } from './util';

export async function run(): Promise<void> {
    const note = await openInWorkspace('src/note.txt');
    const php = await openInWorkspace('src/plain.php');
    const plainLine = php.getText().split('\n').findIndex((l) => l.includes('plainFn'));
    assert.notEqual(plainLine, -1, 'plainFn not found');

    const outside = path.join(os.tmpdir(), 'copy-reference-outside.txt');
    fs.writeFileSync(outside, 'outside\n');
    const outsideDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(outside));

    const cases: [string, vscode.TextDocument, vscode.Position, string][] = [
        ['txt', note, new vscode.Position(0, 0), 'src/note.txt:1'],
        ['php without provider', php, new vscode.Position(plainLine, php.lineAt(plainLine).text.indexOf('plainFn')), `src/plain.php:${plainLine + 1}`],
        ['outside workspace', outsideDoc, new vscode.Position(0, 0), `${outside}:1`],
    ];

    await expectAll(
        cases.map(([name, document, position, text]): [string, () => Promise<void>] => [
            name,
            async () => assert.deepEqual(await computeReference(document, position), { text, isFallback: true }),
        ]),
    );
}
