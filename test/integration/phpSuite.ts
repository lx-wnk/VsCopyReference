import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { computeReference } from '../../src/copyReference';

const POLL_INTERVAL_MS = 2000;
const POLL_LIMIT_MS = 120000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(file: string): Promise<vscode.TextDocument> {
    const root = vscode.workspace.workspaceFolders![0].uri;
    return vscode.workspace.openTextDocument(vscode.Uri.joinPath(root, file));
}

// line is 1-based
function at(document: vscode.TextDocument, line: number, token: string): vscode.Position {
    const column = document.lineAt(line - 1).text.indexOf(token);
    assert.notEqual(column, -1, `"${token}" not found on line ${line}`);
    return new vscode.Position(line - 1, column);
}

export async function run(): Promise<void> {
    const caller = await open('src/Caller.php');
    const comparator = await open('vendor/acme/util/src/FloatComparator.php');
    const baseMethod = at(caller, 16, 'baseMethod');

    // Both providers return empty definitions while cold; baseMethod is the slowest target.
    const deadline = Date.now() + POLL_LIMIT_MS;
    let last = await computeReference(caller, baseMethod);
    while (last.isFallback) {
        assert.ok(
            Date.now() < deadline,
            `${process.env.COPY_REFERENCE_PROVIDER} did not resolve baseMethod within 120s, last: ${JSON.stringify(last)}`,
        );
        await sleep(POLL_INTERVAL_MS);
        last = await computeReference(caller, baseMethod);
    }

    const cases: [string, vscode.TextDocument, vscode.Position, string, boolean][] = [
        ['method', caller, at(caller, 12, 'lessThanOrEquals'), '\\Acme\\Util\\FloatComparator::lessThanOrEquals', false],
        ['constant', caller, at(caller, 13, 'EPSILON'), '\\Acme\\Util\\FloatComparator::EPSILON', false],
        ['property', caller, at(caller, 14, 'tolerance'), '\\Acme\\Util\\FloatComparator::$tolerance', false],
        ['class in use', caller, at(caller, 5, 'FloatComparator'), '\\Acme\\Util\\FloatComparator', false],
        ['function', caller, at(caller, 15, 'helper'), '\\Acme\\Util\\helper', false],
        ['inherited method', caller, baseMethod, '\\Acme\\Util\\ComparatorBase::baseMethod', false],
        ['interface method', caller, at(caller, 17, 'compare'), '\\App\\Comparable::compare', false],
        ['declaration', comparator, at(comparator, 11, 'lessThanOrEquals'), '\\Acme\\Util\\FloatComparator::lessThanOrEquals', false],
        ['local variable', caller, at(caller, 18, '$local'), 'src/Caller.php:18', true],
        ['blank line', caller, new vscode.Position(19, 0), 'src/Caller.php:20', true],
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
