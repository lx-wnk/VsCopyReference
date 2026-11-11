import { FormatInput, Language } from '../language';
import { compare, SymbolNode } from '../symbols';

export function phpName(name: string): string {
    const withoutCall = name.replace(/\(\)$/, '');
    const afterNamespace = withoutCall.slice(withoutCall.lastIndexOf('\\') + 1);
    return afterNamespace.replace(/^\$/, '');
}

export function prependNamespace(symbols: SymbolNode[], chain: SymbolNode[]): SymbolNode[] {
    const root = chain[0];
    if (!root || root.kind === 'namespace') {
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

function memberSuffix(member: SymbolNode): string | undefined {
    const name = phpName(member.name);
    switch (member.kind) {
        case 'method':
        case 'constant':
            return `::${name}`;
        case 'property':
            return `::$${name}`;
        case 'other':
        case 'variable':
            return member.name.includes('(') ? undefined : `::$${name}`;
        default:
            return undefined;
    }
}

function format({ chain }: FormatInput): string | undefined {
    const namespace = chain[0]?.kind === 'namespace' ? chain[0] : undefined;
    const [head, member, ...extra] = namespace ? chain.slice(1) : chain;
    if (!head || extra.length > 0) {
        return undefined;
    }
    const prefix = namespace ? `\\${namespace.name}\\` : '\\';
    if (head.kind === 'class') {
        const suffix = member ? memberSuffix(member) : '';
        return suffix === undefined ? undefined : prefix + phpName(head.name) + suffix;
    }
    if (!member && (head.kind === 'function' || head.kind === 'constant')) {
        return prefix + phpName(head.name);
    }
    return undefined;
}

export const php: Language = {
    languageIds: ['php'],
    recommendedExtensions: ['devsense.phptools-vscode', 'bmewburn.vscode-intelephense-client'],
    identifierPattern: /\$?[A-Za-z_][A-Za-z0-9_]*/,
    normalizeName: phpName,
    qualify: prependNamespace,
    format,
};
