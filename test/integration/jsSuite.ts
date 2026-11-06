import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { computeReference } from '../../src/copyReference';
import { expectAll, openInWorkspace, sleep } from './util';

const POLL_INTERVAL_MS = 1000;
const POLL_LIMIT_MS = 60000;

function positionOf(document: vscode.TextDocument, lineContains: string, token: string): vscode.Position {
    const line = document.getText().split('\n').findIndex((l) => l.includes(lineContains));
    assert.notEqual(line, -1, `line containing "${lineContains}" not found`);
    return new vscode.Position(line, document.lineAt(line).text.indexOf(token));
}

export async function run(): Promise<void> {
    const use = await openInWorkspace('src/use.js');
    const math = await openInWorkspace('src/math.js');
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
        ['arrow-function local', math, positionOf(math, 'return local', 'local'), `src/math.js:${positionOf(math, 'return local', 'local').line + 1}`, true],
    ];

    await expectAll(
        cases.map(([name, document, position, text, isFallback]) => [
            name,
            async () => assert.deepEqual(await computeReference(document, position), { text, isFallback }),
        ]),
    );
}
