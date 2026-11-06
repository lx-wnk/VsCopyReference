import { test } from 'node:test';
import assert from 'node:assert/strict';
import { php } from '../../src/languages/php';
import { Kind, SymbolNode } from '../../src/symbols';

const at = { line: 0, character: 0 };
const node = (name: string, kind: Kind): SymbolNode => ({
    name, kind, detail: '',
    range: { start: at, end: at }, selectionRange: { start: at, end: at }, children: [],
});
const ns = node('Acme\\Util', 'namespace');
const cls = node('FloatComparator', 'class');
const format = (...chain: SymbolNode[]) => php.format({ chain, relativePath: 'a.php' });

test('php language metadata', () => {
    assert.deepEqual(php.languageIds, ['php']);
    assert.deepEqual(php.recommendedExtensions, [
        'devsense.phptools-vscode',
        'bmewburn.vscode-intelephense-client',
    ]);
});

test('class', () => {
    assert.equal(format(ns, cls), '\\Acme\\Util\\FloatComparator');
});

test('method with and without parentheses', () => {
    assert.equal(format(ns, cls, node('lessThanOrEquals', 'method')), '\\Acme\\Util\\FloatComparator::lessThanOrEquals');
    assert.equal(format(ns, cls, node('lessThanOrEquals()', 'method')), '\\Acme\\Util\\FloatComparator::lessThanOrEquals');
});

test('class constant', () => {
    assert.equal(format(ns, cls, node('EPSILON', 'constant')), '\\Acme\\Util\\FloatComparator::EPSILON');
});

test('property from both providers', () => {
    const expected = '\\Acme\\Util\\FloatComparator::$tolerance';
    assert.equal(format(ns, cls, node('$tolerance', 'property')), expected);
    assert.equal(format(ns, cls, node('tolerance', 'other')), expected);
    assert.equal(format(ns, cls, node('tolerance', 'variable')), expected);
});

test('function with and without parentheses', () => {
    assert.equal(format(ns, node('helper', 'function')), '\\Acme\\Util\\helper');
    assert.equal(format(ns, node('helper()', 'function')), '\\Acme\\Util\\helper');
});

test('global constant', () => {
    assert.equal(format(ns, node('LIMIT', 'constant')), '\\Acme\\Util\\LIMIT');
});

test('no namespace in chain', () => {
    assert.equal(format(node('helper', 'function')), '\\helper');
    assert.equal(format(cls, node('run()', 'method')), '\\FloatComparator::run');
});

test('unsupported chains return undefined', () => {
    assert.equal(format(ns, cls, node('Inner', 'class')), undefined);
    assert.equal(format(ns), undefined);
    assert.equal(format(), undefined);
    assert.equal(format(ns, cls, node('x()', 'other')), undefined);
    assert.equal(format(ns, cls, node('m', 'method'), node('v', 'variable')), undefined);
});
