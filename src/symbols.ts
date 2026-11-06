export type Pos = { line: number; character: number };
export type Rng = { start: Pos; end: Pos };
export type Kind =
    | 'namespace' | 'class' | 'function' | 'method'
    | 'property' | 'constant' | 'variable' | 'other';
export type SymbolNode = {
    name: string;
    kind: Kind;
    detail: string;
    range: Rng;
    selectionRange: Rng;
    children: SymbolNode[];
};

const compare = (a: Pos, b: Pos): number =>
    a.line - b.line || a.character - b.character;

const contains = (r: Rng, pos: Pos): boolean =>
    compare(r.start, pos) <= 0 && compare(pos, r.end) <= 0;

export function baseName(name: string): string {
    const withoutCall = name.replace(/\(\)$/, '');
    const afterNamespace = withoutCall.slice(withoutCall.lastIndexOf('\\') + 1);
    return afterNamespace.replace(/^\$/, '');
}

function descend(symbols: SymbolNode[], pos: Pos): SymbolNode[] {
    const hit = symbols.find(s => contains(s.range, pos));
    return hit ? [hit, ...descend(hit.children, pos)] : [];
}

export function selectChain(
    symbols: SymbolNode[],
    pos: Pos,
    identifier: string | undefined,
    fromDefinition: boolean,
): SymbolNode[] | undefined {
    const chain = descend(symbols, pos);
    const tail = chain[chain.length - 1];
    if (!tail) {
        return undefined;
    }
    const nameMatches = identifier !== undefined && baseName(identifier) === baseName(tail.name);
    const atDefinitionStart = fromDefinition && compare(pos, tail.range.start) === 0;
    if (!nameMatches && !atDefinitionStart) {
        return undefined;
    }
    if (chain.slice(0, -1).some(s => s.kind === 'function' || s.kind === 'method')) {
        return undefined;
    }
    const root = chain[0];
    if (root.kind === 'namespace') {
        return chain;
    }
    // Intelephense emits namespaces as one-line siblings preceding the declarations.
    const namespace = symbols
        .filter(s => s.kind === 'namespace'
            && s.children.length === 0
            && s.range.start.line === s.range.end.line
            && compare(s.range.start, root.range.start) < 0)
        .sort((a, b) => compare(b.range.start, a.range.start))[0];
    return namespace ? [namespace, ...chain] : chain;
}
