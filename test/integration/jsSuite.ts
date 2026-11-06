import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { computeReference } from '../../src/copyReference';

const POLL_INTERVAL_MS = 1000;
const POLL_LIMIT_MS = 60000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(file: string): Promise<vscode.TextDocument> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    return vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, file));
}

function positionOf(document: vscode.TextDocument, lineContains: string, token: string): vscode.Position {
    const line = document.getText().split('\n').findIndex((l) => l.includes(lineContains));
    assert.notEqual(line, -1, `line containing "${lineContains}" not found`);
    return new vscode.Position(line, document.lineAt(line).text.indexOf(token));
}

export async function run(): Promise<void> {
    const use = await open('src/use.js');
    const math = await open('src/math.js');
    const round = positionOf(use, 'round(1)', 'round');

    // The TS server returns wrong definitions while cold.
    const deadline = Date.now() + POLL_LIMIT_MS;
    while ((await computeReference(use, round)).isFallback) {
        assert.ok(Date.now() < deadline, 'TS server did not resolve round within 60s');
        await sleep(POLL_INTERVAL_MS);
    }

    const cases: [string, vscode.TextDocument, vscode.Position, string, boolean][] = [
        ['function', use, round, 'src/math.js:round', false],
        ['method', use, positionOf(use, 'new Calc().add()', 'add'), 'src/math.js:Calc.add', false],
        ['nested key', use, positionOf(use, 'cfg.a.b', 'b'), 'src/math.js:cfg.a.b', false],
        ['local', math, positionOf(math, 'return inner', 'inner'), `src/math.js:${positionOf(math, 'return inner', 'inner').line + 1}`, true],
    ];

    const failures: string[] = [];
    for (const [name, document, position, text, isFallback] of cases) {
        try {
            assert.deepEqual(await computeReference(document, position), { text, isFallback });
        } catch (e) {
            failures.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    if (failures.length > 0) {
        throw new Error(failures.join('\n\n'));
    }
}
