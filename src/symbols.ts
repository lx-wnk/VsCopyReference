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

export const compare = (a: Pos, b: Pos): number =>
    a.line - b.line || a.character - b.character;

const contains = (r: Rng, pos: Pos): boolean =>
    compare(r.start, pos) <= 0 && compare(pos, r.end) <= 0;

function descend(symbols: SymbolNode[], pos: Pos): SymbolNode[] {
    const hit = symbols.find(s => contains(s.range, pos));
    return hit ? [hit, ...descend(hit.children, pos)] : [];
}

export function selectChain(
    symbols: SymbolNode[],
    pos: Pos,
    identifier: string | undefined,
    fromDefinition: boolean,
    normalizeName: (name: string) => string = name => name,
): SymbolNode[] | undefined {
    const chain = descend(symbols, pos);
    const tail = chain[chain.length - 1];
    if (!tail) {
        return undefined;
    }
    const nameMatches = identifier !== undefined
        && normalizeName(identifier) === normalizeName(tail.name)
        && (fromDefinition || contains(tail.selectionRange, pos));
    const atDefinitionStart = fromDefinition && compare(pos, tail.range.start) === 0;
    if (!nameMatches && !atDefinitionStart) {
        return undefined;
    }
    if (chain.slice(0, -1).some(s => s.kind === 'function' || s.kind === 'method')
        || chain.some((s, i) => (s.kind === 'variable' || s.kind === 'property')
            && i + 1 < chain.length
            && chain[i + 1].kind !== 'property' && chain[i + 1].kind !== 'method')) {
        return undefined;
    }
    return chain;
}
