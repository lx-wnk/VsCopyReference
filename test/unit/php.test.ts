import { test } from 'node:test';
import assert from 'node:assert/strict';
import { php, phpName, prependNamespace } from '../../src/languages/php';
import { Kind, Pos, SymbolNode } from '../../src/symbols';

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

const p = (line: number, character: number): Pos => ({ line, character });
const sym = (
    name: string, kind: Kind, start: Pos, end: Pos, children: SymbolNode[] = [],
): SymbolNode => ({
    name, kind, detail: '',
    range: { start, end }, selectionRange: { start, end }, children,
});
const qualifiedNames = (symbols: SymbolNode[], chain: SymbolNode[]) =>
    prependNamespace(symbols, chain).map(s => s.name);

test('phpName strips sigils, call parens and namespaces', () => {
    assert.equal(phpName('$prop'), 'prop');
    assert.equal(phpName('load()'), 'load');
    assert.equal(phpName('Acme\\Util\\helper'), 'helper');
});

test('php hooks are registered', () => {
    assert.equal(php.normalizeName, phpName);
    assert.equal(php.qualify, prependNamespace);
    assert.ok(php.identifierPattern?.test('$tolerance'));
});

test('prependNamespace prepends the preceding one-line namespace', () => {
    const method = sym('lessThanOrEquals', 'method', p(6, 4), p(8, 5));
    const klass = sym('FloatComparator', 'class', p(4, 0), p(14, 1), [method]);
    const symbols = [sym('Acme\\Util', 'namespace', p(2, 0), p(2, 20)), klass];
    assert.deepEqual(qualifiedNames(symbols, [klass, method]), ['Acme\\Util', 'FloatComparator', 'lessThanOrEquals']);
});

test('prependNamespace chooses the nearest of several', () => {
    const foo = sym('Foo', 'class', p(12, 0), p(20, 1));
    const symbols = [
        sym('A', 'namespace', p(0, 0), p(0, 12)),
        sym('B', 'namespace', p(10, 0), p(10, 12)),
        foo,
    ];
    assert.deepEqual(qualifiedNames(symbols, [foo]), ['B', 'Foo']);
});

test('prependNamespace leaves a namespace root untouched', () => {
    const klass = sym('FloatComparator', 'class', p(4, 0), p(16, 1));
    const root = sym('Acme\\Util', 'namespace', p(2, 0), p(18, 1), [klass]);
    const chain = [root, klass];
    assert.equal(prependNamespace([root], chain), chain);
});

test('prependNamespace skips namespaces with children, multi-line ranges or after the root', () => {
    const bar = sym('Bar', 'class', p(7, 0), p(12, 1));
    const closed = sym('Foo', 'namespace', p(0, 0), p(5, 1), [sym('Inner', 'class', p(1, 2), p(4, 3))]);
    const oneLineWithChild = sym('Foo', 'namespace', p(0, 0), p(0, 30), [sym('Inner', 'class', p(0, 10), p(0, 25))]);
    const multiLine = sym('Foo', 'namespace', p(0, 0), p(5, 1));
    const after = sym('Foo', 'namespace', p(20, 0), p(20, 10));
    for (const ns of [closed, oneLineWithChild, multiLine, after]) {
        assert.deepEqual(qualifiedNames([ns, bar], [bar]), ['Bar']);
    }
});
