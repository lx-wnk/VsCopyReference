import { test } from 'node:test';
import assert from 'node:assert/strict';
import { js } from '../../src/languages/js';
import { languageFor } from '../../src/languages';
import { php } from '../../src/languages/php';
import { Kind, SymbolNode } from '../../src/symbols';

const at = { line: 0, character: 0 };
const node = (name: string, kind: Kind): SymbolNode => ({
    name, kind, detail: '',
    range: { start: at, end: at }, selectionRange: { start: at, end: at }, children: [],
});
const format = (...chain: SymbolNode[]) => js.format({ chain, relativePath: 'src/utils/math.js' });

test('js language metadata', () => {
    assert.deepEqual(js.languageIds, ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']);
    assert.deepEqual(js.recommendedExtensions, []);
});

test('top-level symbol', () => {
    assert.equal(format(node('round', 'function')), 'src/utils/math.js:round');
});

test('class member chain', () => {
    assert.equal(format(node('Class', 'class'), node('method', 'method')), 'src/utils/math.js:Class.method');
});

test('nested object chain', () => {
    assert.equal(format(node('cfg', 'variable'), node('a', 'property'), node('b', 'property')), 'src/utils/math.js:cfg.a.b');
});

test('empty chain is unsupported', () => {
    assert.equal(format(), undefined);
});

test('registry resolves language ids', () => {
    assert.equal(languageFor('php'), php);
    assert.equal(languageFor('typescriptreact'), js);
    assert.equal(languageFor('plaintext'), undefined);
});
