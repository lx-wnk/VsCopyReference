import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phpName } from '../../src/languages/php';
import { Kind, Pos, selectChain, SymbolNode } from '../../src/symbols';

const p = (line: number, character: number): Pos => ({ line, character });
const sym = (
    name: string, kind: Kind, start: Pos, end: Pos, children: SymbolNode[] = [],
    selStart: Pos = start,
): SymbolNode => ({
    name, kind, detail: '',
    range: { start, end },
    selectionRange: { start: selStart, end: p(selStart.line, selStart.character + name.length) },
    children,
});
const names = (chain: SymbolNode[] | undefined) => chain?.map(s => s.name);

const tree = [
    sym('C', 'class', p(0, 0), p(9, 1), [
        sym('m', 'method', p(2, 0), p(5, 3), [
            sym('v', 'variable', p(3, 4), p(3, 20)),
        ], p(2, 11)),
    ]),
];

test('selects class and method at the method name', () => {
    assert.deepEqual(names(selectChain(tree, p(2, 12), 'm', false)), ['C', 'm']);
});

test('blank space inside a method yields undefined', () => {
    assert.equal(selectChain(tree, p(4, 0), undefined, false), undefined);
});

test('symbol under a function ancestor is rejected', () => {
    assert.equal(selectChain(tree, p(3, 8), 'v', false), undefined);
});

test('definition at declaration start accepts a keyword identifier', () => {
    assert.deepEqual(names(selectChain(tree, p(2, 0), 'public', true)), ['C', 'm']);
});

test('keyword under the cursor is rejected when not from a definition', () => {
    assert.equal(selectChain(tree, p(2, 0), 'public', false), undefined);
});

test('empty symbol list yields undefined', () => {
    assert.equal(selectChain([], p(0, 0), 'x', false), undefined);
});

test('object keys stay chained', () => {
    const objectTree = [
        sym('cfg', 'variable', p(0, 0), p(5, 1), [
            sym('a', 'property', p(1, 2), p(4, 3), [
                sym('b', 'property', p(2, 4), p(2, 10)),
            ]),
        ]),
    ];
    assert.deepEqual(names(selectChain(objectTree, p(2, 5), 'b', false)), ['cfg', 'a', 'b']);
});

test('does not prepend a sibling one-line namespace', () => {
    const flatNsTree = [
        sym('Acme\\Util', 'namespace', p(2, 0), p(2, 20)),
        sym('Foo', 'class', p(4, 0), p(14, 1), [
            sym('bar', 'method', p(6, 4), p(8, 5)),
        ]),
    ];
    assert.deepEqual(names(selectChain(flatNsTree, p(6, 5), 'bar', false)), ['Foo', 'bar']);
});

const phpTree = [
    sym('Decorator', 'class', p(0, 0), p(20, 1), [
        sym('load()', 'method', p(2, 4), p(10, 5), [], p(2, 20)),
    ]),
];

test('call to a same-named method inside its own body yields undefined', () => {
    assert.equal(selectChain(phpTree, p(6, 15), 'load', false, phpName), undefined);
});

test('cursor on the declaration name still selects the chain', () => {
    assert.deepEqual(names(selectChain(phpTree, p(2, 22), 'load', false, phpName)), ['Decorator', 'load()']);
});

test('local variable under a variable root is rejected', () => {
    const localTree = [
        sym('handler', 'variable', p(0, 0), p(6, 1), [
            sym('local', 'variable', p(2, 4), p(2, 20)),
        ]),
    ];
    assert.equal(selectChain(localTree, p(2, 6), 'local', false), undefined);
});
